import type { DrainFn } from "evlog"

import { initLogger } from "evlog"

export const initLogging = (drain?: DrainFn): void => {
  initLogger({
    env: {
      service: "sutekkapakku",
      environment: Bun.env.NODE_ENV ?? "development",
    },
    ...(drain === undefined ? {} : { drain }),
  })
}
