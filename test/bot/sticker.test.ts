import type { WideEvent } from "evlog"
import type { Sticker } from "grammy/types"

import { createTestDatabase } from "@test/db/test-database"
import { loggedErrorMessages } from "@test/helpers/log-events"
import {
  buildSticker,
  buildStickerUpdate,
  readMultipartUpload,
  readStickerEntries,
  registerUser,
  seedStickerSet,
} from "@test/helpers/sticker-flow"
import { createFakeTelegramApi } from "@test/helpers/telegram-api"
import { afterAll, beforeEach, describe, expect, test } from "bun:test"
import { BotError } from "grammy"

import type { BotContext } from "@/bot/context"

import { createBot } from "@/bot/bot"
import { stickerSets, users } from "@/db/schema"
import { initLogging } from "@/logger"

const ADMIN_USERNAME = "sutekkapakku_admin"
const API_TOKEN = "424242:fake-token"
const NOT_REGISTERED_REPLY = "You are not registered yet.\nPlease use /start command.."
const STICKER_REMOVED_REPLY =
  "Sticker removed from the pack. It may take a few minutes for sticker pack to update."

const database = await createTestDatabase()
const { db } = database
const api = createFakeTelegramApi()
const events: WideEvent[] = []

initLogging((drain) => {
  events.push(drain.event)
})

const bot = createBot({
  adminUsername: ADMIN_USERNAME,
  apiRoot: api.apiRoot,
  apiToken: API_TOKEN,
  db,
})

await bot.init()

let nextUpdateId = 0

const sendSticker = async (userId: number, username: string, sticker: Sticker): Promise<void> => {
  nextUpdateId += 1
  await bot.handleUpdate(
    buildStickerUpdate({
      messageId: nextUpdateId,
      sticker,
      updateId: nextUpdateId,
      userId,
      username,
    }),
  )
}

const isBotContextError = (error: unknown): error is BotError<BotContext> =>
  error instanceof BotError && "dbTx" in error.ctx

const expectBotError = async (operation: Promise<unknown>): Promise<BotError<BotContext>> => {
  try {
    await operation
  } catch (error: unknown) {
    if (isBotContextError(error)) {
      return error
    }
    throw error
  }
  throw new Error("expected the update to fail")
}

const seedRemovableSet = async (userId: number, username: string): Promise<string> => {
  const name = `${username}_abcd_by_sutekkapakku_test_bot`
  await seedStickerSet(db, userId, "REGULAR", name, `${username}'s Greatest Hits`)
  return name
}

beforeEach(async () => {
  await db.delete(stickerSets)
  await db.delete(users)
  api.clearCalls()
  events.length = 0
})

afterAll(async () => {
  await api.stop()
  await database.close()
})

describe("sticker addition", () => {
  test("creates a regular pack for the first sticker and replies with the link", async () => {
    await registerUser(db, "2001")

    await sendSticker(2001, "alice", buildSticker({ emoji: "🎉", fileId: "regular_file_1" }))

    const sets = await db.select().from(stickerSets)
    expect(sets).toHaveLength(1)
    expect(sets[0]?.stickerSetType).toBe("REGULAR")
    expect(sets[0]?.name).toMatch(/^alice_[A-Za-z]{4}_by_sutekkapakku_test_bot$/u)
    expect(sets[0]?.title).toBe("alice's Greatest Hits")

    expect(api.callsFor("createNewStickerSet")[0]?.params).toMatchObject({
      name: sets[0]?.name,
      stickers: [{ emoji_list: ["🎉"], format: "static", sticker: "regular_file_1" }],
      title: "alice's Greatest Hits",
      user_id: 2001,
    })

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(1)
    expect(replies[0]?.params).toMatchObject({
      chat_id: 2001,
      parse_mode: "HTML",
      text: `Sticker pack created!\n\nLink: <a href='https://t.me/addstickers/${sets[0]?.name}'>alice's Greatest Hits</a>`,
    })
  })

  test("adds a second regular sticker to the existing pack", async () => {
    await registerUser(db, "2002")
    await sendSticker(2002, "alice", buildSticker({ emoji: "🎉", fileId: "regular_file_1" }))
    api.clearCalls()

    await sendSticker(2002, "alice", buildSticker({ emoji: "🔥", fileId: "regular_file_2" }))

    const sets = await db.select().from(stickerSets)
    expect(sets).toHaveLength(1)
    expect(api.callsFor("addStickerToSet")[0]?.params).toMatchObject({
      name: sets[0]?.name,
      sticker: { emoji_list: ["🔥"], format: "static", sticker: "regular_file_2" },
      user_id: 2002,
    })

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(1)
    expect(replies[0]?.params.text).toBe(
      `Sticker added to the pack.\n\nLink: <a href='https://t.me/addstickers/${sets[0]?.name}'>alice's Greatest Hits</a>`,
    )
  })

  test("creates an animated pack and uploads the downloaded bytes", async () => {
    await registerUser(db, "2003")
    const bytes = new TextEncoder().encode("animated sticker bytes")
    api.setFile("animated_file", {
      content_type: "application/x-tgsticker",
      data: bytes,
      file_path: "stickers/animated_file.tgs",
    })

    await sendSticker(
      2003,
      "bob",
      buildSticker({ emoji: "😀", fileId: "animated_file", isAnimated: true }),
    )

    expect(api.callsFor("getFile")[0]?.params).toEqual({ file_id: "animated_file" })

    const sets = await db.select().from(stickerSets)
    expect(sets[0]?.stickerSetType).toBe("ANIMATED")
    expect(sets[0]?.title).toBe("bob's Greatest Animated Hits")

    const params = api.callsFor("createNewStickerSet")[0]?.params ?? {}
    expect(params).toMatchObject({
      name: sets[0]?.name,
      title: "bob's Greatest Animated Hits",
      user_id: "2003",
    })

    const entries = readStickerEntries(params.stickers)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ emoji_list: ["😀"], format: "animated" })
    const upload = await readMultipartUpload(params, entries[0]?.sticker ?? "")
    expect(new TextDecoder().decode(upload)).toBe("animated sticker bytes")
  })

  test("creates a video pack and uploads the downloaded bytes", async () => {
    await registerUser(db, "2004")
    const bytes = new TextEncoder().encode("video sticker bytes")
    api.setFile("video_file", {
      content_type: "video/webm",
      data: bytes,
      file_path: "stickers/video_file.webm",
    })

    await sendSticker(
      2004,
      "carol",
      buildSticker({ emoji: "🎬", fileId: "video_file", isVideo: true }),
    )

    expect(api.callsFor("getFile")[0]?.params).toEqual({ file_id: "video_file" })

    const sets = await db.select().from(stickerSets)
    expect(sets[0]?.stickerSetType).toBe("VIDEO")
    expect(sets[0]?.title).toBe("carol's Greatest Video Hits")

    const params = api.callsFor("createNewStickerSet")[0]?.params ?? {}
    const entries = readStickerEntries(params.stickers)
    expect(entries).toHaveLength(1)
    expect(entries[0]).toMatchObject({ emoji_list: ["🎬"], format: "video" })
    const upload = await readMultipartUpload(params, entries[0]?.sticker ?? "")
    expect(new TextDecoder().decode(upload)).toBe("video sticker bytes")
  })

  test("treats a sticker from a different pack as an addition", async () => {
    const user = await registerUser(db, "2005")
    await seedRemovableSet(user.id, "dave")

    await sendSticker(
      2005,
      "dave",
      buildSticker({ emoji: "🎉", fileId: "regular_file_9", setName: "someone_else_pack" }),
    )

    expect(api.callsFor("deleteStickerFromSet")).toHaveLength(0)
    expect(api.callsFor("addStickerToSet")).toHaveLength(1)
  })
})

describe("sticker removal", () => {
  test("removes a sticker that belongs to the user's own pack", async () => {
    const user = await registerUser(db, "3001")
    const name = await seedRemovableSet(user.id, "erin")

    await sendSticker(
      3001,
      "erin",
      buildSticker({ emoji: "🎉", fileId: "own_file", setName: name }),
    )

    expect(api.callsFor("deleteStickerFromSet")[0]?.params).toEqual({ sticker: "own_file" })
    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(1)
    expect(replies[0]?.params.text).toBe(STICKER_REMOVED_REPLY)
  })

  test("explains the Telegram STICKERSET_NOT_MODIFIED bug", async () => {
    const user = await registerUser(db, "3002")
    const name = await seedRemovableSet(user.id, "frank")
    api.failNext("deleteStickerFromSet", {
      description: "Bad Request: STICKERSET_NOT_MODIFIED",
    })

    await sendSticker(
      3002,
      "frank",
      buildSticker({ emoji: "🎉", fileId: "own_file", setName: name }),
    )

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(1)
    const text = replies[0]?.params.text
    expect(String(text)).toContain("wait 15 minutes")
    expect(String(text)).toContain(`<a href='https://t.me/${ADMIN_USERNAME}'>Contact</a>`)
  })
})

describe("sticker filtering", () => {
  test("tells an unregistered user to start the bot", async () => {
    await sendSticker(4001, "grace", buildSticker({ emoji: "🎉", fileId: "regular_file_1" }))

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(1)
    expect(replies[0]?.params.text).toBe(NOT_REGISTERED_REPLY)
    expect(api.calls).toHaveLength(1)
    expect(await db.select().from(stickerSets)).toHaveLength(0)
  })

  test("silently ignores a sticker without an emoji", async () => {
    await registerUser(db, "4002")

    await sendSticker(4002, "heidi", buildSticker({ fileId: "regular_file_1" }))

    expect(api.calls).toHaveLength(0)
    expect(await db.select().from(stickerSets)).toHaveLength(0)
    expect(events.some((event) => event.operation === "sticker_without_emoji")).toBe(true)
  })

  test("rolls the pack row back when Telegram rejects the new set", async () => {
    await registerUser(db, "4003")
    api.failNext("createNewStickerSet")

    const botError = await expectBotError(
      sendSticker(4003, "ivan", buildSticker({ emoji: "🎉", fileId: "regular_file_1" })),
    )
    await bot.errorHandler(botError)

    expect(await db.select().from(stickerSets)).toHaveLength(0)
    expect(api.callsFor("sendMessage")).toHaveLength(0)
    expect(loggedErrorMessages(events).length).toBeGreaterThan(0)
  })
})
