import type { WideEvent } from "evlog"
import type { Update } from "grammy/types"

import { createTestDatabase } from "@test/db/test-database"
import { createFakeTelegramApi } from "@test/helpers/telegram-api"
import { afterAll, beforeEach, describe, expect, test } from "bun:test"

import type { Config } from "@/config"

import { createBot } from "@/bot/bot"
import { users } from "@/db/schema"
import { initLogging } from "@/logger"
import { startWebhookRuntime } from "@/server"

const ADMIN_USERNAME = "sutekkapakku_admin"
const API_TOKEN = "424242:fake-token"
const DOMAIN = "bot.example.test"
const MAIN_BOT_PATH = "/webhook/main"
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

const config: Config = {
  adminUsername: ADMIN_USERNAME,
  apiToken: API_TOKEN,
  databaseUrl: database.databaseUrl,
  domain: DOMAIN,
  mainBotPath: MAIN_BOT_PATH,
  pollType: "WEBHOOK",
  port: 0,
}

const bot = createBot({
  adminUsername: ADMIN_USERNAME,
  apiRoot: api.apiRoot,
  apiToken: API_TOKEN,
  db,
})

const servers: Awaited<ReturnType<typeof startWebhookRuntime>>[] = []

const startRuntime = async (): Promise<(typeof servers)[number]> => {
  const server = await startWebhookRuntime({ bot, config })
  servers.push(server)
  return server
}

const serverUrl = (server: (typeof servers)[number], path: string): string =>
  `http://127.0.0.1:${server.port}${path}`

beforeEach(async () => {
  await db.delete(users)
  api.clearCalls()
  events.length = 0
})

afterAll(async () => {
  await Promise.all(
    servers.map(async (server) => {
      await server.stop(true)
    }),
  )
  await api.stop()
  await database.close()
})

describe("webhook runtime", () => {
  test("starts the server, registers the webhook and serves /health", async () => {
    const server = await startRuntime()

    const webhookCalls = api.callsFor("setWebhook")
    expect(webhookCalls).toHaveLength(1)
    expect(webhookCalls[0]?.params).toMatchObject({ url: `https://${DOMAIN}${MAIN_BOT_PATH}` })

    const health = await fetch(serverUrl(server, "/health"))
    expect(health.status).toBe(200)
    expect(await health.json()).toEqual({ status: "ok" })

    const unknown = await fetch(serverUrl(server, "/webhook/other"))
    expect(unknown.status).toBe(404)
  })

  test("processes a /start update posted to the webhook path", async () => {
    const server = await startRuntime()

    const response = await fetch(serverUrl(server, MAIN_BOT_PATH), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        buildUpdate({
          firstName: "Webhook",
          lastName: "User",
          messageId: 101,
          text: "/start",
          updateId: 1,
          userId: 3001,
          username: "webhook_user",
        }),
      ),
    })
    expect(response.status).toBe(200)

    const rows = await db.select().from(users)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.telegramId).toBe("3001")

    const replies = api.callsFor("sendMessage")
    expect(replies).toHaveLength(1)
    expect(replies[0]?.params).toMatchObject({
      chat_id: 3001,
      parse_mode: "HTML",
      text: `Welcome, Webhook User!\n\n${HELP_TEXT}`,
    })
  })

  test("logs a setWebhook failure without crashing the runtime", async () => {
    api.failNext("setWebhook")

    const server = await startRuntime()

    const health = await fetch(serverUrl(server, "/health"))
    expect(health.status).toBe(200)

    const failures = loggedErrorMessages(events)
    expect(failures.some((message) => message.includes("setWebhook"))).toBe(true)
  })
})
