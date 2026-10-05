import { Effect } from "effect"

import type { BotContext } from "@/bot/context"
import type { DbExecutor } from "@/db/database"
import type { AppServices } from "@/runtime"

import { DbExecutor as DbExecutorService } from "@/db/database"
import { runtime } from "@/runtime"

const runHandler = <A, E>(
  ctx: BotContext,
  program: Effect.Effect<A, E, AppServices | DbExecutor>,
): Promise<A> =>
  runtime.runPromise(program.pipe(Effect.provideService(DbExecutorService, { executor: ctx.dbTx })))

export { runHandler }
