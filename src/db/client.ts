import { drizzle } from "drizzle-orm/bun-sql"

const createDb = (databaseUrl: string) => drizzle(databaseUrl)

type Db = ReturnType<typeof createDb>
type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0]
type DbExecutor = Db | DbTransaction

export { createDb }
export type { Db, DbExecutor, DbTransaction }
