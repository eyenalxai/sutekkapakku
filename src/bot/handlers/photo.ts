import { Effect } from "effect"

import type { BotContext } from "@/bot/context"

import { firstEmoji } from "@/bot/emoji"
import { notify } from "@/bot/notify"
import { getLargestPhoto, resizePhotoToStickerJpeg } from "@/bot/photos"
import { runHandler } from "@/bot/run"
import { buildPhotoStickerInput } from "@/bot/sticker-files"
import { addStickerToUserPack } from "@/bot/sticker-set-service"
import { TelegramApi } from "@/bot/telegram-api"
import { Users } from "@/bot/users"

const CAPTION_PROMPT = "Please add a caption with an emoji to your picture (e.g. 🥰)"
const EMOJI_PROMPT = "Your caption does not contain an emoji 🥲"
const NOT_REGISTERED_PROMPT = "You are not registered yet.\nPlease use /start command.."

const createPhotoHandler =
  () =>
  async (ctx: BotContext): Promise<void> => {
    const from = ctx.from
    const message = ctx.message
    const chatId = ctx.chat?.id
    if (from === undefined || message === undefined || chatId === undefined) {
      return
    }

    const username = from.username
    if (username === undefined || username.length === 0) {
      return
    }

    const photo = message.photo
    if (photo === undefined) {
      return
    }

    const caption = message.caption
    if (caption === undefined || caption.length === 0) {
      await ctx.reply(CAPTION_PROMPT)
      return
    }

    const emoji = firstEmoji(caption)
    if (emoji === undefined) {
      await ctx.reply(EMOJI_PROMPT)
      return
    }

    await runHandler(
      ctx,
      Effect.gen(function* photoHandlerEffect() {
        const users = yield* Users
        const telegram = yield* TelegramApi

        const user = yield* users.findByTelegramId(String(from.id))
        if (user === undefined) {
          yield* notify(chatId, NOT_REGISTERED_PROMPT)
          return
        }

        const largestPhoto = getLargestPhoto(photo)
        const bytes = yield* telegram.downloadFile(largestPhoto.file_id)
        const stickerBytes = yield* Effect.promise(() => resizePhotoToStickerJpeg(bytes))
        const sticker = buildPhotoStickerInput(
          stickerBytes,
          `${largestPhoto.file_unique_id}.png`,
          emoji,
        )
        yield* addStickerToUserPack({
          chatId,
          sticker,
          stickerSetType: "REGULAR",
          telegramUser: from,
          telegramUsername: username,
          user,
        })
      }),
    )
  }

export { createPhotoHandler }
