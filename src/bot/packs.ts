import type { InputSticker, User as TelegramUser } from "grammy/types"

import { Context, Effect, Layer } from "effect"

import type { ArchiveReason } from "@/db/queries/sticker-sets"
import type { StickerSet, StickerSetType, User } from "@/db/schema"
import type {
  ChatUnavailable,
  DatabaseError,
  StickerSetInvalid,
  StickerSetNameConflict,
  StickerSetNotModified,
  StickerSetTooMuch,
  TelegramApiError,
  VolumeTitleInvalid,
  VolumeTitleTaken,
} from "@/errors"

import { notify } from "@/bot/notify"
import { buildStickerSetName, buildStickerSetTitle } from "@/bot/sticker-pack"
import { TelegramApi } from "@/bot/telegram-api"
import { archiveVolume, refreshVolume } from "@/bot/volume-maintenance"
import { DbExecutor, runQuery } from "@/db/database"
import {
  archiveStickerSet,
  createStickerSet,
  getStickerSetById,
  getStickerSetByTitle,
  getActiveStickerSetForUserByType,
  getStickerSetsForUser,
  updateStickerCount,
  updateStickerSetTitle,
} from "@/db/queries/sticker-sets"
import {
  VolumeTitleInvalid as VolumeTitleInvalidError,
  VolumeTitleTaken as VolumeTitleTakenError,
} from "@/errors"

const STICKERS_PER_SET = 120
const MAX_TITLE_LENGTH = 64
const MAX_NAME_ATTEMPTS = 3

type PacksFailure =
  | ChatUnavailable
  | DatabaseError
  | StickerSetInvalid
  | StickerSetNameConflict
  | StickerSetNotModified
  | StickerSetTooMuch
  | TelegramApiError
  | VolumeTitleInvalid
  | VolumeTitleTaken

interface AddStickerParams {
  readonly chatId: number
  readonly user: User
  readonly telegramUser: TelegramUser
  readonly telegramUsername: string
  readonly sticker: InputSticker
  readonly stickerSetType: StickerSetType
}

interface RemoveStickerParams {
  readonly stickerSetName: string
  readonly stickerId: string
  readonly volumeId: number
}

interface PacksInterface {
  readonly listVolumes: (userId: number) => Effect.Effect<StickerSet[], DatabaseError, DbExecutor>
  readonly activeVolume: (
    userId: number,
    stickerSetType: StickerSetType,
  ) => Effect.Effect<StickerSet | undefined, DatabaseError, DbExecutor>
  readonly addSticker: (
    params: AddStickerParams,
  ) => Effect.Effect<void, PacksFailure, DbExecutor | TelegramApi>
  readonly removeSticker: (
    params: RemoveStickerParams,
  ) => Effect.Effect<void, PacksFailure, DbExecutor | TelegramApi>
  readonly renameVolume: (
    volumeId: number,
    title: string,
  ) => Effect.Effect<StickerSet, PacksFailure, DbExecutor | TelegramApi>
  readonly refreshVolume: (
    volumeId: number,
  ) => Effect.Effect<StickerSet, PacksFailure, DbExecutor | TelegramApi>
  readonly archiveVolume: (
    volumeId: number,
    reason: ArchiveReason,
  ) => Effect.Effect<StickerSet | undefined, DatabaseError, DbExecutor>
}

const stickerSetLink = (volume: StickerSet): string =>
  `Link: <a href='https://t.me/addstickers/${volume.name}'>${volume.title}</a>`

const createVolume = (params: AddStickerParams) =>
  Effect.gen(function* createVolumeProgram() {
    const telegram = yield* TelegramApi
    const { executor } = yield* DbExecutor
    const botUser = yield* telegram.getMe()
    const botUsername = botUser.username
    if (botUsername === undefined || botUsername.length === 0) {
      return yield* Effect.die(new Error("Bot username is not set!"))
    }
    for (let attempt = 0; attempt < MAX_NAME_ATTEMPTS; attempt += 1) {
      const volumes = yield* runQuery("Packs.listVolumes", () =>
        getStickerSetsForUser(executor, params.user.id),
      )
      let ordinal =
        volumes.filter((volume) => volume.stickerSetType === params.stickerSetType).length + 1
      let title = buildStickerSetTitle(params.stickerSetType, params.telegramUsername, ordinal)
      while (
        (yield* runQuery("Packs.titleTaken", () => getStickerSetByTitle(executor, title))) !==
        undefined
      ) {
        ordinal += 1
        title = buildStickerSetTitle(params.stickerSetType, params.telegramUsername, ordinal)
      }
      const name = buildStickerSetName(params.telegramUsername, botUsername)
      const created = yield* runQuery("Packs.createVolume", () =>
        createStickerSet(executor, {
          name,
          title,
          stickerSetType: params.stickerSetType,
          userId: params.user.id,
        }),
      )
      if (created === undefined) {
        return yield* Effect.die(new Error("Failed to create sticker set row"))
      }
      const outcome = yield* telegram
        .createNewStickerSet(params.telegramUser.id, created.name, created.title, [params.sticker])
        .pipe(
          Effect.as("CREATED" as const),
          Effect.catchTag("StickerSetNameConflict", () => Effect.succeed("CONFLICT" as const)),
        )
      if (outcome === "CREATED") {
        const counted = yield* runQuery("Packs.initialCount", () =>
          updateStickerCount(executor, created.id, 1),
        )
        return counted ?? created
      }
      yield* runQuery("Packs.archiveConflicted", () =>
        archiveStickerSet(executor, created.id, "INVALID"),
      )
    }
    return yield* Effect.die(new Error("could not create a sticker set after 3 attempts"))
  })

const overflowToNextVolume = (
  params: AddStickerParams,
  previous: StickerSet,
  reason: "FULL" | "INVALID",
) =>
  Effect.gen(function* overflowToNextVolumeProgram() {
    const { executor } = yield* DbExecutor
    yield* runQuery("Packs.archive", () => archiveStickerSet(executor, previous.id, reason))
    const created = yield* createVolume(params)
    const intro =
      reason === "FULL"
        ? `Your pack "<b>${previous.title}</b>" is full (${STICKERS_PER_SET} stickers), so I started a new one!`
        : `Your pack "<b>${previous.title}</b>" is no longer available on Telegram, so I started a new one!`
    yield* notify(params.chatId, `${intro}\n\n${stickerSetLink(created)}`, { parse_mode: "HTML" })
  })

const listVolumes = Effect.fn("Packs.listVolumes")(function* listVolumesProgram(userId: number) {
  const { executor } = yield* DbExecutor
  return yield* runQuery("Packs.listVolumes", () => getStickerSetsForUser(executor, userId))
})

const activeVolume = Effect.fn("Packs.activeVolume")(function* activeVolumeProgram(
  userId: number,
  stickerSetType: StickerSetType,
) {
  const { executor } = yield* DbExecutor
  return yield* runQuery("Packs.activeVolume", () =>
    getActiveStickerSetForUserByType(executor, userId, stickerSetType),
  )
})

const addSticker = Effect.fn("Packs.addSticker")(function* addStickerProgram(
  params: AddStickerParams,
) {
  const telegram = yield* TelegramApi
  const { executor } = yield* DbExecutor
  const active = yield* runQuery("Packs.activeVolume", () =>
    getActiveStickerSetForUserByType(executor, params.user.id, params.stickerSetType),
  )
  if (active === undefined) {
    const created = yield* createVolume(params)
    yield* notify(params.chatId, `Sticker pack created!\n\n${stickerSetLink(created)}`, {
      parse_mode: "HTML",
    })
    return
  }
  if (active.stickerCount >= STICKERS_PER_SET) {
    yield* overflowToNextVolume(params, active, "FULL")
    return
  }
  const outcome = yield* telegram
    .addStickerToSet(params.telegramUser.id, active.name, params.sticker)
    .pipe(
      Effect.as("ADDED" as const),
      Effect.catchTag("StickerSetTooMuch", () => Effect.succeed("TOO_MUCH" as const)),
      Effect.catchTag("StickerSetInvalid", () => Effect.succeed("INVALID" as const)),
    )
  if (outcome === "ADDED") {
    yield* runQuery("Packs.bumpCount", () =>
      updateStickerCount(executor, active.id, active.stickerCount + 1),
    )
    yield* notify(params.chatId, `Sticker added to the pack.\n\n${stickerSetLink(active)}`, {
      parse_mode: "HTML",
    })
    return
  }
  yield* overflowToNextVolume(params, active, outcome === "TOO_MUCH" ? "FULL" : "INVALID")
})

const removeSticker = Effect.fn("Packs.removeSticker")(function* removeStickerProgram(
  params: RemoveStickerParams,
) {
  const telegram = yield* TelegramApi
  const { executor } = yield* DbExecutor
  yield* telegram.deleteStickerFromSet(params.stickerSetName, params.stickerId)
  const volume = yield* runQuery("Packs.byId", () => getStickerSetById(executor, params.volumeId))
  if (volume !== undefined) {
    yield* runQuery("Packs.decrementCount", () =>
      updateStickerCount(executor, volume.id, Math.max(0, volume.stickerCount - 1)),
    )
  }
})

const renameVolume = Effect.fn("Packs.renameVolume")(function* renameVolumeProgram(
  volumeId: number,
  title: string,
) {
  const telegram = yield* TelegramApi
  const { executor } = yield* DbExecutor
  const trimmed = title.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_TITLE_LENGTH) {
    return yield* Effect.fail(
      new VolumeTitleInvalidError({ title: trimmed, minimum: 1, maximum: MAX_TITLE_LENGTH }),
    )
  }
  const volume = yield* runQuery("Packs.byId", () => getStickerSetById(executor, volumeId))
  if (volume === undefined) {
    return yield* Effect.die(new Error("volume not found"))
  }
  const existing = yield* runQuery("Packs.byTitle", () => getStickerSetByTitle(executor, trimmed))
  if (existing !== undefined && existing.id !== volumeId) {
    return yield* Effect.fail(new VolumeTitleTakenError({ title: trimmed }))
  }
  yield* telegram.setStickerSetTitle(volume.name, trimmed)
  const updated = yield* runQuery("Packs.rename", () =>
    updateStickerSetTitle(executor, volumeId, trimmed),
  )
  if (updated === undefined) {
    return yield* Effect.die(new Error("rename returned no row"))
  }
  return updated
})

class Packs extends Context.Service<Packs, PacksInterface>()("sutekkapakku/Packs") {
  static readonly layer = Layer.succeed(
    Packs,
    Packs.of({
      listVolumes,
      activeVolume,
      addSticker,
      removeSticker,
      renameVolume,
      refreshVolume,
      archiveVolume,
    }),
  )
}

export { Packs, STICKERS_PER_SET }
export type { AddStickerParams, PacksFailure, PacksInterface, RemoveStickerParams }
