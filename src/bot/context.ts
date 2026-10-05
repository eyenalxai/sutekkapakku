import type { Context } from "grammy"

import type { DbExecutor } from "@/db/client"

type BotContext = Context & { dbTx: DbExecutor }

export type { BotContext }
