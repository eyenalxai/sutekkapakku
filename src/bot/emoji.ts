import emojiRegex from "emoji-regex"

const firstEmoji = (text: string): string | undefined => {
  const matches = text.match(emojiRegex())
  if (matches === null) {
    return undefined
  }
  return [...new Set(matches)][0]
}

export { firstEmoji }
