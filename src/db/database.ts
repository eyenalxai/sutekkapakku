import { Context, Effect, Exit, Layer } from "effect"

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

class TransactionRollbackError<E> extends Error {
  readonly exit: Exit.Exit<unknown, E>

  constructor(exit: Exit.Exit<unknown, E>) {
    super("transaction rollback")
    this.name = "TransactionRollbackError"
    this.exit = exit
  }
}

const isTransactionRollback = <E>(error: unknown): error is TransactionRollbackError<E> =>
  error instanceof TransactionRollbackError

interface DatabaseInterface {
  readonly db: Db
  readonly transaction: <A, E>(
    effect: Effect.Effect<A, E, DbExecutor>,
  ) => Effect.Effect<A, E | DatabaseError>
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
      const transaction = <A, E>(
        effect: Effect.Effect<A, E, DbExecutor>,
      ): Effect.Effect<A, E | DatabaseError> =>
        Effect.gen(function* transactionEffect() {
          const context = yield* Effect.context()
          const attempt = Effect.tryPromise({
            try: () =>
              db.transaction(async (tx) => {
                const result = await Effect.runPromiseExitWith(context)(
                  effect.pipe(Effect.provideService(DbExecutor, { executor: tx })),
                )
                if (Exit.isFailure(result)) {
                  throw new TransactionRollbackError(result)
                }
                return result
              }),
            catch: (cause): TransactionRollbackError<E> | DatabaseError =>
              isTransactionRollback<E>(cause)
                ? cause
                : new DatabaseError({ operation: "Database.transaction", cause }),
          })
          const exit = yield* attempt.pipe(
            Effect.catchIf(
              (error): error is TransactionRollbackError<E> => isTransactionRollback<E>(error),
              (rollback) =>
                Exit.isFailure(rollback.exit)
                  ? Effect.failCause(rollback.exit.cause)
                  : Effect.die("unreachable: rollback carries a failed exit"),
            ),
          )
          if (Exit.isFailure(exit)) {
            return yield* Effect.die("unreachable: failures are thrown as rollback")
          }
          return exit.value
        })
      return Database.of({ db, transaction })
    }),
  )
}

export { Database, DbExecutor, runQuery }
export type { DatabaseInterface }
