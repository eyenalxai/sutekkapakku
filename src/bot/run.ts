import { Effect } from "effect"

import type { DbExecutor } from "@/db/database"
import type { AppServices } from "@/runtime"

import { Database, DbExecutor as DbExecutorService } from "@/db/database"
import { runtime } from "@/runtime"

const runHandler = <A, E>(program: Effect.Effect<A, E, AppServices | DbExecutor>): Promise<A> =>
  runtime.runPromise(
    Effect.gen(function* runHandlerEffect() {
      const database = yield* Database
      return yield* program.pipe(
        Effect.provideService(DbExecutorService, { executor: database.db }),
      )
    }),
  )

export { runHandler }
