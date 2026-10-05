import { sequentialize } from "@grammyjs/runner"
import { createLogger } from "evlog"
import { Bot } from "grammy"

import type { BotContext } from "@/bot/context"
import type { DatabaseInterface } from "@/db/database"

import { createPhotoHandler } from "@/bot/handlers/photo"
import { createStartHandler } from "@/bot/handlers/start"
import { createStickerHandler } from "@/bot/handlers/sticker"
import { TelegramApiError } from "@/errors"

interface BotDependencies {
  apiToken: string
  adminUsername: string
  database: DatabaseInterface
  apiRoot?: string
}

const USERNAME_PROMPT = "Please set a username to use this bot."
const GENERIC_ERROR_REPLY = "An error occurred. Please try again."

const logError = (operation: string, error: unknown, ctx: BotContext): void => {
  const log = createLogger({ operation })
  log.set({ updateId: ctx.update.update_id })
  const from = ctx.from
  if (from !== undefined) {
    log.set({ userId: from.id })
  }
  log.error(error instanceof Error ? error : new Error(String(error)))
  log.emit()
}

const createBot = (deps: BotDependencies): Bot<BotContext> => {
  const { adminUsername, apiRoot, apiToken, database } = deps
  const bot = new Bot<BotContext>(apiToken, apiRoot === undefined ? {} : { client: { apiRoot } })

  bot.use(
    bot.errorBoundary((botError) => {
      logError("update_error", botError.error, botError.ctx)
      const error = botError.error
      if (
        error instanceof TelegramApiError &&
        (error.error_code === 429 || (error.error_code ?? 0) >= 500)
      ) {
        throw error
      }
    }),
  )

  bot.use(sequentialize((ctx: BotContext) => ctx.from?.id.toString()))

  bot.on("message", async (ctx, next) => {
    if (ctx.from === undefined) {
      logError("message_without_sender", "Message without a sender", ctx)
      return
    }
    const username = ctx.from.username
    if (username === undefined || username.length === 0) {
      await ctx.reply(USERNAME_PROMPT)
      return
    }
    await next()
  })

  bot.on("message", async (ctx, next) => {
    try {
      await database.db.transaction(async (tx) => {
        ctx.dbTx = tx
        await next()
      })
    } catch (error) {
      if (!ctx.hasCommand(["start", "help"])) {
        throw error
      }
      logError("command_error", error, ctx)
      await ctx.reply(GENERIC_ERROR_REPLY)
    }
  })

  bot.command(["start", "help"], createStartHandler(adminUsername))

  bot.on("message:sticker", createStickerHandler({ adminUsername }))
  bot.on("message:photo", createPhotoHandler())

  bot.catch((botError) => {
    logError("update_error", botError.error, botError.ctx)
  })

  return bot
}

export { createBot }
export type { BotDependencies }
