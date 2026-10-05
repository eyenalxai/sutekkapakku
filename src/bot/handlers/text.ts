import { Effect } from "effect"

import type { BotContext } from "@/bot/context"

import { clearFlow, getActiveFlow } from "@/bot/flows"
import { notify } from "@/bot/notify"
import { Packs } from "@/bot/packs"
import { escapeHtml, packPanel, showPanel } from "@/bot/panels"
import { NOT_REGISTERED_REPLY } from "@/bot/replies"
import { runHandler } from "@/bot/run"
import { Users } from "@/bot/users"

const createTextHandler =
  () =>
  async (ctx: BotContext): Promise<void> => {
    const from = ctx.from
    const chatId = ctx.chat?.id
    const text = ctx.message?.text
    if (from === undefined || chatId === undefined || text === undefined) {
      return
    }
    const flow = getActiveFlow(ctx)
    if (flow?.kind !== "rename") {
      return
    }
    await runHandler(
      Effect.gen(function* textHandlerEffect() {
        const users = yield* Users
        const packs = yield* Packs
        const user = yield* users.findByTelegramId(String(from.id))
        if (user === undefined) {
          yield* notify(chatId, NOT_REGISTERED_REPLY)
          return
        }
        const result = yield* packs.renameVolume(flow.volumeId, text).pipe(
          Effect.map((volume) => ({ kind: "renamed" as const, volume })),
          Effect.catchTag("VolumeTitleInvalid", (error) =>
            notify(
              chatId,
              `Titles must be ${error.minimum}–${error.maximum} characters long. Try again.`,
            ).pipe(Effect.as({ kind: "retry" as const })),
          ),
          Effect.catchTag("VolumeTitleTaken", (error) =>
            notify(chatId, `The title "${error.title}" is already taken. Try another one.`).pipe(
              Effect.as({ kind: "retry" as const }),
            ),
          ),
          Effect.catchTag("StickerSetInvalid", () =>
            notify(
              chatId,
              "That pack is no longer available on Telegram, so it can't be renamed.",
            ).pipe(Effect.as({ kind: "retry" as const })),
          ),
        )
        if (result.kind === "retry") {
          return
        }
        clearFlow(ctx)
        yield* notify(chatId, `Renamed to <b>${escapeHtml(result.volume.title)}</b>.`, {
          parse_mode: "HTML",
        })
        yield* showPanel(chatId, undefined, packPanel(result.volume))
      }),
    )
  }

export { createTextHandler }
