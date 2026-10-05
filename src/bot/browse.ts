import { Effect } from "effect"

import type { BotContext } from "@/bot/context"
import type { PacksInterface } from "@/bot/packs"
import type { StickerSet, User } from "@/db/schema"

import { startFlow } from "@/bot/flows"
import { loadVolumes } from "@/bot/handlers/shared"
import { notify } from "@/bot/notify"
import { browseKeyboard, packsPanel, showPanel } from "@/bot/panels"
import { buildStickerSetNotModifiedReply } from "@/bot/replies"
import { TelegramApi } from "@/bot/telegram-api"

interface BrowseParams {
  readonly chatId: number
  readonly ctx: BotContext
  readonly index: number
  readonly messageId: number | undefined
  readonly volume: StickerSet
}

interface DeleteParams extends BrowseParams {
  readonly adminUsername: string
  readonly packs: PacksInterface
  readonly user: User
}

const loadStickerSet = (chatId: number, name: string) =>
  Effect.gen(function* loadStickerSetEffect() {
    const telegram = yield* TelegramApi
    return yield* telegram.getStickerSet(name).pipe(
      Effect.catchTag("StickerSetInvalid", () =>
        notify(chatId, "This pack is no longer available on Telegram. Nothing to browse.").pipe(
          Effect.as(null),
        ),
      ),
      Effect.catchTag("TelegramApiError", (error) =>
        notify(chatId, "Telegram is having trouble right now. Please try again in a moment.").pipe(
          Effect.andThen(
            Effect.logError("getStickerSet failed").pipe(
              Effect.annotateLogs({ method: error.method, description: error.description }),
            ),
          ),
          Effect.as(null),
        ),
      ),
      Effect.catchTag("ChatUnavailable", () => Effect.succeed(null)),
      Effect.orElseSucceed(() => null),
    )
  })

const startBrowse = (params: BrowseParams) =>
  Effect.gen(function* startBrowseEffect() {
    const { chatId, ctx, index, messageId, volume } = params
    const telegram = yield* TelegramApi
    const stickerSet = yield* loadStickerSet(chatId, volume.name)
    if (stickerSet === null) {
      return
    }
    const total = stickerSet.stickers.length
    if (total === 0) {
      yield* notify(chatId, "This pack is empty — send me a sticker to fill it!")
      return
    }
    const nextIndex = Math.min(Math.max(index, 0), total - 1)
    const sticker = stickerSet.stickers[nextIndex]
    if (sticker === undefined) {
      return
    }
    if (messageId !== undefined) {
      yield* telegram.deleteMessage(chatId, messageId).pipe(Effect.ignore)
    }
    const message = yield* telegram.sendSticker(chatId, sticker.file_id, {
      reply_markup: browseKeyboard(volume.id, nextIndex, total),
    })
    startFlow(ctx, {
      kind: "browse",
      volumeId: volume.id,
      index: nextIndex,
      messageId: message.message_id,
    })
  })

const deleteFromBrowse = (params: DeleteParams) =>
  Effect.gen(function* deleteFromBrowseEffect() {
    const { adminUsername, chatId, ctx, index, messageId, packs, user, volume } = params
    const telegram = yield* TelegramApi
    const stickerSet = yield* loadStickerSet(chatId, volume.name)
    if (stickerSet === null) {
      return
    }
    const sticker = stickerSet.stickers[index]
    if (sticker === undefined) {
      yield* startBrowse({ chatId, ctx, index, messageId, volume })
      return
    }
    yield* packs
      .removeSticker({
        stickerSetName: volume.name,
        stickerId: sticker.file_id,
        volumeId: volume.id,
      })
      .pipe(
        Effect.catchTag("StickerSetNotModified", () =>
          notify(chatId, buildStickerSetNotModifiedReply(adminUsername), { parse_mode: "HTML" }),
        ),
      )
    const updatedSet = yield* loadStickerSet(chatId, volume.name)
    if (updatedSet === null) {
      return
    }
    const total = updatedSet.stickers.length
    if (total === 0) {
      if (messageId !== undefined) {
        yield* telegram.deleteMessage(chatId, messageId).pipe(Effect.ignore)
      }
      yield* notify(chatId, "That was the last sticker — the pack is empty now.")
      const volumes = yield* loadVolumes(packs, user.id, false)
      yield* showPanel(chatId, undefined, packsPanel(volumes))
      return
    }
    const nextIndex = Math.min(Math.max(index, 0), total - 1)
    const next = updatedSet.stickers[nextIndex]
    if (next === undefined) {
      return
    }
    if (messageId !== undefined) {
      yield* telegram.deleteMessage(chatId, messageId).pipe(Effect.ignore)
    }
    const message = yield* telegram.sendSticker(chatId, next.file_id, {
      reply_markup: browseKeyboard(volume.id, nextIndex, total),
    })
    startFlow(ctx, {
      kind: "browse",
      volumeId: volume.id,
      index: nextIndex,
      messageId: message.message_id,
    })
  })

export { deleteFromBrowse, startBrowse }
