import type { Context, SessionFlavor } from "grammy"

import type { DbExecutor } from "@/db/client"

type Flow =
  | { kind: "remove"; volumeId?: number }
  | { kind: "rename"; volumeId: number }
  | { kind: "browse"; volumeId: number; index: number; messageId: number }

interface SessionData {
  flow: Flow | undefined
}

type BotContext = Context & { dbTx: DbExecutor } & SessionFlavor<SessionData>

export type { BotContext, Flow, SessionData }
