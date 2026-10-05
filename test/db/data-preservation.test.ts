import { expect, test } from "bun:test"
import { count } from "drizzle-orm"
import path from "node:path"

import type { StickerSetType } from "@/db/schema"

import { createStickerSet, getStickerSetForUserByType } from "@/db/queries/sticker-sets"
import { createUser, getUserByTelegramId } from "@/db/queries/users"
import { stickerSets, users } from "@/db/schema"

import { restoreData } from "./dump-tools"
import { findProductionDump } from "./production-fixtures"
import { createTestDatabase } from "./test-database"

const EXPECTED_USER_COUNT = 22
const EXPECTED_STICKER_SET_COUNT = 36
const EXPECTED_TYPE_COUNTS: Record<StickerSetType, number> = {
  ANIMATED: 10,
  REGULAR: 16,
  VIDEO: 10,
}

const productionDumpPath = await findProductionDump()

if (productionDumpPath === undefined) {
  process.stdout.write("data preservation: skipped (no prod-*.dump in the backup directory)\n")
}

const dataTest = productionDumpPath === undefined ? test.skip : test

dataTest(
  productionDumpPath === undefined
    ? "data preservation (skipped: no prod-*.dump in the backup directory)"
    : `data preservation (${path.basename(productionDumpPath)})`,
  async () => {
    if (productionDumpPath === undefined) {
      throw new Error("missing production dump fixture")
    }
    const database = await createTestDatabase()
    try {
      const { db } = database

      // The dump's TOC order places sticker_set data before user data, so the user rows must land first for the FK.
      await restoreData(database.databaseUrl, productionDumpPath, ["user", "user_id_seq"])
      await restoreData(database.databaseUrl, productionDumpPath, [
        "sticker_set",
        "sticker_set_id_seq",
      ])

      const [userCount] = await db.select({ value: count() }).from(users)
      const [stickerSetCount] = await db.select({ value: count() }).from(stickerSets)
      process.stdout.write(
        `data preservation: restored ${userCount?.value} users and ${stickerSetCount?.value} sticker sets\n`,
      )
      expect(Number(userCount?.value)).toBe(EXPECTED_USER_COUNT)
      expect(Number(stickerSetCount?.value)).toBe(EXPECTED_STICKER_SET_COUNT)

      const allUsers = await db.select().from(users)
      const allStickerSets = await db.select().from(stickerSets)
      expect(allUsers).toHaveLength(EXPECTED_USER_COUNT)
      expect(allStickerSets).toHaveLength(EXPECTED_STICKER_SET_COUNT)

      const typeCounts: Record<StickerSetType, number> = { ANIMATED: 0, REGULAR: 0, VIDEO: 0 }
      for (const stickerSet of allStickerSets) {
        typeCounts[stickerSet.stickerSetType] += 1
      }
      expect(typeCounts).toEqual(EXPECTED_TYPE_COUNTS)

      await Promise.all(
        allUsers.map(async (user) => {
          const fetched = await getUserByTelegramId(db, user.telegramId)
          expect(fetched?.id).toBe(user.id)
        }),
      )
      await Promise.all(
        allStickerSets.map(async (stickerSet) => {
          const fetched = await getStickerSetForUserByType(
            db,
            stickerSet.userId,
            stickerSet.stickerSetType,
          )
          expect(fetched?.userId).toBe(stickerSet.userId)
          expect(fetched?.stickerSetType).toBe(stickerSet.stickerSetType)
        }),
      )

      const freshUser = await createUser(db, "data-preservation-user")
      expect(freshUser).toBeDefined()
      if (freshUser === undefined) {
        throw new Error("createUser returned no row")
      }
      expect(freshUser.id).toBeGreaterThan(EXPECTED_USER_COUNT)

      const freshRegular = await createStickerSet(db, {
        name: "data_preservation_regular",
        title: "Data Preservation Regular",
        stickerSetType: "REGULAR",
        userId: freshUser.id,
      })
      const freshAnimated = await createStickerSet(db, {
        name: "data_preservation_animated",
        title: "Data Preservation Animated",
        stickerSetType: "ANIMATED",
        userId: freshUser.id,
      })
      const freshVideo = await createStickerSet(db, {
        name: "data_preservation_video",
        title: "Data Preservation Video",
        stickerSetType: "VIDEO",
        userId: freshUser.id,
      })
      expect(freshRegular).toBeDefined()
      expect(freshAnimated).toBeDefined()
      expect(freshVideo).toBeDefined()

      const fetchedRegular = await getStickerSetForUserByType(db, freshUser.id, "REGULAR")
      expect(fetchedRegular?.name).toBe("data_preservation_regular")

      const [finalUserCount] = await db.select({ value: count() }).from(users)
      const [finalStickerSetCount] = await db.select({ value: count() }).from(stickerSets)
      expect(Number(finalUserCount?.value)).toBe(EXPECTED_USER_COUNT + 1)
      expect(Number(finalStickerSetCount?.value)).toBe(EXPECTED_STICKER_SET_COUNT + 3)
    } finally {
      await database.close()
    }
  },
)
