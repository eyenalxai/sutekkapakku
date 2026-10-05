import { Context, Effect, Layer } from "effect"

import type { DbExecutor } from "@/db/database"
import type { User } from "@/db/schema"
import type { DatabaseError } from "@/errors"

import { DbExecutor as DbExecutorService, runQuery } from "@/db/database"
import { createUser, getUserByTelegramId } from "@/db/queries/users"

interface UsersInterface {
  readonly findByTelegramId: (
    telegramId: string,
  ) => Effect.Effect<User | undefined, DatabaseError, DbExecutor>
  readonly register: (
    telegramId: string,
  ) => Effect.Effect<User | undefined, DatabaseError, DbExecutor>
}

class Users extends Context.Service<Users, UsersInterface>()("sutekkapakku/Users") {
  static readonly layer = Layer.succeed(
    Users,
    Users.of({
      findByTelegramId: (telegramId) =>
        Effect.gen(function* findByTelegramIdEffect() {
          const { executor } = yield* DbExecutorService
          return yield* runQuery("Users.findByTelegramId", () =>
            getUserByTelegramId(executor, telegramId),
          )
        }),
      register: (telegramId) =>
        Effect.gen(function* registerEffect() {
          const { executor } = yield* DbExecutorService
          return yield* runQuery("Users.register", () => createUser(executor, telegramId))
        }),
    }),
  )
}

export { Users }
export type { UsersInterface }
