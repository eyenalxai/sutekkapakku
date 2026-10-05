import type { Bot } from "grammy"

import { createLogger } from "evlog"
import { webhookCallback } from "grammy"

import type { BotContext } from "@/bot/context"
import type { AppConfigShape } from "@/config"

interface StartServerOptions {
  bot: Bot<BotContext>
  config: AppConfigShape
}

interface WebhookRuntimeOptions {
  bot: Bot<BotContext>
  config: AppConfigShape
}

const HEALTH_PATH = "/health"

const startServer = ({ bot, config }: StartServerOptions) => {
  const handleWebhook = webhookCallback(bot, "bun")
  return Bun.serve({
    port: config.port,
    fetch: async (request) => {
      try {
        const { pathname } = new URL(request.url)
        if (request.method === "GET" && pathname === HEALTH_PATH) {
          return Response.json({ status: "ok" })
        }
        if (request.method === "POST" && pathname === config.mainBotPath) {
          return await handleWebhook(request)
        }
        return new Response("Not Found", { status: 404 })
      } catch (error) {
        const log = createLogger({ operation: "webhook_error" })
        log.error(error instanceof Error ? error : new Error(String(error)))
        log.emit()
        return new Response("Internal Server Error", { status: 500 })
      }
    },
  })
}

const buildWebhookUrl = (config: AppConfigShape): string =>
  `https://${config.domain}${config.mainBotPath}`

const setWebhookSafely = async (bot: Bot<BotContext>, url: string): Promise<boolean> => {
  const log = createLogger({ operation: "set_webhook" })
  log.set({ url })
  try {
    await bot.api.setWebhook(url)
    log.set({ registered: true })
    log.emit()
    return true
  } catch (error) {
    log.error(error instanceof Error ? error : new Error(String(error)))
    log.set({ registered: false })
    log.emit()
    return false
  }
}

const startWebhookRuntime = async ({ bot, config }: WebhookRuntimeOptions) => {
  const server = startServer({ bot, config })
  await setWebhookSafely(bot, buildWebhookUrl(config))
  return server
}

export { buildWebhookUrl, setWebhookSafely, startServer, startWebhookRuntime }
export type { StartServerOptions, WebhookRuntimeOptions }
