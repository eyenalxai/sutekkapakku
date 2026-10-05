import type { InputSticker, User as TelegramUser } from "grammy/types"

import type { BotContext } from "@/bot/context"
import type { StickerSetType, User } from "@/db/schema"

import { buildStickerSetName, buildStickerSetTitle } from "@/bot/sticker-pack"
import { createStickerSet, getStickerSetForUserByType } from "@/db/queries/sticker-sets"

interface AddStickerToUserPackParams {
  user: User
  telegramUser: TelegramUser
  telegramUsername: string
  stickerSetType: StickerSetType
  sticker: InputSticker
}

const addStickerToUserPack = async (
  ctx: BotContext,
  params: AddStickerToUserPackParams,
): Promise<void> => {
  const { sticker, stickerSetType, telegramUser, telegramUsername, user } = params
  const stickerSet = await getStickerSetForUserByType(ctx.dbTx, user.id, stickerSetType)
  if (stickerSet === undefined) {
    const botUser = await ctx.api.getMe()
    if (botUser.username === undefined || botUser.username.length === 0) {
      throw new Error("Bot username is not set!")
    }
    const name = buildStickerSetName(telegramUsername, botUser.username)
    const title = buildStickerSetTitle(stickerSetType, telegramUsername)
    const created = await createStickerSet(ctx.dbTx, {
      name,
      title,
      stickerSetType,
      userId: user.id,
    })
    if (created === undefined) {
      throw new Error("Failed to create sticker set row")
    }
    await ctx.api.createNewStickerSet(telegramUser.id, created.name, created.title, [sticker])
    await ctx.reply(
      `Sticker pack created!\n\nLink: <a href='https://t.me/addstickers/${created.name}'>${created.title}</a>`,
      { parse_mode: "HTML" },
    )
    return
  }
  await ctx.api.addStickerToSet(telegramUser.id, stickerSet.name, sticker)
  await ctx.reply(
    `Sticker added to the pack.\n\nLink: <a href='https://t.me/addstickers/${stickerSet.name}'>${stickerSet.title}</a>`,
    { parse_mode: "HTML" },
  )
}

export { addStickerToUserPack }
export type { AddStickerToUserPackParams }
