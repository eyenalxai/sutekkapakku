import type { Context, SessionFlavor } from "grammy"

import type { DbExecutor } from "@/db/client"

type FlowInput =
  | { kind: "remove"; volumeId?: number }
  | { kind: "rename"; volumeId: number }
  | { kind: "browse"; volumeId: number; index: number; messageId: number }

type Flow = FlowInput & { expiresAt: number }

interface SessionData {
  flow: Flow | undefined
}

type BotContext = Context & { dbTx: DbExecutor } & SessionFlavor<SessionData>

export type { BotContext, Flow, FlowInput, SessionData }
