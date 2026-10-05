import type {
  File as TelegramFile,
  InlineKeyboardMarkup,
  InputFile,
  InputSticker,
  Message,
  StickerSet,
  User,
} from "grammy/types"

import { Context, Effect, Layer } from "effect"
import { Api } from "grammy"

import type {
  StickerSetOperationFailure,
  TelegramFailure,
  RetryableFailure,
  EditFailure,
} from "@/bot/telegram-failure"

import {
  isRateLimited,
  isTransient,
  telegramRetrySchedule,
  toEditFailure,
  toStickerSetFailure,
  toTelegramFailure,
} from "@/bot/telegram-failure"
import { AppConfiguration, tokenValue } from "@/config"
import { TelegramApiError } from "@/errors"

interface SendMessageOptions {
  readonly parse_mode?: "HTML"
  readonly reply_markup?: InlineKeyboardMarkup
}

interface AnswerCallbackQueryOptions {
  readonly text?: string
  readonly show_alert?: boolean
}

interface SendStickerOptions {
  readonly reply_markup?: InlineKeyboardMarkup
}

interface TelegramApiInterface {
  readonly getMe: () => Effect.Effect<User, TelegramFailure>
  readonly getFile: (fileId: string) => Effect.Effect<TelegramFile, TelegramFailure>
  readonly downloadFile: (fileId: string) => Effect.Effect<Uint8Array, TelegramFailure>
  readonly getStickerSet: (name: string) => Effect.Effect<StickerSet, StickerSetOperationFailure>
  readonly sendMessage: (
    chatId: number | string,
    text: string,
    options?: SendMessageOptions,
  ) => Effect.Effect<Message, TelegramFailure>
  readonly editMessageText: (
    chatId: number | string,
    messageId: number,
    text: string,
    options?: SendMessageOptions,
  ) => Effect.Effect<Message | true, EditFailure>
  readonly editMessageReplyMarkup: (
    chatId: number | string,
    messageId: number,
    options: { readonly reply_markup?: InlineKeyboardMarkup },
  ) => Effect.Effect<Message | true, EditFailure>
  readonly deleteMessage: (
    chatId: number | string,
    messageId: number,
  ) => Effect.Effect<boolean, TelegramFailure>
  readonly answerCallbackQuery: (
    callbackQueryId: string,
    options?: AnswerCallbackQueryOptions,
  ) => Effect.Effect<boolean, TelegramFailure>
  readonly sendSticker: (
    chatId: number | string,
    sticker: InputFile | string,
    options?: SendStickerOptions,
  ) => Effect.Effect<Message, TelegramFailure>
  readonly createNewStickerSet: (
    userId: number,
    name: string,
    title: string,
    stickers: readonly InputSticker[],
  ) => Effect.Effect<boolean, StickerSetOperationFailure>
  readonly addStickerToSet: (
    userId: number,
    name: string,
    sticker: InputSticker,
  ) => Effect.Effect<boolean, StickerSetOperationFailure>
  readonly deleteStickerFromSet: (
    stickerSetName: string,
    stickerId: string,
  ) => Effect.Effect<boolean, StickerSetOperationFailure>
  readonly setStickerSetTitle: (
    name: string,
    title: string,
  ) => Effect.Effect<boolean, StickerSetOperationFailure>
  readonly setWebhook: (url: string) => Effect.Effect<boolean, TelegramFailure>
}

const call = <A>(method: string, invoke: () => Promise<A>): Effect.Effect<A, TelegramFailure> =>
  Effect.tryPromise({
    try: invoke,
    catch: (cause) => toTelegramFailure(method, cause),
  })

const callEdit = <A>(method: string, invoke: () => Promise<A>): Effect.Effect<A, EditFailure> =>
  Effect.tryPromise({
    try: invoke,
    catch: (cause) => toEditFailure(method, cause),
  })

const callStickerSet = <A>(
  method: string,
  stickerSetName: string,
  invoke: () => Promise<A>,
): Effect.Effect<A, StickerSetOperationFailure> =>
  Effect.tryPromise({
    try: invoke,
    catch: (cause) => toStickerSetFailure(method, stickerSetName, cause),
  })

const retry = <A, E extends RetryableFailure>(
  effect: Effect.Effect<A, E>,
  predicate: (error: RetryableFailure) => boolean,
): Effect.Effect<A, E> =>
  Effect.retry(effect, { schedule: telegramRetrySchedule, while: predicate })

class TelegramApi extends Context.Service<TelegramApi, TelegramApiInterface>()(
  "sutekkapakku/TelegramApi",
) {
  static readonly layer = Layer.effect(
    TelegramApi,
    Effect.gen(function* makeTelegramApi() {
      const config = yield* AppConfiguration
      const api = new Api(tokenValue(config))
      return TelegramApi.of({
        getMe: () =>
          retry(
            call("getMe", () => api.getMe()),
            isTransient,
          ),
        getFile: (fileId) =>
          retry(
            call("getFile", () => api.getFile(fileId)),
            isTransient,
          ),
        downloadFile: (fileId) =>
          retry(
            Effect.gen(function* downloadFileEffect() {
              const file = yield* call("getFile", () => api.getFile(fileId))
              const filePath = file.file_path
              if (filePath === undefined || filePath.length === 0) {
                return yield* Effect.fail(
                  new TelegramApiError({ method: "getFile", description: "File path is missing" }),
                )
              }
              const url = `https://api.telegram.org/file/bot${tokenValue(config)}/${filePath}`
              const response = yield* Effect.tryPromise({
                try: () => fetch(url),
                catch: (cause) =>
                  new TelegramApiError({
                    method: "downloadFile",
                    description: cause instanceof Error ? cause.message : String(cause),
                    cause,
                  }),
              })
              if (!response.ok) {
                return yield* Effect.fail(
                  new TelegramApiError({
                    method: "downloadFile",
                    description: `Failed to download Telegram file: ${response.status}`,
                  }),
                )
              }
              const bytes = yield* Effect.tryPromise({
                try: () => response.arrayBuffer(),
                catch: (cause) =>
                  new TelegramApiError({
                    method: "downloadFile",
                    description: cause instanceof Error ? cause.message : String(cause),
                    cause,
                  }),
              })
              return new Uint8Array(bytes)
            }),
            isTransient,
          ),
        getStickerSet: (name) =>
          retry(
            callStickerSet("getStickerSet", name, () => api.getStickerSet(name)),
            isTransient,
          ),
        sendMessage: (chatId, text, options) =>
          retry(
            call("sendMessage", () => api.sendMessage(chatId, text, options)),
            isRateLimited,
          ),
        editMessageText: (chatId, messageId, text, options) =>
          retry(
            callEdit("editMessageText", () =>
              api.editMessageText(chatId, messageId, text, options),
            ),
            isRateLimited,
          ),
        editMessageReplyMarkup: (chatId, messageId, options) =>
          retry(
            callEdit("editMessageReplyMarkup", () =>
              api.editMessageReplyMarkup(chatId, messageId, options),
            ),
            isRateLimited,
          ),
        deleteMessage: (chatId, messageId) =>
          retry(
            call("deleteMessage", () => api.deleteMessage(chatId, messageId)),
            isRateLimited,
          ),
        answerCallbackQuery: (callbackQueryId, options) =>
          retry(
            call("answerCallbackQuery", () => api.answerCallbackQuery(callbackQueryId, options)),
            isRateLimited,
          ),
        sendSticker: (chatId, sticker, options) =>
          retry(
            call("sendSticker", () => api.sendSticker(chatId, sticker, options)),
            isRateLimited,
          ),
        createNewStickerSet: (userId, name, title, stickers) =>
          callStickerSet("createNewStickerSet", name, () =>
            api.createNewStickerSet(userId, name, title, [...stickers]),
          ),
        addStickerToSet: (userId, name, sticker) =>
          retry(
            callStickerSet("addStickerToSet", name, () =>
              api.addStickerToSet(userId, name, sticker),
            ),
            isRateLimited,
          ),
        deleteStickerFromSet: (stickerSetName, stickerId) =>
          callStickerSet("deleteStickerFromSet", stickerSetName, () =>
            api.deleteStickerFromSet(stickerId),
          ),
        setStickerSetTitle: (name, title) =>
          callStickerSet("setStickerSetTitle", name, () => api.setStickerSetTitle(name, title)),
        setWebhook: (url) =>
          retry(
            call("setWebhook", () => api.setWebhook(url)),
            isRateLimited,
          ),
      })
    }),
  )
}

export { TelegramApi }
export type {
  AnswerCallbackQueryOptions,
  SendMessageOptions,
  SendStickerOptions,
  TelegramApiInterface,
}
