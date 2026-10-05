import type { Sticker } from "grammy/types"

import { Effect } from "effect"
import { createLogger } from "evlog"

import type { BotContext } from "@/bot/context"

import { notify } from "@/bot/notify"
import { Packs } from "@/bot/packs"
import { runHandler } from "@/bot/run"
import { buildStickerInput } from "@/bot/sticker-files"
import { detectStickerSetType } from "@/bot/sticker-pack"
import { Users } from "@/bot/users"

interface StickerHandlerOptions {
  adminUsername: string
}

const NOT_REGISTERED_REPLY = "You are not registered yet.\nPlease use /start command.."
const STICKER_REMOVED_REPLY =
  "Sticker removed from the pack. It may take a few minutes for sticker pack to update."

const buildStickerSetNotModifiedReply = (adminUsername: string): string =>
  "It seems like you tried to remove a sticker from the pack, but it wasn't in the pack due to a bug in Telegram, most likely. Please wait 15 minutes and check if sticker is in your pack still.\n" +
  "If it is, please contact me!\n\n" +
  `<a href='https://t.me/${adminUsername}'>Contact</a>`

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
    const notModified = yield* packs
      .removeSticker({ stickerSetName, stickerId: sticker.file_id, volumeId })
      .pipe(
        Effect.as(false),
        Effect.catchTag("StickerSetNotModified", () => Effect.succeed(true)),
      )
    if (notModified) {
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
export type { StickerHandlerOptions }
