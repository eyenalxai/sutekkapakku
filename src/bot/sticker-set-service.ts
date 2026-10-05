import type { InputSticker, User as TelegramUser } from "grammy/types"

import { Effect } from "effect"

import type { StickerSetType, User } from "@/db/schema"

import { notify } from "@/bot/notify"
import { buildStickerSetName, buildStickerSetTitle } from "@/bot/sticker-pack"
import { TelegramApi } from "@/bot/telegram-api"
import { DbExecutor, runQuery } from "@/db/database"
import { createStickerSet, getStickerSetForUserByType } from "@/db/queries/sticker-sets"

interface AddStickerToUserPackParams {
  readonly chatId: number
  readonly user: User
  readonly telegramUser: TelegramUser
  readonly telegramUsername: string
  readonly stickerSetType: StickerSetType
  readonly sticker: InputSticker
}

const addStickerToUserPack = (params: AddStickerToUserPackParams) =>
  Effect.gen(function* addStickerToUserPackEffect() {
    const { chatId, sticker, stickerSetType, telegramUser, telegramUsername, user } = params
    const telegram = yield* TelegramApi
    const { executor } = yield* DbExecutor
    const stickerSet = yield* runQuery("getStickerSetForUserByType", () =>
      getStickerSetForUserByType(executor, user.id, stickerSetType),
    )
    if (stickerSet === undefined) {
      const botUser = yield* telegram.getMe()
      if (botUser.username === undefined || botUser.username.length === 0) {
        yield* Effect.die(new Error("Bot username is not set!"))
        return
      }
      const name = buildStickerSetName(telegramUsername, botUser.username)
      const title = buildStickerSetTitle(stickerSetType, telegramUsername)
      const created = yield* runQuery("createStickerSet", () =>
        createStickerSet(executor, { name, title, stickerSetType, userId: user.id }),
      )
      if (created === undefined) {
        yield* Effect.die(new Error("Failed to create sticker set row"))
        return
      }
      yield* telegram.createNewStickerSet(telegramUser.id, created.name, created.title, [sticker])
      yield* notify(
        chatId,
        `Sticker pack created!\n\nLink: <a href='https://t.me/addstickers/${created.name}'>${created.title}</a>`,
        { parse_mode: "HTML" },
      )
      return
    }
    yield* telegram.addStickerToSet(telegramUser.id, stickerSet.name, sticker)
    yield* notify(
      chatId,
      `Sticker added to the pack.\n\nLink: <a href='https://t.me/addstickers/${stickerSet.name}'>${stickerSet.title}</a>`,
      { parse_mode: "HTML" },
    )
  })

export { addStickerToUserPack }
export type { AddStickerToUserPackParams }
