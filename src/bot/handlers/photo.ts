import type { BotContext } from "@/bot/context"

import { firstEmoji } from "@/bot/emoji"
import { getLargestPhoto, resizePhotoToStickerJpeg } from "@/bot/photos"
import { buildPhotoStickerInput, downloadTelegramFileByFileId } from "@/bot/sticker-files"
import { addStickerToUserPack } from "@/bot/sticker-set-service"
import { getUserByTelegramId } from "@/db/queries/users"

const CAPTION_PROMPT = "Please add a caption with an emoji to your picture (e.g. 🥰)"
const EMOJI_PROMPT = "Your caption does not contain an emoji 🥲"
const NOT_REGISTERED_PROMPT = "You are not registered yet.\nPlease use /start command.."

interface PhotoHandlerDependencies {
  fileApiRoot: string
}

const createPhotoHandler =
  ({ fileApiRoot }: PhotoHandlerDependencies) =>
  async (ctx: BotContext): Promise<void> => {
    const from = ctx.from
    const message = ctx.message
    if (from === undefined || message === undefined) {
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

    const user = await getUserByTelegramId(ctx.dbTx, String(from.id))
    if (user === undefined) {
      await ctx.reply(NOT_REGISTERED_PROMPT)
      return
    }

    const largestPhoto = getLargestPhoto(photo)
    const bytes = await downloadTelegramFileByFileId({
      api: ctx.api,
      fileApiRoot,
      fileId: largestPhoto.file_id,
      token: ctx.api.token,
    })
    const stickerBytes = await resizePhotoToStickerJpeg(bytes)
    const sticker = buildPhotoStickerInput(
      stickerBytes,
      `${largestPhoto.file_unique_id}.png`,
      emoji,
    )
    await addStickerToUserPack(ctx, {
      sticker,
      stickerSetType: "REGULAR",
      telegramUser: from,
      telegramUsername: username,
      user,
    })
  }

export { createPhotoHandler }
