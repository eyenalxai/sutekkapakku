import { Effect } from "effect"

import type { PacksInterface } from "@/bot/packs"
import type { TelegramApi } from "@/bot/telegram-api"
import type { DbExecutor } from "@/db/database"
import type { StickerSet } from "@/db/schema"
import type { DatabaseError } from "@/errors"

const loadVolumes = (
  packs: PacksInterface,
  userId: number,
  refresh: boolean,
): Effect.Effect<StickerSet[], DatabaseError, DbExecutor | TelegramApi> =>
  Effect.gen(function* loadVolumesEffect() {
    const volumes = yield* packs.listVolumes(userId)
    if (refresh) {
      return yield* Effect.all(
        volumes.map((volume) =>
          volume.archivedAt === null
            ? packs.refreshVolume(volume.id).pipe(Effect.orElseSucceed(() => volume))
            : Effect.succeed(volume),
        ),
        { concurrency: 4 },
      )
    }
    return volumes
  })

export { loadVolumes }
