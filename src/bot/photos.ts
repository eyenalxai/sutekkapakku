import type { PhotoSize } from "grammy/types"

const STICKER_SIDE = 512

const getLargestPhoto = (photos: PhotoSize[]): PhotoSize => {
  const [first] = photos
  if (first === undefined) {
    throw new Error("No photos in message")
  }
  let largest = first
  for (const photo of photos) {
    if (photo.width * photo.height > largest.width * largest.height) {
      largest = photo
    }
  }
  return largest
}

const resizePhotoToStickerJpeg = async (bytes: Uint8Array): Promise<Uint8Array> => {
  const { height, width } = await new Bun.Image(bytes).metadata()
  const ratio = width / height
  const target =
    ratio > 1
      ? { height: Math.round(STICKER_SIDE / ratio), width: STICKER_SIDE }
      : { height: STICKER_SIDE, width: Math.round(STICKER_SIDE * ratio) }
  return new Bun.Image(bytes).resize(target.width, target.height).jpeg().bytes()
}

export { getLargestPhoto, resizePhotoToStickerJpeg }
