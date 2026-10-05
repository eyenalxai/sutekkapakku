import { afterAll, beforeEach, describe, expect, test } from "bun:test"

import type { DbExecutor } from "@/db/client"

import { createStickerSet, getStickerSetForUserByType } from "@/db/queries/sticker-sets"
import { createUser, getUserByTelegramId } from "@/db/queries/users"
import { stickerSets, users } from "@/db/schema"

import { createTestDatabase } from "./test-database"

const database = await createTestDatabase()
const { db } = database

const createTestUser = async (executor: DbExecutor, telegramId: string) => {
  const user = await createUser(executor, telegramId)
  if (user === undefined) {
    throw new Error(`failed to create user ${telegramId}`)
  }
  return user
}

const expectConstraintViolation = async (
  query: Promise<unknown>,
  fragment: string,
): Promise<void> => {
  let caught: unknown = undefined
  try {
    await query
  } catch (error: unknown) {
    caught = error
  }
  expect(caught).toBeInstanceOf(Error)
  if (caught instanceof Error) {
    const cause = caught.cause instanceof Error ? caught.cause.message : caught.message
    expect(cause).toContain(fragment)
  }
}

beforeEach(async () => {
  await db.delete(stickerSets)
  await db.delete(users)
})

afterAll(async () => {
  await database.close()
})

describe("user queries", () => {
  test("creates and fetches a user by telegram id", async () => {
    const created = await createTestUser(db, "100200300")

    expect(created.telegramId).toBe("100200300")
    expect(created.createdAt).toBeInstanceOf(Date)
    expect(created.id).toBeGreaterThan(0)

    const fetched = await getUserByTelegramId(db, "100200300")
    expect(fetched?.id).toBe(created.id)
    expect(fetched?.telegramId).toBe(created.telegramId)
  })

  test("returns undefined for an unknown telegram id", async () => {
    expect(await getUserByTelegramId(db, "does-not-exist")).toBeUndefined()
  })

  test("rejects a duplicate telegram id", async () => {
    await createTestUser(db, "100200300")

    await expectConstraintViolation(createUser(db, "100200300"), "user_telegram_id_key")
  })
})

describe("sticker set queries", () => {
  test("creates and fetches a sticker set for each sticker type", async () => {
    const user = await createTestUser(db, "types")

    const regular = await createStickerSet(db, {
      name: "types_regular",
      title: "Types Regular",
      stickerSetType: "REGULAR",
      userId: user.id,
    })
    const animated = await createStickerSet(db, {
      name: "types_animated",
      title: "Types Animated",
      stickerSetType: "ANIMATED",
      userId: user.id,
    })
    const video = await createStickerSet(db, {
      name: "types_video",
      title: "Types Video",
      stickerSetType: "VIDEO",
      userId: user.id,
    })

    expect(regular?.stickerSetType).toBe("REGULAR")
    expect(animated?.stickerSetType).toBe("ANIMATED")
    expect(video?.stickerSetType).toBe("VIDEO")

    const fetchedRegular = await getStickerSetForUserByType(db, user.id, "REGULAR")
    const fetchedAnimated = await getStickerSetForUserByType(db, user.id, "ANIMATED")
    const fetchedVideo = await getStickerSetForUserByType(db, user.id, "VIDEO")

    expect(fetchedRegular?.id).toBe(regular?.id)
    expect(fetchedAnimated?.id).toBe(animated?.id)
    expect(fetchedVideo?.id).toBe(video?.id)
  })

  test("returns undefined for a type the user does not have", async () => {
    const user = await createTestUser(db, "no-video")

    await createStickerSet(db, {
      name: "no_video_regular",
      title: "No Video Regular",
      stickerSetType: "REGULAR",
      userId: user.id,
    })

    expect(await getStickerSetForUserByType(db, user.id, "VIDEO")).toBeUndefined()
  })

  test("rejects a sticker set for an unknown user", async () => {
    await expectConstraintViolation(
      createStickerSet(db, {
        name: "orphan_set",
        title: "Orphan Set",
        stickerSetType: "REGULAR",
        userId: 999_999,
      }),
      "sticker_set_user_id_fkey",
    )
  })

  test("rejects a duplicate name", async () => {
    const user = await createTestUser(db, "duplicate-name")

    await createStickerSet(db, {
      name: "duplicate_name",
      title: "First Title",
      stickerSetType: "REGULAR",
      userId: user.id,
    })

    await expectConstraintViolation(
      createStickerSet(db, {
        name: "duplicate_name",
        title: "Second Title",
        stickerSetType: "ANIMATED",
        userId: user.id,
      }),
      "sticker_set_name_key",
    )
  })

  test("rejects a duplicate title", async () => {
    const user = await createTestUser(db, "duplicate-title")

    await createStickerSet(db, {
      name: "duplicate_title_first",
      title: "Shared Title",
      stickerSetType: "REGULAR",
      userId: user.id,
    })

    await expectConstraintViolation(
      createStickerSet(db, {
        name: "duplicate_title_second",
        title: "Shared Title",
        stickerSetType: "VIDEO",
        userId: user.id,
      }),
      "sticker_set_title_key",
    )
  })
})

describe("transactions", () => {
  test("rolls back insertions made through the query functions", async () => {
    const transaction = db.transaction(async (tx) => {
      const user = await createTestUser(tx, "rolled-back")
      await createStickerSet(tx, {
        name: "rolled_back_regular",
        title: "Rolled Back Regular",
        stickerSetType: "REGULAR",
        userId: user.id,
      })
      throw new Error("rollback requested")
    })

    await expectConstraintViolation(transaction, "rollback requested")

    expect(await getUserByTelegramId(db, "rolled-back")).toBeUndefined()
    expect(await db.select().from(stickerSets)).toHaveLength(0)
  })
})
