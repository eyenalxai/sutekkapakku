import type { Update } from "grammy/types"

import { run } from "@grammyjs/runner"
import { createTestDatabase } from "@test/db/test-database"
import { createFakeTelegramApi } from "@test/helpers/telegram-api"
import { afterAll, beforeEach, describe, expect, test } from "bun:test"

import { createBot } from "@/bot/bot"
import { users } from "@/db/schema"

const ADMIN_USERNAME = "sutekkapakku_admin"
const API_TOKEN = "424242:fake-token"
const POLL_INTERVAL_MS = 25
const POLL_TIMEOUT_MS = 10_000

interface MessageOptions {
  updateId: number
  messageId: number
  userId: number
  text: string
  firstName?: string
  lastName?: string
  username?: string
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

const waitForCondition = async (
  condition: () => boolean | Promise<boolean>,
  deadline: number,
  description: string,
): Promise<void> => {
  if (await condition()) {
    return
  }
  if (Date.now() > deadline) {
    throw new Error(`Timed out waiting for ${description}`)
  }
  await Bun.sleep(POLL_INTERVAL_MS)
  await waitForCondition(condition, deadline, description)
}

const database = await createTestDatabase()
const { db } = database
const api = createFakeTelegramApi()

const bot = createBot({
  adminUsername: ADMIN_USERNAME,
  apiRoot: api.apiRoot,
  apiToken: API_TOKEN,
  db,
})

beforeEach(async () => {
  await db.delete(users)
  api.clearCalls()
})

afterAll(async () => {
  await api.stop()
  await database.close()
})

describe("polling runtime", () => {
  test("run consumes a /start update from the fake api and stops cleanly", async () => {
    api.enqueueUpdate({
      ...buildUpdate({
        firstName: "Polling",
        lastName: "User",
        messageId: 101,
        text: "/start",
        updateId: 1,
        userId: 2001,
        username: "polling_user",
      }),
    })

    const runner = run(bot)
    try {
      await waitForCondition(
        async () => {
          const rows = await db.select().from(users)
          return rows.length === 1
        },
        Date.now() + POLL_TIMEOUT_MS,
        "user registration",
      )
      await waitForCondition(
        () => api.callsFor("sendMessage").length === 1,
        Date.now() + POLL_TIMEOUT_MS,
        "welcome reply",
      )
    } finally {
      await runner.stop()
    }

    expect(runner.isRunning()).toBe(false)

    const rows = await db.select().from(users)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.telegramId).toBe("2001")

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(1)
    expect(replies[0]?.params.text).toStartWith("Welcome, Polling User!")

    const updateCalls = api.callsFor("getUpdates")
    expect(updateCalls.length).toBeGreaterThan(0)
    expect(updateCalls[0]?.params).toMatchObject({ offset: 0, timeout: 30 })
  })
})
