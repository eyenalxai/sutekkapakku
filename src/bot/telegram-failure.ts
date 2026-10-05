import { Duration, Effect, Schedule } from "effect"
import { GrammyError, HttpError } from "grammy"

import type {
  ChatUnavailable,
  MessageNotEditable,
  MessageNotModified,
  StickerSetInvalid,
  StickerSetNameConflict,
  StickerSetNotModified,
  StickerSetTooMuch,
  TelegramApiError,
} from "@/errors"

import {
  ChatUnavailable as ChatUnavailableError,
  MessageNotEditable as MessageNotEditableError,
  MessageNotModified as MessageNotModifiedError,
  StickerSetInvalid as StickerSetInvalidError,
  StickerSetNameConflict as StickerSetNameConflictError,
  StickerSetNotModified as StickerSetNotModifiedError,
  StickerSetTooMuch as StickerSetTooMuchError,
  TelegramApiError as TelegramApiErrorClass,
} from "@/errors"

type TelegramFailure = TelegramApiError | ChatUnavailable

type EditFailure = TelegramFailure | MessageNotModified | MessageNotEditable

type StickerSetFailure =
  | StickerSetTooMuch
  | StickerSetInvalid
  | StickerSetNotModified
  | StickerSetNameConflict

type StickerSetOperationFailure = TelegramFailure | StickerSetFailure

type RetryableFailure = StickerSetOperationFailure | MessageNotModified | MessageNotEditable

const CHAT_UNAVAILABLE_PATTERN =
  /chat not found|bot was blocked by the user|bot can't initiate conversation|user is deactivated/iu

const STICKER_SET_INVALID_PATTERN = /STICKERSET_INVALID|sticker set not found/iu
const STICKER_SET_NAME_CONFLICT_PATTERN =
  /sticker set name is already occupied|invalid sticker set name is specified/iu
const MESSAGE_NOT_MODIFIED_PATTERN = /message is not modified/iu
const MESSAGE_NOT_EDITABLE_PATTERN =
  /message to edit not found|message can't be edited|there is no text in the message to edit|MESSAGE_EDIT_TIME_EXPIRED/iu

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

const toEditFailure = (method: string, cause: unknown): EditFailure => {
  if (cause instanceof GrammyError) {
    if (MESSAGE_NOT_MODIFIED_PATTERN.test(cause.description)) {
      return new MessageNotModifiedError({ method, description: cause.description })
    }
    if (MESSAGE_NOT_EDITABLE_PATTERN.test(cause.description)) {
      return new MessageNotEditableError({ method, description: cause.description })
    }
  }
  return toTelegramFailure(method, cause)
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

const isRateLimited = (error: RetryableFailure): boolean =>
  error._tag === "TelegramApiError" && error.error_code === 429

const isTransient = (error: RetryableFailure): boolean =>
  error._tag === "TelegramApiError" && (error.error_code === 429 || error.error_code === undefined)

const telegramRetrySchedule: Schedule.Schedule<unknown, RetryableFailure> = Schedule.exponential(
  "500 millis",
).pipe(
  Schedule.jittered,
  Schedule.upTo({ times: 3 }),
  Schedule.setInputType<RetryableFailure>(),
  Schedule.passthrough,
  Schedule.modifyDelay(({ input, duration }) =>
    Effect.succeed(
      input._tag === "TelegramApiError" && input.retry_after !== undefined
        ? Duration.max(duration, Duration.seconds(input.retry_after))
        : duration,
    ),
  ),
)

export {
  isRateLimited,
  isTransient,
  telegramRetrySchedule,
  toEditFailure,
  toStickerSetFailure,
  toTelegramFailure,
}
export type {
  EditFailure,
  RetryableFailure,
  StickerSetFailure,
  StickerSetOperationFailure,
  TelegramFailure,
}
