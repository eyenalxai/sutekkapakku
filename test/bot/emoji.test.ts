import { describe, expect, test } from "bun:test"

import { firstEmoji } from "@/bot/emoji"

describe("firstEmoji", () => {
  test("returns the first emoji of the text", () => {
    expect(firstEmoji("hello 🥰 world")).toBe("🥰")
  })

  test("returns the first distinct emoji when emojis repeat", () => {
    expect(firstEmoji("🥲 then 🥰 and 🥲")).toBe("🥲")
  })

  test("returns undefined when the text has no emoji", () => {
    expect(firstEmoji("hello world")).toBeUndefined()
  })
})
