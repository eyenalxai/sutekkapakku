import { describe, expect, test } from "bun:test"

import { buildStickerSetName, buildStickerSetTitle, detectStickerSetType } from "@/bot/sticker-pack"

describe("buildStickerSetTitle", () => {
  test("uses the format-specific title", () => {
    expect(buildStickerSetTitle("REGULAR", "alice")).toBe("alice's Greatest Hits")
    expect(buildStickerSetTitle("ANIMATED", "alice")).toBe("alice's Greatest Animated Hits")
    expect(buildStickerSetTitle("VIDEO", "alice")).toBe("alice's Greatest Video Hits")
  })
})

describe("buildStickerSetName", () => {
  test("embeds the username and bot username around four random letters", () => {
    expect(buildStickerSetName("alice", "pack_bot")).toMatch(/^alice_[A-Za-z]{4}_by_pack_bot$/u)
  })

  test("randomizes the middle segment", () => {
    expect(buildStickerSetName("alice", "pack_bot")).not.toBe(
      buildStickerSetName("alice", "pack_bot"),
    )
  })
})

describe("detectStickerSetType", () => {
  test("maps sticker flags to the database enum", () => {
    expect(detectStickerSetType({ is_animated: true, is_video: false })).toBe("ANIMATED")
    expect(detectStickerSetType({ is_animated: false, is_video: true })).toBe("VIDEO")
    expect(detectStickerSetType({ is_animated: false, is_video: false })).toBe("REGULAR")
  })
})
