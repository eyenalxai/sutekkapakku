import { initLogger } from "evlog"

export const initLogging = (): void => {
  initLogger({
    env: {
      service: "sutekkapakku",
      environment: Bun.env.NODE_ENV ?? "development",
    },
  })
}
