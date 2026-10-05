import { Effect } from "effect"

import type { ArchiveReason } from "@/db/queries/sticker-sets"

import { TelegramApi } from "@/bot/telegram-api"
import { DbExecutor, runQuery } from "@/db/database"
import { archiveStickerSet, getStickerSetById, updateStickerCount } from "@/db/queries/sticker-sets"

const refreshVolume = Effect.fn("Packs.refreshVolume")(function* refreshVolumeProgram(
  volumeId: number,
) {
  const telegram = yield* TelegramApi
  const { executor } = yield* DbExecutor
  const volume = yield* runQuery("Packs.byId", () => getStickerSetById(executor, volumeId))
  if (volume === undefined) {
    return yield* Effect.die(new Error("volume not found"))
  }
  const outcome = yield* telegram.getStickerSet(volume.name).pipe(
    Effect.map((stickerSet) => ({ kind: "live" as const, count: stickerSet.stickers.length })),
    Effect.catchTag("StickerSetInvalid", () => Effect.succeed({ kind: "invalid" as const })),
  )
  if (outcome.kind === "invalid") {
    const archived = yield* runQuery("Packs.archiveInvalid", () =>
      archiveStickerSet(executor, volumeId, "INVALID"),
    )
    if (archived === undefined) {
      return yield* Effect.die(new Error("archive returned no row"))
    }
    return archived
  }
  const count = Math.min(Math.max(outcome.count, 0), 200)
  const updated = yield* runQuery("Packs.refresh", () =>
    updateStickerCount(executor, volumeId, count),
  )
  if (updated === undefined) {
    return yield* Effect.die(new Error("refresh returned no row"))
  }
  return updated
})

const archiveVolume = Effect.fn("Packs.archiveVolume")(function* archiveVolumeProgram(
  volumeId: number,
  reason: ArchiveReason,
) {
  const { executor } = yield* DbExecutor
  return yield* runQuery("Packs.archiveVolume", () => archiveStickerSet(executor, volumeId, reason))
})

export { archiveVolume, refreshVolume }
