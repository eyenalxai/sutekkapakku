import { eq } from "drizzle-orm"

import type { DbExecutor } from "@/db/client"

import { users } from "@/db/schema"

const getUserByTelegramId = async (db: DbExecutor, telegramId: string) => {
  const [user] = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1)
  return user
}

const createUser = async (db: DbExecutor, telegramId: string) => {
  const [user] = await db.insert(users).values({ telegramId }).returning()
  return user
}

export { createUser, getUserByTelegramId }
