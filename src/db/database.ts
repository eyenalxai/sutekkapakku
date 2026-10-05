import { Context, Effect, Layer } from "effect"

import type { Db, DbExecutor as DbExecutorType } from "@/db/client"

import { AppConfiguration } from "@/config"
import { createDb } from "@/db/client"
import { DatabaseError } from "@/errors"

class DbExecutor extends Context.Service<DbExecutor, { readonly executor: DbExecutorType }>()(
  "sutekkapakku/DbExecutor",
) {}

const runQuery = <A>(operation: string, query: () => Promise<A>): Effect.Effect<A, DatabaseError> =>
  Effect.tryPromise({
    try: query,
    catch: (cause) => new DatabaseError({ operation, cause }),
  })

interface DatabaseInterface {
  readonly db: Db
}

class Database extends Context.Service<Database, DatabaseInterface>()("sutekkapakku/Database") {
  static readonly layer = Layer.effect(
    Database,
    Effect.gen(function* makeDatabase() {
      const config = yield* AppConfiguration
      const db = yield* Effect.acquireRelease(
        Effect.sync(() => createDb(config.databaseUrl)),
        (instance) => Effect.promise(() => instance.$client.close()),
      )
      return Database.of({ db })
    }),
  )
}

export { Database, DbExecutor, runQuery }
export type { DatabaseInterface }
