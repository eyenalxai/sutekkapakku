import type { Sticker, Update } from "grammy/types"

import type { DbExecutor } from "@/db/client"
import type { StickerSetType } from "@/db/schema"

import { createStickerSet } from "@/db/queries/sticker-sets"
import { createUser } from "@/db/queries/users"

interface StickerOptions {
  fileId: string
  emoji?: string
  setName?: string
  isAnimated?: boolean
  isVideo?: boolean
}

const buildSticker = (options: StickerOptions): Sticker => ({
  file_id: options.fileId,
  file_unique_id: `unique_${options.fileId}`,
  type: "regular",
  width: 512,
  height: 512,
  is_animated: options.isAnimated ?? false,
  is_video: options.isVideo ?? false,
  ...(options.emoji === undefined ? {} : { emoji: options.emoji }),
  ...(options.setName === undefined ? {} : { set_name: options.setName }),
})

interface StickerUpdateOptions {
  updateId: number
  messageId: number
  userId: number
  username: string
  sticker: Sticker
}

const buildStickerUpdate = (options: StickerUpdateOptions): Update => ({
  update_id: options.updateId,
  message: {
    message_id: options.messageId,
    date: Math.floor(Date.now() / 1000),
    chat: { id: options.userId, type: "private", first_name: "Sticker" },
    from: {
      id: options.userId,
      is_bot: false,
      first_name: "Sticker",
      username: options.username,
    },
    sticker: options.sticker,
  },
})

const registerUser = async (db: DbExecutor, telegramId: string) => {
  const user = await createUser(db, telegramId)
  if (user === undefined) {
    throw new Error(`failed to create user ${telegramId}`)
  }
  return user
}

const seedStickerSet = async (
  db: DbExecutor,
  userId: number,
  stickerSetType: StickerSetType,
  name: string,
  title: string,
) => {
  const stickerSet = await createStickerSet(db, { name, stickerSetType, title, userId })
  if (stickerSet === undefined) {
    throw new Error(`failed to create sticker set ${name}`)
  }
  return stickerSet
}

interface StickerEntry {
  sticker: string
  format: string
  emoji_list: string[]
}

const isStickerEntry = (value: unknown): value is StickerEntry => {
  if (typeof value !== "object" || value === null) {
    return false
  }
  if (!("sticker" in value) || typeof value.sticker !== "string") {
    return false
  }
  if (!("format" in value) || typeof value.format !== "string") {
    return false
  }
  if (!("emoji_list" in value) || !Array.isArray(value.emoji_list)) {
    return false
  }
  return value.emoji_list.every((emoji) => typeof emoji === "string")
}

const readStickerEntries = (value: unknown): StickerEntry[] => {
  const parsed: unknown = JSON.parse(String(value))
  return Array.isArray(parsed) ? parsed.filter((entry) => isStickerEntry(entry)) : []
}

const readMultipartUpload = async (params: Record<string, unknown>, attachUrl: string) => {
  const upload = params[attachUrl.replace("attach://", "")]
  if (!(upload instanceof Blob)) {
    throw new Error(`missing multipart upload for ${attachUrl}`)
  }
  return new Uint8Array(await upload.arrayBuffer())
}

export {
  buildSticker,
  buildStickerUpdate,
  readMultipartUpload,
  readStickerEntries,
  registerUser,
  seedStickerSet,
}
export type { StickerEntry, StickerOptions, StickerUpdateOptions }
