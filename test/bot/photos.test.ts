import { describe, expect, test } from "bun:test"

import { resizePhotoToStickerJpeg } from "@/bot/photos"

const TRANSPARENT_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
)

const makePng = async (width: number, height: number): Promise<Uint8Array> =>
  new Bun.Image(TRANSPARENT_PIXEL_PNG).resize(width, height).png().bytes()

const readMetadata = async (bytes: Uint8Array) => new Bun.Image(bytes).metadata()

describe("resizePhotoToStickerJpeg", () => {
  test("scales a landscape photo to a 512 px long side", async () => {
    const jpeg = await resizePhotoToStickerJpeg(await makePng(1024, 512))

    expect(await readMetadata(jpeg)).toMatchObject({ format: "jpeg", height: 256, width: 512 })
  })

  test("scales a portrait photo to a 512 px long side", async () => {
    const jpeg = await resizePhotoToStickerJpeg(await makePng(300, 900))

    expect(await readMetadata(jpeg)).toMatchObject({ format: "jpeg", height: 512, width: 171 })
  })

  test("upscales photos smaller than 512 px like the original bot", async () => {
    const jpeg = await resizePhotoToStickerJpeg(await makePng(16, 8))

    expect(await readMetadata(jpeg)).toMatchObject({ format: "jpeg", height: 256, width: 512 })
  })
})
