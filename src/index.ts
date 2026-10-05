import { createLogger } from "evlog"

import { loadConfig } from "@/config"
import { initLogging } from "@/logger"
import { startServer } from "@/server"

const config = loadConfig(Bun.env)

initLogging()

const server = startServer({ port: config.port })

const startupLog = createLogger({ operation: "startup" })

startupLog.set({
  event: "server_started",
  port: config.port,
  pollType: config.pollType,
  domain: config.domain,
  mainBotPath: config.mainBotPath,
})
startupLog.emit()

const shutdown = async (): Promise<void> => {
  await server.stop(true)
  process.exit(0)
}

process.on("SIGINT", () => {
  void shutdown()
})

process.on("SIGTERM", () => {
  void shutdown()
})
