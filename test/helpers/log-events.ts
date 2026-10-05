import type { WideEvent } from "evlog"

const loggedErrorMessages = (loggedEvents: WideEvent[]): string[] =>
  loggedEvents.flatMap((event) => {
    const error = event.error
    if (typeof error !== "object" || error === null || !("message" in error)) {
      return []
    }
    return typeof error.message === "string" ? [error.message] : []
  })

export { loggedErrorMessages }
