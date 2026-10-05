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

const buildStickerSetTitle = (stickerSetType: StickerSetType, username: string): string => {
  if (stickerSetType === "ANIMATED") {
    return `${username}'s Greatest Animated Hits`
  }
  if (stickerSetType === "VIDEO") {
    return `${username}'s Greatest Video Hits`
  }
  return `${username}'s Greatest Hits`
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
