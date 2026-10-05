import type { Sticker } from "grammy/types"

import { Effect } from "effect"
import { createLogger } from "evlog"

import type { BotContext } from "@/bot/context"

import { clearFlow, getActiveFlow } from "@/bot/flows"
import { notify } from "@/bot/notify"
import { Packs } from "@/bot/packs"
import {
  NOT_REGISTERED_REPLY,
  PACK_INVALID_REPLY,
  STICKER_NOT_IN_PACK_REPLY,
  STICKER_REMOVED_REPLY,
  buildStickerSetNotModifiedReply,
} from "@/bot/replies"
import { runHandler } from "@/bot/run"
import { buildStickerInput } from "@/bot/sticker-files"
import { detectStickerSetType } from "@/bot/sticker-pack"
import { Users } from "@/bot/users"

interface StickerHandlerOptions {
  adminUsername: string
}

const logIgnoredSticker = (ctx: BotContext, userId: number): void => {
  const log = createLogger({ operation: "sticker_without_emoji" })
  log.set({ updateId: ctx.update.update_id, userId })
  log.emit()
}

const removeSticker = (chatId: number, sticker: Sticker, volumeId: number, adminUsername: string) =>
  Effect.gen(function* removeStickerEffect() {
    const packs = yield* Packs
    const stickerSetName = sticker.set_name
    if (stickerSetName === undefined) {
      return
    }
    const outcome = yield* packs
      .removeSticker({ stickerSetName, stickerId: sticker.file_id, volumeId })
      .pipe(
        Effect.as("REMOVED" as const),
        Effect.catchTag("StickerSetNotModified", () => Effect.succeed("NOT_MODIFIED" as const)),
        Effect.catchTag("StickerSetInvalid", () => Effect.succeed("INVALID" as const)),
      )
    if (outcome === "INVALID") {
      yield* packs.archiveVolume(volumeId, "INVALID")
      yield* notify(chatId, PACK_INVALID_REPLY)
      return
    }
    if (outcome === "NOT_MODIFIED") {
      yield* notify(chatId, buildStickerSetNotModifiedReply(adminUsername), {
        parse_mode: "HTML",
      })
      return
    }
    yield* notify(chatId, STICKER_REMOVED_REPLY)
  })

const createStickerHandler =
  ({ adminUsername }: StickerHandlerOptions) =>
  async (ctx: BotContext): Promise<void> => {
    const from = ctx.from
    const sticker = ctx.message?.sticker
    const chatId = ctx.chat?.id
    if (from === undefined || sticker === undefined || chatId === undefined) {
      return
    }

    const emoji = sticker.emoji
    if (emoji === undefined || emoji.length === 0) {
      logIgnoredSticker(ctx, from.id)
      return
    }

    const flow = getActiveFlow(ctx)
    await runHandler(
      ctx,
      Effect.gen(function* stickerHandlerEffect() {
        const users = yield* Users
        const packs = yield* Packs

        const user = yield* users.findByTelegramId(String(from.id))
        if (user === undefined) {
          yield* notify(chatId, NOT_REGISTERED_REPLY)
          return
        }

        if (flow?.kind === "remove") {
          clearFlow(ctx)
          const volumes = yield* packs.listVolumes(user.id)
          const target =
            flow.volumeId === undefined
              ? volumes.find((volume) => volume.name === sticker.set_name)
              : volumes.find((volume) => volume.id === flow.volumeId)
          if (target === undefined || target.name !== sticker.set_name) {
            yield* notify(chatId, STICKER_NOT_IN_PACK_REPLY)
            return
          }
          yield* removeSticker(chatId, sticker, target.id, adminUsername)
          return
        }

        const volumes = yield* packs.listVolumes(user.id)
        const ownVolume = volumes.find((volume) => volume.name === sticker.set_name)
        if (ownVolume !== undefined) {
          yield* removeSticker(chatId, sticker, ownVolume.id, adminUsername)
          return
        }

        const telegramUsername = from.username
        if (telegramUsername === undefined || telegramUsername.length === 0) {
          return
        }

        const stickerSetType = detectStickerSetType(sticker)
        const stickerInput = yield* buildStickerInput({ sticker, stickerSetType, emoji })

        yield* packs.addSticker({
          chatId,
          user,
          telegramUser: from,
          telegramUsername,
          sticker: stickerInput,
          stickerSetType,
        })
      }),
    )
  }

export { createStickerHandler }
