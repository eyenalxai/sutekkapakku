import { Effect } from "effect"

import type { BotContext } from "@/bot/context"

import { loadVolumes } from "@/bot/handlers/shared"
import { notify } from "@/bot/notify"
import { Packs } from "@/bot/packs"
import {
  addPanel,
  escapeHtml,
  helpPanel,
  mainMenu,
  packsPanel,
  removePrompt,
  showPanel,
} from "@/bot/panels"
import { NOT_REGISTERED_REPLY } from "@/bot/replies"
import { runHandler } from "@/bot/run"
import { Users } from "@/bot/users"

const fullName = (firstName: string, lastName: string | undefined): string =>
  lastName === undefined ? firstName : `${firstName} ${lastName}`

const createMenuHandler =
  (adminUsername: string) =>
  async (ctx: BotContext): Promise<void> => {
    const from = ctx.from
    const chatId = ctx.chat?.id
    if (from === undefined || chatId === undefined) {
      return
    }
    await runHandler(
      ctx,
      Effect.gen(function* menuHandlerEffect() {
        const users = yield* Users
        const existing = yield* users.findByTelegramId(String(from.id))
        if (existing === undefined) {
          yield* users.register(String(from.id))
        }
        const greeting =
          existing === undefined
            ? `Welcome, <b>${escapeHtml(fullName(from.first_name, from.last_name))}</b>!`
            : `Hello, <b>${escapeHtml(from.first_name)}</b>!`
        yield* showPanel(chatId, undefined, mainMenu(adminUsername, greeting))
      }),
    )
  }

const createPacksHandler =
  () =>
  async (ctx: BotContext): Promise<void> => {
    const from = ctx.from
    const chatId = ctx.chat?.id
    if (from === undefined || chatId === undefined) {
      return
    }
    await runHandler(
      ctx,
      Effect.gen(function* packsHandlerEffect() {
        const users = yield* Users
        const packs = yield* Packs
        const user = yield* users.findByTelegramId(String(from.id))
        if (user === undefined) {
          yield* notify(chatId, NOT_REGISTERED_REPLY)
          return
        }
        const volumes = yield* loadVolumes(packs, user.id, true)
        yield* showPanel(chatId, undefined, packsPanel(volumes))
      }),
    )
  }

const createAddHandler =
  () =>
  async (ctx: BotContext): Promise<void> => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      return
    }
    await runHandler(
      ctx,
      Effect.gen(function* addHandlerEffect() {
        yield* showPanel(chatId, undefined, addPanel())
      }),
    )
  }

const createHelpHandler =
  (adminUsername: string) =>
  async (ctx: BotContext): Promise<void> => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      return
    }
    await runHandler(
      ctx,
      Effect.gen(function* helpHandlerEffect() {
        yield* showPanel(chatId, undefined, helpPanel(adminUsername))
      }),
    )
  }

const createRemoveHandler =
  () =>
  async (ctx: BotContext): Promise<void> => {
    const from = ctx.from
    const chatId = ctx.chat?.id
    if (from === undefined || chatId === undefined) {
      return
    }
    await runHandler(
      ctx,
      Effect.gen(function* removeHandlerEffect() {
        const users = yield* Users
        const user = yield* users.findByTelegramId(String(from.id))
        if (user === undefined) {
          yield* notify(chatId, NOT_REGISTERED_REPLY)
          return
        }
        ctx.session.flow = { kind: "remove" }
        yield* showPanel(chatId, undefined, removePrompt())
      }),
    )
  }

const createCancelHandler =
  (adminUsername: string) =>
  async (ctx: BotContext): Promise<void> => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      return
    }
    ctx.session.flow = undefined
    await runHandler(
      ctx,
      Effect.gen(function* cancelHandlerEffect() {
        yield* showPanel(chatId, undefined, mainMenu(adminUsername))
      }),
    )
  }

export {
  createAddHandler,
  createCancelHandler,
  createHelpHandler,
  createMenuHandler,
  createPacksHandler,
  createRemoveHandler,
}
