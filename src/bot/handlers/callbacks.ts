import { Effect } from "effect"

import type { Callback } from "@/bot/callback-data"
import type { BotContext } from "@/bot/context"
import type { PacksInterface } from "@/bot/packs"
import type { User } from "@/db/schema"

import { deleteFromBrowse, startBrowse } from "@/bot/browse"
import { decode } from "@/bot/callback-data"
import { clearFlow, getActiveFlow, startFlow } from "@/bot/flows"
import { loadVolumes } from "@/bot/handlers/shared"
import { notify } from "@/bot/notify"
import { Packs } from "@/bot/packs"
import {
  addPanel,
  helpPanel,
  mainMenu,
  packPanel,
  packsPanel,
  removePrompt,
  renamePrompt,
  showPanel,
} from "@/bot/panels"
import { NOT_REGISTERED_REPLY } from "@/bot/replies"
import { runHandler } from "@/bot/run"
import { TelegramApi } from "@/bot/telegram-api"
import { Users } from "@/bot/users"

type MenuView = Extract<Callback, { kind: "menu" }>["view"]
type PackAction = Extract<Callback, { kind: "pack" }>["action"]

interface CallbackParams {
  readonly adminUsername: string
  readonly chatId: number
  readonly ctx: BotContext
  readonly messageId: number | undefined
  readonly packs: PacksInterface
  readonly user: User
}

const handleMenuCallback = (params: CallbackParams & { readonly view: MenuView }) =>
  Effect.gen(function* handleMenuCallbackEffect() {
    const { adminUsername, chatId, ctx, messageId, packs, user, view } = params
    if (view === "packs") {
      const volumes = yield* loadVolumes(packs, user.id, true)
      yield* showPanel(chatId, messageId, packsPanel(volumes))
      return
    }
    if (view === "add") {
      yield* showPanel(chatId, messageId, addPanel())
      return
    }
    if (view === "help") {
      yield* showPanel(chatId, messageId, helpPanel(adminUsername))
      return
    }
    if (view === "remove") {
      startFlow(ctx, { kind: "remove" })
      yield* showPanel(chatId, messageId, removePrompt())
      return
    }
    clearFlow(ctx)
    yield* showPanel(chatId, messageId, mainMenu(adminUsername, ctx.from?.first_name ?? "there"))
  })

const handlePackCallback = (
  params: CallbackParams & { readonly action: PackAction; readonly volumeId: number },
) =>
  Effect.gen(function* handlePackCallbackEffect() {
    const { action, chatId, ctx, messageId, packs, user, volumeId } = params
    const volumes = yield* loadVolumes(packs, user.id, false)
    const volume = volumes.find((candidate) => candidate.id === volumeId)
    if (volume === undefined) {
      yield* showPanel(chatId, messageId, packsPanel(volumes))
      return
    }
    if (action === "open") {
      yield* showPanel(chatId, messageId, packPanel(volume))
      return
    }
    if (action === "refresh") {
      const refreshed = yield* packs
        .refreshVolume(volume.id)
        .pipe(Effect.orElseSucceed(() => volume))
      yield* showPanel(chatId, messageId, packPanel(refreshed))
      return
    }
    if (action === "remove") {
      startFlow(ctx, { kind: "remove", volumeId: volume.id })
      yield* showPanel(chatId, messageId, removePrompt(volume))
      return
    }
    if (action === "rename") {
      startFlow(ctx, { kind: "rename", volumeId: volume.id })
      yield* showPanel(chatId, messageId, renamePrompt(volume))
      return
    }
    yield* startBrowse({ chatId, ctx, index: 0, messageId, volume })
  })

const dispatch = (params: CallbackParams & { readonly callback: Callback }) =>
  Effect.gen(function* dispatchEffect() {
    const { adminUsername, callback, chatId, ctx, messageId, packs, user } = params
    const base = { adminUsername, chatId, ctx, messageId, packs, user }
    switch (callback.kind) {
      case "noop": {
        return
      }
      case "done": {
        clearFlow(ctx)
        if (messageId !== undefined) {
          const telegram = yield* TelegramApi
          yield* telegram.deleteMessage(chatId, messageId).pipe(Effect.ignore)
        }
        const volumes = yield* loadVolumes(packs, user.id, true)
        yield* showPanel(chatId, undefined, packsPanel(volumes))
        return
      }
      case "cancel": {
        const flow = getActiveFlow(ctx)
        clearFlow(ctx)
        if (flow?.kind === "browse" && flow.messageId === messageId && messageId !== undefined) {
          const telegram = yield* TelegramApi
          yield* telegram.deleteMessage(chatId, messageId).pipe(Effect.ignore)
          yield* showPanel(
            chatId,
            undefined,
            mainMenu(adminUsername, ctx.from?.first_name ?? "there"),
          )
          return
        }
        yield* showPanel(
          chatId,
          messageId,
          mainMenu(adminUsername, ctx.from?.first_name ?? "there"),
        )
        return
      }
      case "menu": {
        yield* handleMenuCallback({ ...base, view: callback.view })
        return
      }
      case "pack": {
        yield* handlePackCallback({ ...base, action: callback.action, volumeId: callback.volumeId })
        return
      }
      case "browse":
      case "delete": {
        const volumes = yield* loadVolumes(packs, user.id, false)
        const volume = volumes.find((candidate) => candidate.id === callback.volumeId)
        if (volume === undefined) {
          yield* showPanel(chatId, messageId, packsPanel(volumes))
          return
        }
        if (callback.kind === "browse") {
          yield* startBrowse({ chatId, ctx, index: callback.index, messageId, volume })
          return
        }
        yield* deleteFromBrowse({ ...base, index: callback.index, volume })
        break
      }
      default: {
        break
      }
    }
  })

const createCallbackHandler =
  (adminUsername: string) =>
  async (ctx: BotContext): Promise<void> => {
    const callbackQuery = ctx.callbackQuery
    const from = ctx.from
    const chatId = ctx.chat?.id
    if (callbackQuery === undefined || from === undefined || chatId === undefined) {
      return
    }
    const messageId = callbackQuery.message?.message_id
    const data = callbackQuery.data
    const callback = data === undefined ? undefined : decode(data)
    await runHandler(
      Effect.gen(function* callbackHandlerEffect() {
        const telegram = yield* TelegramApi
        yield* telegram.answerCallbackQuery(callbackQuery.id).pipe(Effect.ignore)
        if (callback === undefined) {
          return
        }
        const users = yield* Users
        const user = yield* users.findByTelegramId(String(from.id))
        if (user === undefined) {
          yield* notify(chatId, NOT_REGISTERED_REPLY)
          return
        }
        const packs = yield* Packs
        yield* dispatch({ adminUsername, callback, chatId, ctx, messageId, packs, user })
      }),
    )
  }

export { createCallbackHandler }
