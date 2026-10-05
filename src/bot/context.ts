import type { Context, SessionFlavor } from "grammy"

type FlowInput =
  | { kind: "remove"; volumeId?: number }
  | { kind: "rename"; volumeId: number }
  | { kind: "browse"; volumeId: number; index: number; messageId: number }

type Flow = FlowInput & { expiresAt: number }

interface SessionData {
  flow: Flow | undefined
}

type BotContext = Context & SessionFlavor<SessionData>

export type { BotContext, Flow, FlowInput, SessionData }
