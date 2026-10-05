import { Effect } from "effect"

import type { BotContext } from "@/bot/context"

import { notify } from "@/bot/notify"
import { runHandler } from "@/bot/run"
import { Users } from "@/bot/users"

const buildHelpText = (adminUsername: string): string =>
  "Send me a sticker and I'll put it in your personal sticker pack.\n" +
  "Send me a sticker from a pack create by this bot and this sticker will be removed.\n" +
  "Send me a picture with an emoji caption and I'll create a sticker from it.\n" +
  "If you have any questions, please contact me.\n\n" +
  `<a href='https://t.me/${adminUsername}'>Contact</a>`

const fullName = (firstName: string, lastName: string | undefined): string =>
  lastName === undefined ? firstName : `${firstName} ${lastName}`

const createStartHandler =
  (adminUsername: string) =>
  async (ctx: BotContext): Promise<void> => {
    const from = ctx.from
    const chatId = ctx.chat?.id
    if (from === undefined || chatId === undefined) {
      return
    }

    const helpText = buildHelpText(adminUsername)
    const telegramId = String(from.id)
    const name = fullName(from.first_name, from.last_name)

    await runHandler(
      ctx,
      Effect.gen(function* startHandlerEffect() {
        const users = yield* Users
        const user = yield* users.findByTelegramId(telegramId)
        if (user === undefined) {
          yield* users.register(telegramId)
          yield* notify(chatId, `Welcome, ${name}!\n\n${helpText}`, { parse_mode: "HTML" })
          return
        }
        yield* notify(chatId, `Hello, ${name}!\n\n${helpText}`, { parse_mode: "HTML" })
      }),
    )
  }

export { createStartHandler }
