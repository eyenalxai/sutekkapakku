import type { BotContext } from "@/bot/context"

import { createUser, getUserByTelegramId } from "@/db/queries/users"

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
    if (from === undefined) {
      return
    }

    const helpText = buildHelpText(adminUsername)
    const telegramId = String(from.id)
    const name = fullName(from.first_name, from.last_name)
    const user = await getUserByTelegramId(ctx.dbTx, telegramId)

    if (user === undefined) {
      await createUser(ctx.dbTx, telegramId)
      await ctx.reply(`Welcome, ${name}!\n\n${helpText}`, { parse_mode: "HTML" })
      return
    }

    await ctx.reply(`Hello, ${name}!\n\n${helpText}`, { parse_mode: "HTML" })
  }

export { createStartHandler }
