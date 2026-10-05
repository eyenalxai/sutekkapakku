import type { LogLevel } from "effect"
import type { DrainFn } from "evlog"

import { Cause, Logger, Option, References } from "effect"
import { createLogger, initLogger } from "evlog"

const initLogging = (environment: string, drain?: DrainFn): void => {
  initLogger({
    env: {
      service: "sutekkapakku",
      environment,
    },
    ...(drain === undefined ? {} : { drain }),
  })
}

const EVLOG_LEVELS = {
  All: "debug",
  Fatal: "error",
  Error: "error",
  Warn: "warn",
  Info: "info",
  Debug: "debug",
  Trace: "debug",
  None: "info",
} as const satisfies Record<LogLevel.LogLevel, "debug" | "error" | "warn" | "info">

const formatMessage = (message: unknown): string =>
  Array.isArray(message)
    ? message.map((part) => (typeof part === "string" ? part : JSON.stringify(part))).join(" ")
    : String(message)

const evlogEffectLogger = Logger.make((options) => {
  const annotations = options.fiber.getRef(References.CurrentLogAnnotations)
  const operation = typeof annotations.operation === "string" ? annotations.operation : "effect"
  const log = createLogger({ operation })
  log.set({
    ...annotations,
    level: EVLOG_LEVELS[options.logLevel],
    message: formatMessage(options.message),
    date: options.date.toISOString(),
  })
  const error = Cause.findErrorOption(options.cause)
  if (Option.isSome(error)) {
    log.error(error.value instanceof Error ? error.value : new Error(String(error.value)))
  }
  log.emit()
})

const effectLoggerLayer = Logger.layer([evlogEffectLogger])

export { effectLoggerLayer, initLogging }
