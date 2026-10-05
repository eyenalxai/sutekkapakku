import type { Sticker } from "grammy/types"

import { createLogger } from "evlog"
import { GrammyError } from "grammy"

import type { BotContext } from "@/bot/context"

import { buildStickerInput } from "@/bot/sticker-files"
import { detectStickerSetType } from "@/bot/sticker-pack"
import { addStickerToUserPack } from "@/bot/sticker-set-service"
import { getStickerSetForUserByType } from "@/db/queries/sticker-sets"
import { getUserByTelegramId } from "@/db/queries/users"

interface StickerHandlerOptions {
  adminUsername: string
  fileApiRoot: string
}

const NOT_REGISTERED_REPLY = "You are not registered yet.\nPlease use /start command.."
const STICKER_REMOVED_REPLY =
  "Sticker removed from the pack. It may take a few minutes for sticker pack to update."
const STICKERSET_NOT_MODIFIED = "STICKERSET_NOT_MODIFIED"

const buildStickerSetNotModifiedReply = (adminUsername: string): string =>
  "It seems like you tried to remove a sticker from the pack, but it wasn't in the pack due to a bug in Telegram, most likely. Please wait 15 minutes and check if sticker is in your pack still.\n" +
  "If it is, please contact me!\n\n" +
  `<a href='https://t.me/${adminUsername}'>Contact</a>`

const logIgnoredSticker = (ctx: BotContext, userId: number): void => {
  const log = createLogger({ operation: "sticker_without_emoji" })
  log.set({ updateId: ctx.update.update_id, userId })
  log.emit()
}

const removeSticker = async (
  ctx: BotContext,
  sticker: Sticker,
  adminUsername: string,
): Promise<void> => {
  try {
    await ctx.api.deleteStickerFromSet(sticker.file_id)
  } catch (error) {
    if (error instanceof GrammyError && error.description.includes(STICKERSET_NOT_MODIFIED)) {
      await ctx.reply(buildStickerSetNotModifiedReply(adminUsername), { parse_mode: "HTML" })
      return
    }
    throw error
  }

  await ctx.reply(STICKER_REMOVED_REPLY)
}

const createStickerHandler =
  ({ adminUsername, fileApiRoot }: StickerHandlerOptions) =>
  async (ctx: BotContext): Promise<void> => {
    const from = ctx.from
    const sticker = ctx.message?.sticker
    if (from === undefined || sticker === undefined) {
      return
    }

    const emoji = sticker.emoji
    if (emoji === undefined || emoji.length === 0) {
      logIgnoredSticker(ctx, from.id)
      return
    }

    const user = await getUserByTelegramId(ctx.dbTx, String(from.id))
    if (user === undefined) {
      await ctx.reply(NOT_REGISTERED_REPLY)
      return
    }

    const stickerSetType = detectStickerSetType(sticker)
    const existingSet = await getStickerSetForUserByType(ctx.dbTx, user.id, stickerSetType)
    if (existingSet !== undefined && sticker.set_name === existingSet.name) {
      await removeSticker(ctx, sticker, adminUsername)
      return
    }

    const telegramUsername = from.username
    if (telegramUsername === undefined || telegramUsername.length === 0) {
      return
    }

    const stickerInput = await buildStickerInput({
      api: ctx.api,
      emoji,
      fileApiRoot,
      sticker,
      stickerSetType,
      token: ctx.api.token,
    })

    await addStickerToUserPack(ctx, {
      sticker: stickerInput,
      stickerSetType,
      telegramUser: from,
      telegramUsername,
      user,
    })
  }

export { createStickerHandler }
