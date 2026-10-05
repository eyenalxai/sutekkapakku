import type { InputSticker, Sticker } from "grammy/types"

import { Effect } from "effect"
import { InputFile } from "grammy"

import type { StickerSetType } from "@/db/schema"

import { TelegramApi } from "@/bot/telegram-api"

interface BuildStickerInputParams {
  readonly sticker: Sticker
  readonly stickerSetType: StickerSetType
  readonly emoji: string
}

const buildStickerInput = (params: BuildStickerInputParams) =>
  Effect.gen(function* buildStickerInputEffect() {
    const { emoji, sticker, stickerSetType } = params
    const telegram = yield* TelegramApi
    if (stickerSetType === "ANIMATED" || stickerSetType === "VIDEO") {
      const bytes = yield* telegram.downloadFile(sticker.file_id)
      const format = stickerSetType === "ANIMATED" ? "animated" : "video"
      const extension = stickerSetType === "ANIMATED" ? "tgs" : "webm"
      const input: InputSticker = {
        sticker: new InputFile(bytes, `${sticker.file_unique_id}.${extension}`),
        format,
        emoji_list: [emoji],
      }
      return input
    }
    const input: InputSticker = {
      sticker: sticker.file_id,
      format: "static",
      emoji_list: [emoji],
    }
    return input
  })

const buildPhotoStickerInput = (
  bytes: Uint8Array,
  filename: string,
  emoji: string,
): InputSticker => ({
  sticker: new InputFile(bytes, filename),
  format: "static",
  emoji_list: [emoji],
})

export { buildPhotoStickerInput, buildStickerInput }
export type { BuildStickerInputParams }
