import { run } from "@grammyjs/runner"
import { createLogger } from "evlog"

import { createBot } from "@/bot/bot"
import { loadConfig } from "@/config"
import { createDb } from "@/db/client"
import { initLogging } from "@/logger"
import { startWebhookRuntime } from "@/server"

const config = loadConfig(Bun.env)

initLogging()

const db = createDb(config.databaseUrl)

const bot = createBot({
  adminUsername: config.adminUsername,
  apiToken: config.apiToken,
  db,
})

const startupLog = createLogger({ operation: "startup" })
startupLog.set({
  domain: config.domain,
  mainBotPath: config.mainBotPath,
  pollType: config.pollType,
})

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
