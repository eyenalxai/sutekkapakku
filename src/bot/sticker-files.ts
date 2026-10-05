import type { Bot } from "grammy"
import type { InputSticker, Sticker } from "grammy/types"

import { InputFile } from "grammy"

import type { BotContext } from "@/bot/context"
import type { StickerSetType } from "@/db/schema"

const buildTelegramFileUrl = (apiRoot: string, token: string, filePath: string): string =>
  `${apiRoot}/file/bot${token}/${filePath}`

const downloadTelegramFile = async (url: string): Promise<Uint8Array> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download Telegram file: ${response.status}`)
  }
  return new Uint8Array(await response.arrayBuffer())
}

interface BuildStickerInputParams {
  bot: Bot<BotContext>
  fileApiRoot: string
  sticker: Sticker
  stickerSetType: StickerSetType
  emoji: string
}

const buildStickerInput = async (params: BuildStickerInputParams): Promise<InputSticker> => {
  const { bot, emoji, fileApiRoot, sticker, stickerSetType } = params
  if (stickerSetType === "ANIMATED" || stickerSetType === "VIDEO") {
    const file = await bot.api.getFile(sticker.file_id)
    if (file.file_path === undefined || file.file_path.length === 0) {
      throw new Error("File path is oof.")
    }
    const bytes = await downloadTelegramFile(
      buildTelegramFileUrl(fileApiRoot, bot.token, file.file_path),
    )
    const filename = file.file_path.split("/").at(-1) ?? "sticker"
    const format = stickerSetType === "ANIMATED" ? "animated" : "video"
    return { sticker: new InputFile(bytes, filename), format, emoji_list: [emoji] }
  }
  return { sticker: sticker.file_id, format: "static", emoji_list: [emoji] }
}

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
