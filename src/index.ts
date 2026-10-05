import { run } from "@grammyjs/runner"
import { Config, ConfigProvider, Effect } from "effect"
import { createLogger } from "evlog"

import { createBot } from "@/bot/bot"
import { AppConfiguration, tokenValue } from "@/config"
import { Database } from "@/db/database"
import { initLogging } from "@/logger"
import { runtime } from "@/runtime"
import { startWebhookRuntime } from "@/server"

const environment = await Effect.runPromise(
  Config.String("NODE_ENV").pipe(
    Config.withDefault("development"),
    Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv())),
  ),
)

initLogging(environment)

const config = await runtime.runPromise(AppConfiguration)
const database = await runtime.runPromise(Database)

const bot = createBot({
  adminUsername: config.adminUsername,
  apiToken: tokenValue(config),
  database,
})

const startupLog = createLogger({ operation: "startup" })
startupLog.set({
  domain: config.domain,
  mainBotPath: config.mainBotPath,
  pollType: config.pollType,
})

const botCommands = [
  { command: "start", description: "Start the bot" },
  { command: "menu", description: "Main menu" },
  { command: "packs", description: "My sticker packs" },
  { command: "add", description: "How to add stickers" },
  { command: "remove", description: "Remove a sticker" },
  { command: "help", description: "Help" },
  { command: "cancel", description: "Cancel the current action" },
]

try {
  await bot.api.setMyCommands(botCommands)
} catch (error) {
  startupLog.set({ commandsError: error instanceof Error ? error.message : String(error) })
}

let runner: ReturnType<typeof run> | null = null
let server: Awaited<ReturnType<typeof startWebhookRuntime>> | null = null

if (config.pollType === "WEBHOOK") {
  server = await startWebhookRuntime({ bot, config })
  startupLog.set({ event: "server_started", port: server.port })
} else {
  runner = run(bot)
  startupLog.set({ event: "polling_started" })
}

startupLog.emit()

const shutdown = async (signal: string): Promise<void> => {
  const log = createLogger({ operation: "shutdown" })
  log.set({ signal })
  await runner?.stop()
  await server?.stop(true)
  await runtime.dispose()
  log.set({ event: "shutdown_complete" })
  log.emit()
  process.exit(0)
}

process.on("SIGINT", () => {
  void shutdown("SIGINT")
})

process.on("SIGTERM", () => {
  void shutdown("SIGTERM")
})
