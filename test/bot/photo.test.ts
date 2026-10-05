import type { TelegramApiCall } from "@test/helpers/telegram-api"
import type { Update } from "grammy/types"

import { createTestDatabase } from "@test/db/test-database"
import { createFakeTelegramApi } from "@test/helpers/telegram-api"
import { afterAll, beforeEach, describe, expect, test } from "bun:test"

import { createBot } from "@/bot/bot"
import { stickerSets, users } from "@/db/schema"

const ADMIN_USERNAME = "sutekkapakku_admin"
const API_TOKEN = "424242:fake-token"
const CAPTION_PROMPT = "Please add a caption with an emoji to your picture (e.g. 🥰)"
const EMOJI_PROMPT = "Your caption does not contain an emoji 🥲"
const NOT_REGISTERED_PROMPT = "You are not registered yet.\nPlease use /start command.."

const TRANSPARENT_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
)

interface PhotoUpdateOptions {
  updateId: number
  messageId: number
  userId: number
  photos: { fileId: string; fileUniqueId: string; width: number; height: number }[]
  caption?: string
}

const buildPhotoUpdate = (options: PhotoUpdateOptions): Update => ({
  update_id: options.updateId,
  message: {
    message_id: options.messageId,
    date: Math.floor(Date.now() / 1000),
    chat: { id: options.userId, type: "private", first_name: "Photo" },
    from: { id: options.userId, is_bot: false, first_name: "Photo", username: "photo_user" },
    photo: options.photos.map((item) => ({
      file_id: item.fileId,
      file_unique_id: item.fileUniqueId,
      width: item.width,
      height: item.height,
    })),
    ...(options.caption === undefined ? {} : { caption: options.caption }),
  },
})

const database = await createTestDatabase()
const { db } = database
const api = createFakeTelegramApi()

const bot = createBot({
  adminUsername: ADMIN_USERNAME,
  apiRoot: api.apiRoot,
  apiToken: API_TOKEN,
  db,
})

await bot.init()

beforeEach(async () => {
  await db.delete(stickerSets)
  await db.delete(users)
  api.clearCalls()
})

afterAll(async () => {
  await api.stop()
  await database.close()
})

const photo = (fileId: string, fileUniqueId: string, width: number, height: number) => ({
  fileId,
  fileUniqueId,
  width,
  height,
})

const makeFixture = async (width: number, height: number): Promise<Uint8Array> =>
  new Bun.Image(TRANSPARENT_PIXEL_PNG).resize(width, height).png().bytes()

const registerUser = async (telegramId: number): Promise<number> => {
  const [user] = await db
    .insert(users)
    .values({ telegramId: String(telegramId) })
    .returning()
  if (user === undefined) {
    throw new Error("Failed to create the test user")
  }
  return user.id
}

const registerPhotoFile = (fileId: string, bytes: Uint8Array): void => {
  api.setFile(fileId, { content_type: "image/png", data: bytes, file_path: `photos/${fileId}.png` })
}

const sendPhoto = async (options: PhotoUpdateOptions): Promise<void> => {
  await bot.handleUpdate(buildPhotoUpdate(options))
}

const firstCall = (method: string): TelegramApiCall => {
  const [call] = api.callsFor(method)
  if (call === undefined) {
    throw new Error(`No ${method} call recorded`)
  }
  return call
}

const findUpload = (call: TelegramApiCall): File => {
  const upload = Object.values(call.params).find((value): value is File => value instanceof File)
  if (upload === undefined) {
    throw new Error(`No file upload recorded for ${call.method}`)
  }
  return upload
}

const readUploadMetadata = async (call: TelegramApiCall) => {
  const upload = findUpload(call)
  const bytes = new Uint8Array(await upload.arrayBuffer())
  return { metadata: await new Bun.Image(bytes).metadata(), name: upload.name }
}

describe("photo to sticker flow", () => {
  test("asks for a caption when the photo has none and writes nothing", async () => {
    await sendPhoto({
      messageId: 101,
      photos: [photo("no_caption", "no_caption_unique", 16, 8)],
      updateId: 1,
      userId: 3001,
    })

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(1)
    expect(replies[0]?.params.text).toBe(CAPTION_PROMPT)
    expect(await db.select().from(users)).toHaveLength(0)
    expect(await db.select().from(stickerSets)).toHaveLength(0)
  })

  test("asks for an emoji when the caption has none and writes nothing", async () => {
    await sendPhoto({
      caption: "look at this",
      messageId: 102,
      photos: [photo("no_emoji", "no_emoji_unique", 16, 8)],
      updateId: 2,
      userId: 3002,
    })

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(1)
    expect(replies[0]?.params.text).toBe(EMOJI_PROMPT)
    expect(await db.select().from(users)).toHaveLength(0)
    expect(await db.select().from(stickerSets)).toHaveLength(0)
  })

  test("creates a regular pack with a 512 px landscape jpeg upload", async () => {
    const userId = 3003
    const userRowId = await registerUser(userId)
    registerPhotoFile("photo_small", await makeFixture(4, 2))
    registerPhotoFile("photo_large", await makeFixture(16, 8))

    await sendPhoto({
      caption: "Look 🥰",
      messageId: 103,
      photos: [
        photo("photo_small", "small_unique", 4, 2),
        photo("photo_large", "large_unique", 16, 8),
      ],
      updateId: 3,
      userId,
    })

    expect(api.callsFor("getFile").map((call) => call.params.file_id)).toEqual(["photo_large"])

    const createCall = firstCall("createNewStickerSet")
    expect(createCall.params.name).toMatch(/^photo_user_[A-Za-z]{4}_by_sutekkapakku_test_bot$/u)
    expect(createCall.params.title).toBe("photo_user's Greatest Hits")

    const stickerPayload = String(createCall.params.stickers)
    expect(stickerPayload).toContain('"emoji_list":["🥰"]')
    expect(stickerPayload).toContain('"format":"static"')
    expect(stickerPayload).toContain('"sticker":"attach://')

    const { metadata, name } = await readUploadMetadata(createCall)
    expect(name).toBe("large_unique.png")
    expect(metadata).toMatchObject({ format: "jpeg", height: 256, width: 512 })

    const rows = await db.select().from(stickerSets)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      name: createCall.params.name,
      stickerSetType: "REGULAR",
      title: "photo_user's Greatest Hits",
      userId: userRowId,
    })

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(1)
    expect(replies[0]?.params.parse_mode).toBe("HTML")
    expect(replies[0]?.params.text).toBe(
      `Sticker pack created!\n\nLink: <a href='https://t.me/addstickers/${String(createCall.params.name)}'>photo_user's Greatest Hits</a>`,
    )
  })

  test("creates a regular pack with a 512 px portrait jpeg upload", async () => {
    const userId = 3004
    await registerUser(userId)
    registerPhotoFile("photo_portrait", await makeFixture(8, 16))

    await sendPhoto({
      caption: "Portrait 🥰",
      messageId: 104,
      photos: [photo("photo_portrait", "portrait_unique", 8, 16)],
      updateId: 4,
      userId,
    })

    const { metadata, name } = await readUploadMetadata(firstCall("createNewStickerSet"))
    expect(name).toBe("portrait_unique.png")
    expect(metadata).toMatchObject({ format: "jpeg", height: 512, width: 256 })
    expect(await db.select().from(stickerSets)).toHaveLength(1)
  })

  test("adds a second photo to the existing regular pack", async () => {
    const userId = 3005
    await registerUser(userId)
    registerPhotoFile("first_photo", await makeFixture(16, 8))

    await sendPhoto({
      caption: "First 🥰",
      messageId: 105,
      photos: [photo("first_photo", "first_unique", 16, 8)],
      updateId: 5,
      userId,
    })
    const packName = String(firstCall("createNewStickerSet").params.name)
    api.clearCalls()

    registerPhotoFile("second_photo", await makeFixture(8, 16))
    await sendPhoto({
      caption: "Second 🥰",
      messageId: 106,
      photos: [photo("second_photo", "second_unique", 8, 16)],
      updateId: 6,
      userId,
    })

    expect(api.callsFor("createNewStickerSet")).toHaveLength(0)
    const addCall = firstCall("addStickerToSet")
    expect(addCall.params.name).toBe(packName)

    const { metadata, name } = await readUploadMetadata(addCall)
    expect(name).toBe("second_unique.png")
    expect(metadata).toMatchObject({ format: "jpeg", height: 512, width: 256 })

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(1)
    expect(replies[0]?.params.text).toBe(
      `Sticker added to the pack.\n\nLink: <a href='https://t.me/addstickers/${packName}'>photo_user's Greatest Hits</a>`,
    )
    expect(await db.select().from(stickerSets)).toHaveLength(1)
  })

  test("uses the first distinct emoji of a caption with several emojis", async () => {
    const userId = 3006
    await registerUser(userId)
    registerPhotoFile("emoji_photo", await makeFixture(16, 8))

    await sendPhoto({
      caption: "Mood 🥲 then 🥰 and 🥲",
      messageId: 107,
      photos: [photo("emoji_photo", "emoji_unique", 16, 8)],
      updateId: 7,
      userId,
    })

    expect(String(firstCall("createNewStickerSet").params.stickers)).toContain(
      '"emoji_list":["🥲"]',
    )
  })

  test("asks an unregistered user to use /start", async () => {
    await sendPhoto({
      caption: "Hello 🥰",
      messageId: 108,
      photos: [photo("unknown_photo", "unknown_unique", 16, 8)],
      updateId: 8,
      userId: 3007,
    })

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(1)
    expect(replies[0]?.params.text).toBe(NOT_REGISTERED_PROMPT)
    expect(api.callsFor("getFile")).toHaveLength(0)
    expect(api.callsFor("createNewStickerSet")).toHaveLength(0)
    expect(await db.select().from(stickerSets)).toHaveLength(0)
  })
})
