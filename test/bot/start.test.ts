import type { WideEvent } from "evlog"
import type { Update } from "grammy/types"

import { createTestDatabase } from "@test/db/test-database"
import { createFakeTelegramApi } from "@test/helpers/telegram-api"
import { afterAll, beforeEach, describe, expect, test } from "bun:test"

import { createBot } from "@/bot/bot"
import { stickerSets, users } from "@/db/schema"
import { initLogging } from "@/logger"

const ADMIN_USERNAME = "sutekkapakku_admin"
const API_TOKEN = "424242:fake-token"
const HELP_TEXT = `Send me a sticker and I'll put it in your personal sticker pack.
Send me a sticker from a pack create by this bot and this sticker will be removed.
Send me a picture with an emoji caption and I'll create a sticker from it.
If you have any questions, please contact me.

<a href='https://t.me/${ADMIN_USERNAME}'>Contact</a>`

interface MessageOptions {
  updateId: number
  messageId: number
  userId: number
  text: string
  username?: string
  firstName?: string
  lastName?: string
}

const buildUpdate = (options: MessageOptions): Update => {
  const { firstName = "Test", lastName, messageId, text, userId, username } = options
  const commandMatch = /^\/(?<command>[a-zA-Z0-9_]+)/u.exec(text)
  return {
    update_id: options.updateId,
    message: {
      message_id: messageId,
      date: Math.floor(Date.now() / 1000),
      chat: {
        id: userId,
        type: "private",
        first_name: firstName,
        ...(lastName === undefined ? {} : { last_name: lastName }),
      },
      from: {
        id: userId,
        is_bot: false,
        first_name: firstName,
        ...(lastName === undefined ? {} : { last_name: lastName }),
        ...(username === undefined ? {} : { username }),
      },
      text,
      ...(commandMatch === null
        ? {}
        : {
            entities: [{ type: "bot_command", offset: 0, length: commandMatch[0].length }],
          }),
    },
  }
}

const buildSenderlessUpdate = (updateId: number, messageId: number, chatId: number): Update => {
  const message: NonNullable<Update["message"]> = {
    message_id: messageId,
    date: Math.floor(Date.now() / 1000),
    chat: { id: chatId, type: "supergroup", title: "Test Group" },
    sender_chat: { id: chatId, type: "channel", title: "Test Channel" },
    from: { id: chatId, is_bot: false, first_name: "Fake Sender" },
    text: "hello",
  }
  // Telegram types require `from` on message updates; drop it to reach the defensive no-sender branch.
  Reflect.deleteProperty(message, "from")
  return { update_id: updateId, message }
}

const loggedErrorMessages = (loggedEvents: WideEvent[]): string[] =>
  loggedEvents.flatMap((event) => {
    const { error } = event
    if (typeof error !== "object" || error === null) {
      return []
    }
    const message = (error as { message?: unknown }).message
    return typeof message === "string" ? [message] : []
  })

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

describe("start and help commands", () => {
  test("registers a new user and replies with the welcome text", async () => {
    await bot.handleUpdate(
      buildUpdate({
        firstName: "New",
        lastName: "User",
        messageId: 101,
        text: "/start",
        updateId: 1,
        userId: 1001,
        username: "new_user",
      }),
    )

    const rows = await db.select().from(users)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.telegramId).toBe("1001")

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(1)
    expect(replies[0]?.params).toMatchObject({
      chat_id: 1001,
      parse_mode: "HTML",
      text: `Welcome, New User!\n\n${HELP_TEXT}`,
    })
  })

  test("greets a returning user for /start and /help without creating another row", async () => {
    await bot.handleUpdate(
      buildUpdate({
        messageId: 201,
        text: "/start",
        updateId: 2,
        userId: 1002,
        username: "returning_user",
      }),
    )
    api.clearCalls()

    await bot.handleUpdate(
      buildUpdate({
        messageId: 202,
        text: "/start",
        updateId: 3,
        userId: 1002,
        username: "returning_user",
      }),
    )
    await bot.handleUpdate(
      buildUpdate({
        messageId: 203,
        text: "/help",
        updateId: 4,
        userId: 1002,
        username: "returning_user",
      }),
    )

    const rows = await db.select().from(users)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.telegramId).toBe("1002")

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(2)
    expect(replies[0]?.params.text).toBe(`Hello, Test!\n\n${HELP_TEXT}`)
    expect(replies[1]?.params.text).toBe(`Hello, Test!\n\n${HELP_TEXT}`)
  })

  test("asks for a username and does not register the user", async () => {
    await bot.handleUpdate(
      buildUpdate({ messageId: 301, text: "/start", updateId: 5, userId: 1003 }),
    )

    expect(await db.select().from(users)).toHaveLength(0)

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(1)
    expect(replies[0]?.params.text).toBe("Please set a username to use this bot.")
  })

  test("processes two updates from the same user in order", async () => {
    const first = bot.handleUpdate(
      buildUpdate({
        messageId: 401,
        text: "/start",
        updateId: 6,
        userId: 1004,
        username: "concurrent_user",
      }),
    )
    const second = bot.handleUpdate(
      buildUpdate({
        messageId: 402,
        text: "/start",
        updateId: 7,
        userId: 1004,
        username: "concurrent_user",
      }),
    )
    await Promise.all([first, second])

    expect(await db.select().from(users)).toHaveLength(1)

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(2)
    expect(String(replies[0]?.params.text)).toStartWith("Welcome, ")
    expect(String(replies[1]?.params.text)).toStartWith("Hello, ")
  })

  test("rolls back registration and logs the failure when the welcome reply fails", async () => {
    api.failNext("sendMessage")

    await bot.handleUpdate(
      buildUpdate({
        messageId: 501,
        text: "/start",
        updateId: 8,
        userId: 1005,
        username: "rollback_user",
      }),
    )

    expect(await db.select().from(users)).toHaveLength(0)

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(2)
    expect(String(replies[0]?.params.text)).toStartWith("Welcome, ")
    expect(replies[1]?.params.text).toBe("An error occurred. Please try again.")

    const failures = loggedErrorMessages(events)
    expect(failures.some((message) => message.includes("sendMessage"))).toBe(true)
  })

  test("ignores a non-command message from a registered user", async () => {
    await bot.handleUpdate(
      buildUpdate({
        messageId: 601,
        text: "/start",
        updateId: 9,
        userId: 1006,
        username: "quiet_user",
      }),
    )
    api.clearCalls()

    await bot.handleUpdate(
      buildUpdate({
        messageId: 602,
        text: "hello there",
        updateId: 10,
        userId: 1006,
        username: "quiet_user",
      }),
    )

    expect(api.callsFor("sendMessage")).toHaveLength(0)
    expect(await db.select().from(users)).toHaveLength(1)
    expect(events).toHaveLength(0)
  })

  test("ignores and logs a message without a sender", async () => {
    await bot.handleUpdate(buildSenderlessUpdate(11, 701, -100_000))

    expect(api.callsFor("sendMessage")).toHaveLength(0)
    expect(await db.select().from(users)).toHaveLength(0)
    expect(loggedErrorMessages(events)).toContain("Message without a sender")
  })
})
