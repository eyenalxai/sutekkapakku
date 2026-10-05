const NOT_REGISTERED_REPLY = "You are not registered yet.\nPlease use /start command.."

const STICKER_REMOVED_REPLY =
  "Sticker removed from the pack. It may take a few minutes for sticker pack to update."

const STICKER_NOT_IN_PACK_REPLY = "That sticker isn't in the pack, so there's nothing to remove."

const PACK_INVALID_REPLY =
  "That pack is no longer available on Telegram, so I archived it. Send me a sticker to start a fresh one."

const buildStickerSetNotModifiedReply = (adminUsername: string): string =>
  "It seems like you tried to remove a sticker from the pack, but it wasn't in the pack due to a bug in Telegram, most likely. Please wait 15 minutes and check if sticker is in your pack still.\n" +
  "If it is, please contact me!\n\n" +
  `<a href='https://t.me/${adminUsername}'>Contact</a>`

export {
  NOT_REGISTERED_REPLY,
  PACK_INVALID_REPLY,
  STICKER_NOT_IN_PACK_REPLY,
  STICKER_REMOVED_REPLY,
  buildStickerSetNotModifiedReply,
}
