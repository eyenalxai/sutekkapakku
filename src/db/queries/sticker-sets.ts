import { and, desc, eq, isNull } from "drizzle-orm"

import type { DbExecutor } from "@/db/client"
import type { StickerSetType } from "@/db/schema"

import { stickerSets } from "@/db/schema"

type ArchiveReason = "FULL" | "INVALID"

const getActiveStickerSetForUserByType = async (
  db: DbExecutor,
  userId: number,
  stickerSetType: StickerSetType,
) => {
  const [stickerSet] = await db
    .select()
    .from(stickerSets)
    .where(
      and(
        eq(stickerSets.userId, userId),
        eq(stickerSets.stickerSetType, stickerSetType),
        isNull(stickerSets.archivedAt),
      ),
    )
    .orderBy(desc(stickerSets.id))
    .limit(1)
  return stickerSet
}

const getStickerSetsForUser = (db: DbExecutor, userId: number) =>
  db.select().from(stickerSets).where(eq(stickerSets.userId, userId)).orderBy(desc(stickerSets.id))

const getStickerSetById = async (db: DbExecutor, id: number) => {
  const [stickerSet] = await db.select().from(stickerSets).where(eq(stickerSets.id, id)).limit(1)
  return stickerSet
}

const getStickerSetByTitle = async (db: DbExecutor, title: string) => {
  const [stickerSet] = await db
    .select()
    .from(stickerSets)
    .where(eq(stickerSets.title, title))
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

const archiveStickerSet = async (db: DbExecutor, id: number, reason: ArchiveReason) => {
  const [stickerSet] = await db
    .update(stickerSets)
    .set({ archivedAt: new Date(), archivedReason: reason })
    .where(eq(stickerSets.id, id))
    .returning()
  return stickerSet
}

const updateStickerCount = async (db: DbExecutor, id: number, count: number) => {
  const [stickerSet] = await db
    .update(stickerSets)
    .set({ stickerCount: count })
    .where(eq(stickerSets.id, id))
    .returning()
  return stickerSet
}

const updateStickerSetTitle = async (db: DbExecutor, id: number, title: string) => {
  const [stickerSet] = await db
    .update(stickerSets)
    .set({ title })
    .where(eq(stickerSets.id, id))
    .returning()
  return stickerSet
}

export {
  archiveStickerSet,
  createStickerSet,
  getStickerSetById,
  getStickerSetByTitle,
  getActiveStickerSetForUserByType,
  getStickerSetsForUser,
  updateStickerCount,
  updateStickerSetTitle,
}
export type { ArchiveReason }
