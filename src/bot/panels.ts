import { Effect } from "effect"
import { InlineKeyboard } from "grammy"

import type { TelegramFailure } from "@/bot/telegram-failure"
import type { StickerSet, StickerSetType } from "@/db/schema"

import { encode } from "@/bot/callback-data"
import { STICKERS_PER_SET } from "@/bot/packs"
import { TelegramApi } from "@/bot/telegram-api"

interface Panel {
  readonly text: string
  readonly keyboard: InlineKeyboard
}

const TYPE_ICONS: Record<StickerSetType, string> = {
  REGULAR: "🖼",
  ANIMATED: "🎞",
  VIDEO: "🎬",
}

const TYPE_NAMES: Record<StickerSetType, string> = {
  REGULAR: "Regular",
  ANIMATED: "Animated",
  VIDEO: "Video",
}

const escapeHtml = (value: string): string =>
  value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")

const archivedSuffix = (volume: StickerSet): string => {
  if (volume.archivedAt === null) {
    return ""
  }
  return volume.archivedReason === "FULL" ? " · full" : " · unavailable"
}

const volumeLine = (volume: StickerSet): string =>
  `${TYPE_ICONS[volume.stickerSetType]} ${escapeHtml(volume.title)} — ${volume.stickerCount}/${STICKERS_PER_SET}${archivedSuffix(volume)}`

const volumeButtonLabel = (volume: StickerSet): string =>
  `${TYPE_ICONS[volume.stickerSetType]} ${volume.stickerCount}/${STICKERS_PER_SET}${volume.archivedAt === null ? "" : " · 🗄"}`

const mainMenu = (adminUsername: string, header = "🎒 <b>Sutekkapakku</b>"): Panel => {
  const keyboard = new InlineKeyboard()
    .text("📦 My packs", encode({ kind: "menu", view: "packs" }))
    .text("➕ Add stickers", encode({ kind: "menu", view: "add" }))
    .row()
    .text("❓ Help", encode({ kind: "menu", view: "help" }))
    .url("💬 Contact", `https://t.me/${adminUsername}`)
  return {
    text: `${header}\n\nSend me a sticker and I'll add it to your packs. Use the buttons below to manage them.`,
    keyboard,
  }
}

const packsPanel = (volumes: StickerSet[]): Panel => {
  const keyboard = new InlineKeyboard()
  for (const volume of volumes) {
    keyboard
      .text(
        volumeButtonLabel(volume),
        encode({ kind: "pack", volumeId: volume.id, action: "open" }),
      )
      .row()
  }
  if (volumes.length === 0) {
    keyboard.text("➕ Add stickers", encode({ kind: "menu", view: "add" })).row()
  } else {
    keyboard.text("🔄 Refresh", encode({ kind: "menu", view: "packs" })).row()
  }
  keyboard.text("🏠 Menu", encode({ kind: "menu", view: "main" }))
  const body =
    volumes.length === 0
      ? "You don't have any packs yet.\nSend me a sticker to create your first one!"
      : volumes.map(volumeLine).join("\n")
  return { text: `📦 <b>Your packs</b>\n\n${body}`, keyboard }
}

const packPanel = (volume: StickerSet): Panel => {
  const keyboard = new InlineKeyboard()
    .url("👁 Open in Telegram", `https://t.me/addstickers/${volume.name}`)
    .row()
  if (volume.archivedAt === null) {
    keyboard
      .text("🗂 Browse stickers", encode({ kind: "pack", volumeId: volume.id, action: "browse" }))
      .text("✏️ Rename", encode({ kind: "pack", volumeId: volume.id, action: "rename" }))
      .row()
      .text("🗑 Remove a sticker", encode({ kind: "pack", volumeId: volume.id, action: "remove" }))
      .text("🔄 Refresh", encode({ kind: "pack", volumeId: volume.id, action: "refresh" }))
      .row()
  }
  keyboard.text("🏠 Menu", encode({ kind: "menu", view: "main" }))
  const status =
    volume.archivedAt === null
      ? `${volume.stickerCount}/${STICKERS_PER_SET} stickers`
      : `archived${archivedSuffix(volume)}`
  return {
    text: `📦 <b>${escapeHtml(volume.title)}</b>\n\n${TYPE_NAMES[volume.stickerSetType]} · ${status}\n<a href='https://t.me/addstickers/${volume.name}'>${volume.name}</a>`,
    keyboard,
  }
}

const addPanel = (): Panel => ({
  text:
    "➕ <b>Adding stickers</b>\n\n" +
    "• Send me any sticker — regular, animated or video — and I'll file it into the matching pack.\n" +
    "• Send me a photo with an emoji caption and I'll turn it into a sticker.\n" +
    "• Packs hold up to 120 stickers; when one fills up I start the next volume automatically.",
  keyboard: new InlineKeyboard()
    .text("📦 My packs", encode({ kind: "menu", view: "packs" }))
    .text("🏠 Menu", encode({ kind: "menu", view: "main" })),
})

const helpPanel = (adminUsername: string): Panel => ({
  text:
    "❓ <b>How it works</b>\n\n" +
    "Send me a sticker and I'll put it in your personal sticker pack.\n" +
    "Send me a sticker from one of your packs and it will be removed.\n" +
    "Send me a picture with an emoji caption and I'll create a sticker from it.\n\n" +
    "If you have any questions, please contact me.",
  keyboard: new InlineKeyboard()
    .text("📦 My packs", encode({ kind: "menu", view: "packs" }))
    .url("💬 Contact", `https://t.me/${adminUsername}`),
})

const removePrompt = (volume?: StickerSet): Panel => {
  const text =
    volume === undefined
      ? "🗑 Send me the sticker you want to remove — it must be from one of your packs."
      : `🗑 Send me the sticker you want to remove from <b>${escapeHtml(volume.title)}</b>.`
  const keyboard = new InlineKeyboard()
  if (volume !== undefined) {
    keyboard
      .text("🗂 Browse stickers", encode({ kind: "pack", volumeId: volume.id, action: "browse" }))
      .row()
  }
  keyboard.text("❌ Cancel", encode({ kind: "cancel" }))
  return { text, keyboard }
}

const renamePrompt = (volume: StickerSet): Panel => ({
  text: `✏️ Send me the new title for <b>${escapeHtml(volume.title)}</b>.\nIt can be up to 64 characters.`,
  keyboard: new InlineKeyboard().text("❌ Cancel", encode({ kind: "cancel" })),
})

const browseKeyboard = (volumeId: number, index: number, total: number): InlineKeyboard =>
  new InlineKeyboard()
    .text("⏮", encode({ kind: "browse", volumeId, index: 0 }))
    .text("◀️", encode({ kind: "browse", volumeId, index: Math.max(0, index - 1) }))
    .text(`${index + 1}/${total}`, encode({ kind: "noop" }))
    .text("▶️", encode({ kind: "browse", volumeId, index: Math.min(total - 1, index + 1) }))
    .text("⏭", encode({ kind: "browse", volumeId, index: total - 1 }))
    .row()
    .text("🗑 Remove", encode({ kind: "delete", volumeId, index }))
    .text("✅ Done", encode({ kind: "done" }))

const showPanel = (
  chatId: number,
  messageId: number | undefined,
  panel: Panel,
): Effect.Effect<void, TelegramFailure, TelegramApi> =>
  Effect.gen(function* showPanelEffect() {
    const telegram = yield* TelegramApi
    const options = { parse_mode: "HTML" as const, reply_markup: panel.keyboard }
    if (messageId === undefined) {
      yield* telegram.sendMessage(chatId, panel.text, options)
      return
    }
    yield* telegram.editMessageText(chatId, messageId, panel.text, options).pipe(
      Effect.catchTag("MessageNotModified", () => Effect.void),
      Effect.catchTag("MessageNotEditable", () =>
        telegram.sendMessage(chatId, panel.text, options).pipe(Effect.asVoid),
      ),
      Effect.catchTag("ChatUnavailable", () => Effect.void),
      Effect.catchTag("TelegramApiError", (error) =>
        Effect.logError("panel edit failed").pipe(
          Effect.annotateLogs({ description: error.description }),
        ),
      ),
    )
  })

export {
  addPanel,
  browseKeyboard,
  escapeHtml,
  helpPanel,
  mainMenu,
  packPanel,
  packsPanel,
  removePrompt,
  renamePrompt,
  showPanel,
}
export type { Panel }
