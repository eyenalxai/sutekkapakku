import { and, eq } from "drizzle-orm"

import type { DbExecutor } from "@/db/client"
import type { StickerSetType } from "@/db/schema"

import { stickerSets } from "@/db/schema"

const getStickerSetForUserByType = async (
  db: DbExecutor,
  userId: number,
  stickerSetType: StickerSetType,
) => {
  const [stickerSet] = await db
    .select()
    .from(stickerSets)
    .where(and(eq(stickerSets.userId, userId), eq(stickerSets.stickerSetType, stickerSetType)))
    .limit(1)
  return stickerSet
}

const createStickerSet = async (
  db: DbExecutor,
  values: {
    name: string
    title: string
    stickerSetType: StickerSetType
    userId: number
  },
) => {
  const [stickerSet] = await db.insert(stickerSets).values(values).returning()
  return stickerSet
}

export { createStickerSet, getStickerSetForUserByType }
