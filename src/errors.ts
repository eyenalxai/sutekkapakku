import { Schema } from "effect"

class TelegramApiError extends Schema.TaggedError<TelegramApiError>()("TelegramApiError", {
  method: Schema.String,
  description: Schema.String,
  error_code: Schema.optionalKey(Schema.Number),
  retry_after: Schema.optionalKey(Schema.Number),
  cause: Schema.optionalKey(Schema.Defect()),
}) {}

class ChatUnavailable extends Schema.TaggedError<ChatUnavailable>()("ChatUnavailable", {
  method: Schema.String,
  description: Schema.String,
}) {}

class StickerSetTooMuch extends Schema.TaggedError<StickerSetTooMuch>()("StickerSetTooMuch", {
  stickerSetName: Schema.String,
}) {}

class StickerSetInvalid extends Schema.TaggedError<StickerSetInvalid>()("StickerSetInvalid", {
  stickerSetName: Schema.String,
  description: Schema.String,
}) {}

class StickerSetNotModified extends Schema.TaggedError<StickerSetNotModified>()(
  "StickerSetNotModified",
  {
    stickerSetName: Schema.String,
  },
) {}

class StickerSetNameConflict extends Schema.TaggedError<StickerSetNameConflict>()(
  "StickerSetNameConflict",
  {
    name: Schema.String,
    description: Schema.String,
  },
) {}

class DatabaseError extends Schema.TaggedError<DatabaseError>()("DatabaseError", {
  operation: Schema.String,
  cause: Schema.Defect(),
}) {}

class InvalidConfiguration extends Schema.TaggedError<InvalidConfiguration>()(
  "InvalidConfiguration",
  {
    description: Schema.String,
  },
) {}

class VolumeTitleInvalid extends Schema.TaggedError<VolumeTitleInvalid>()("VolumeTitleInvalid", {
  title: Schema.String,
  minimum: Schema.Number,
  maximum: Schema.Number,
}) {}

class VolumeTitleTaken extends Schema.TaggedError<VolumeTitleTaken>()("VolumeTitleTaken", {
  title: Schema.String,
}) {}

export {
  ChatUnavailable,
  DatabaseError,
  InvalidConfiguration,
  StickerSetInvalid,
  StickerSetNameConflict,
  StickerSetNotModified,
  StickerSetTooMuch,
  TelegramApiError,
  VolumeTitleInvalid,
  VolumeTitleTaken,
}
