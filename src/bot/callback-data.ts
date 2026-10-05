import { Option, Schema } from "effect"

const MenuView = Schema.Literals(["main", "packs", "add", "help", "remove"])
const PackAction = Schema.Literals(["open", "refresh", "remove", "rename", "browse"])

const CallbackData = Schema.Union([
  Schema.Struct({ kind: Schema.Literal("menu"), view: MenuView }),
  Schema.Struct({ kind: Schema.Literal("pack"), volumeId: Schema.Number, action: PackAction }),
  Schema.Struct({ kind: Schema.Literal("browse"), volumeId: Schema.Number, index: Schema.Number }),
  Schema.Struct({ kind: Schema.Literal("delete"), volumeId: Schema.Number, index: Schema.Number }),
  Schema.Struct({ kind: Schema.Literal("done") }),
  Schema.Struct({ kind: Schema.Literal("cancel") }),
  Schema.Struct({ kind: Schema.Literal("noop") }),
])

type Callback = Schema.Schema.Type<typeof CallbackData>

const DIGITS_PATTERN = /^\d+$/u

const encode = (callback: Callback): string => {
  switch (callback.kind) {
    case "menu": {
      return `m:${callback.view}`
    }
    case "pack": {
      return `p:${callback.volumeId}:${callback.action}`
    }
    case "browse": {
      return `b:${callback.volumeId}:${callback.index}`
    }
    case "delete": {
      return `d:${callback.volumeId}:${callback.index}`
    }
    case "done": {
      return "e"
    }
    case "cancel": {
      return "c"
    }
    case "noop": {
      return "n"
    }
    default: {
      return "n"
    }
  }
}

const parseMenu = (parts: string[]): unknown => {
  const [, view] = parts
  if (parts.length !== 2 || view === undefined) {
    return null
  }
  return { kind: "menu", view }
}

const parsePack = (parts: string[]): unknown => {
  const [, volumeId, action] = parts
  if (parts.length !== 3 || volumeId === undefined || action === undefined) {
    return null
  }
  if (!DIGITS_PATTERN.test(volumeId)) {
    return null
  }
  return { kind: "pack", volumeId: Number(volumeId), action }
}

const parseIndexed = (kind: "browse" | "delete", parts: string[]): unknown => {
  const [, volumeId, index] = parts
  if (parts.length !== 3 || volumeId === undefined || index === undefined) {
    return null
  }
  if (!DIGITS_PATTERN.test(volumeId) || !DIGITS_PATTERN.test(index)) {
    return null
  }
  return { kind, volumeId: Number(volumeId), index: Number(index) }
}

const parseCandidate = (parts: string[]): unknown => {
  const prefix = parts[0] ?? ""
  switch (prefix) {
    case "m": {
      return parseMenu(parts)
    }
    case "p": {
      return parsePack(parts)
    }
    case "b": {
      return parseIndexed("browse", parts)
    }
    case "d": {
      return parseIndexed("delete", parts)
    }
    case "e": {
      return parts.length === 1 ? { kind: "done" } : null
    }
    case "c": {
      return parts.length === 1 ? { kind: "cancel" } : null
    }
    case "n": {
      return parts.length === 1 ? { kind: "noop" } : null
    }
    default: {
      return null
    }
  }
}

const decode = (data: string): Callback | undefined =>
  Option.getOrUndefined(Schema.decodeUnknownOption(CallbackData)(parseCandidate(data.split(":"))))

export { decode, encode }
export type { Callback }
