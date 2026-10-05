import { integer, pgEnum, pgTable, serial, timestamp, varchar } from "drizzle-orm/pg-core"

const stickerSetType = pgEnum("sticker_set_type", ["REGULAR", "ANIMATED", "VIDEO"])

const users = pgTable("user", {
  id: serial().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  telegramId: varchar("telegram_id", { length: 512 }).notNull().unique("user_telegram_id_key"),
})

const stickerSets = pgTable("sticker_set", {
  id: serial().primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  name: varchar("name", { length: 256 }).notNull().unique("sticker_set_name_key"),
  title: varchar("title", { length: 256 }).notNull().unique("sticker_set_title_key"),
  stickerSetType: stickerSetType("sticker_set_type").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { name: "sticker_set_user_id_fkey" }),
  stickerCount: integer("sticker_count").default(0).notNull(),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  archivedReason: varchar("archived_reason", { length: 32 }),
})

type User = typeof users.$inferSelect
type StickerSet = typeof stickerSets.$inferSelect
type StickerSetType = (typeof stickerSetType.enumValues)[number]

export { stickerSetType, stickerSets, users }
export type { StickerSet, StickerSetType, User }
