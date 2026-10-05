import type { BotContext, Flow, FlowInput } from "@/bot/context"

const FLOW_TTL_MS = 15 * 60 * 1000

const startFlow = (ctx: BotContext, flow: FlowInput): void => {
  ctx.session.flow = { ...flow, expiresAt: Date.now() + FLOW_TTL_MS }
}

const getActiveFlow = (ctx: BotContext): Flow | undefined => {
  const flow = ctx.session.flow
  if (flow === undefined) {
    return undefined
  }
  if (flow.expiresAt <= Date.now()) {
    ctx.session.flow = undefined
    return undefined
  }
  return flow
}

const clearFlow = (ctx: BotContext): void => {
  ctx.session.flow = undefined
}

export { clearFlow, getActiveFlow, startFlow }
