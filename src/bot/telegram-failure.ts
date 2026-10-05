import { Duration, Effect, Schedule } from "effect"
import { GrammyError, HttpError } from "grammy"

import type {
  ChatUnavailable,
  StickerSetInvalid,
  StickerSetNameConflict,
  StickerSetNotModified,
  StickerSetTooMuch,
  TelegramApiError,
} from "@/errors"

import {
  ChatUnavailable as ChatUnavailableError,
  StickerSetInvalid as StickerSetInvalidError,
  StickerSetNameConflict as StickerSetNameConflictError,
  StickerSetNotModified as StickerSetNotModifiedError,
  StickerSetTooMuch as StickerSetTooMuchError,
  TelegramApiError as TelegramApiErrorClass,
} from "@/errors"

type TelegramFailure = TelegramApiError | ChatUnavailable

type StickerSetFailure =
  | StickerSetTooMuch
  | StickerSetInvalid
  | StickerSetNotModified
  | StickerSetNameConflict

type StickerSetOperationFailure = TelegramFailure | StickerSetFailure

const CHAT_UNAVAILABLE_PATTERN =
  /chat not found|bot was blocked by the user|bot can't initiate conversation|user is deactivated/iu

const STICKER_SET_INVALID_PATTERN = /STICKERSET_INVALID|sticker set not found/iu
const STICKER_SET_NAME_CONFLICT_PATTERN =
  /sticker set name is already occupied|invalid sticker set name is specified/iu

const toTelegramFailure = (method: string, cause: unknown): TelegramFailure => {
  if (cause instanceof GrammyError) {
    if (CHAT_UNAVAILABLE_PATTERN.test(cause.description)) {
      return new ChatUnavailableError({ method, description: cause.description })
    }
    return new TelegramApiErrorClass({
      method,
      description: cause.description,
      error_code: cause.error_code,
      ...(cause.parameters.retry_after === undefined
        ? {}
        : { retry_after: cause.parameters.retry_after }),
      cause,
    })
  }
  if (cause instanceof HttpError) {
    return new TelegramApiErrorClass({
      method,
      description: `HTTP request failed: ${cause.message}`,
      cause,
    })
  }
  return new TelegramApiErrorClass({
    method,
    description: cause instanceof Error ? cause.message : String(cause),
    cause,
  })
}

const toStickerSetFailure = (
  method: string,
  stickerSetName: string,
  cause: unknown,
): TelegramFailure | StickerSetFailure => {
  if (cause instanceof GrammyError) {
    const { description } = cause
    if (description.includes("STICKERS_TOO_MUCH")) {
      return new StickerSetTooMuchError({ stickerSetName })
    }
    if (STICKER_SET_INVALID_PATTERN.test(description)) {
      return new StickerSetInvalidError({ stickerSetName, description })
    }
    if (description.includes("STICKERSET_NOT_MODIFIED")) {
      return new StickerSetNotModifiedError({ stickerSetName })
    }
    if (STICKER_SET_NAME_CONFLICT_PATTERN.test(description)) {
      return new StickerSetNameConflictError({ name: stickerSetName, description })
    }
  }
  return toTelegramFailure(method, cause)
}

const isRateLimited = (error: TelegramFailure | StickerSetFailure): boolean =>
  error._tag === "TelegramApiError" && error.error_code === 429

const isTransient = (error: TelegramFailure | StickerSetFailure): boolean =>
  error._tag === "TelegramApiError" && (error.error_code === 429 || error.error_code === undefined)

const telegramRetrySchedule: Schedule.Schedule<unknown, TelegramFailure | StickerSetFailure> =
  Schedule.exponential("500 millis").pipe(
    Schedule.jittered,
    Schedule.upTo({ times: 3 }),
    Schedule.setInputType<TelegramFailure | StickerSetFailure>(),
    Schedule.passthrough,
    Schedule.modifyDelay(({ input, duration }) =>
      Effect.succeed(
        input._tag === "TelegramApiError" && input.retry_after !== undefined
          ? Duration.max(duration, Duration.seconds(input.retry_after))
          : duration,
      ),
    ),
  )

export { isRateLimited, isTransient, telegramRetrySchedule, toStickerSetFailure, toTelegramFailure }
export type { StickerSetFailure, StickerSetOperationFailure, TelegramFailure }
