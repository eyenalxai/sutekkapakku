import type { Sticker } from "grammy/types"

import { randomInt } from "node:crypto"

import type { StickerSetType } from "@/db/schema"

const LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

const randomLetterString = (length: number): string => {
  let result = ""
  for (let index = 0; index < length; index += 1) {
    result += LETTERS.charAt(randomInt(LETTERS.length))
  }
  return result
}

const buildStickerSetTitle = (
  stickerSetType: StickerSetType,
  username: string,
  ordinal = 1,
): string => {
  const base =
    stickerSetType === "ANIMATED"
      ? `${username}'s Greatest Animated Hits`
      : stickerSetType === "VIDEO"
        ? `${username}'s Greatest Video Hits`
        : `${username}'s Greatest Hits`
  return ordinal > 1 ? `${base} Vol. ${ordinal}` : base
}

const buildStickerSetName = (username: string, botUsername: string): string =>
  `${username}_${randomLetterString(4)}_by_${botUsername}`

const detectStickerSetType = (
  sticker: Pick<Sticker, "is_animated" | "is_video">,
): StickerSetType => {
  if (sticker.is_animated) {
    return "ANIMATED"
  }
  if (sticker.is_video) {
    return "VIDEO"
  }
  return "REGULAR"
}

export { buildStickerSetName, buildStickerSetTitle, detectStickerSetType }
