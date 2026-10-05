import { Effect } from "effect"

import type { SendMessageOptions } from "@/bot/telegram-api"

import { TelegramApi } from "@/bot/telegram-api"

const notify = (
  chatId: number | string,
  text: string,
  options?: SendMessageOptions,
): Effect.Effect<void, never, TelegramApi> =>
  Effect.gen(function* notifyEffect() {
    const telegram = yield* TelegramApi
    yield* telegram.sendMessage(chatId, text, options).pipe(
      Effect.catchTag("ChatUnavailable", (error) =>
        Effect.logDebug("chat unavailable").pipe(
          Effect.annotateLogs({ method: error.method, description: error.description }),
        ),
      ),
      Effect.catchTag("TelegramApiError", (error) =>
        Effect.logError("send failed").pipe(
          Effect.annotateLogs({ method: error.method, description: error.description }),
        ),
      ),
    )
  })

export { notify }
