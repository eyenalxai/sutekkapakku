interface TelegramApiCall {
  method: string
  params: Record<string, unknown>
}

interface TelegramApiFailure {
  status?: number
  errorCode?: number
  description?: string
}

interface TelegramApiUser {
  id: number
  is_bot: boolean
  first_name: string
  username: string
}

interface FakeTelegramFile {
  file_path: string
  data?: Uint8Array
  content_type?: string
}

type TelegramApiMethodHandler = (
  params: Record<string, unknown>,
) => Record<string, unknown> | boolean

interface FakeTelegramApiOptions {
  botUser?: TelegramApiUser
  files?: Record<string, FakeTelegramFile>
  methods?: Record<string, TelegramApiMethodHandler>
}

interface FakeTelegramApi {
  apiRoot: string
  botUser: TelegramApiUser
  calls: TelegramApiCall[]
  callsFor: (method: string) => TelegramApiCall[]
  clearCalls: () => void
  failNext: (method: string, failure?: TelegramApiFailure) => void
  setFile: (fileId: string, file: FakeTelegramFile) => void
  stop: () => Promise<void>
}

const DEFAULT_BOT_USER: TelegramApiUser = {
  id: 42_424_242,
  is_bot: true,
  first_name: "Sutekkapakku Test",
  username: "sutekkapakku_test_bot",
}

const BOT_PATH_PREFIX = "/bot"
const FILE_PATH_PREFIX = "/file/bot"

const parseMethod = (pathname: string): string | undefined => {
  if (!pathname.startsWith(BOT_PATH_PREFIX)) {
    return undefined
  }
  const rest = pathname.slice(BOT_PATH_PREFIX.length)
  const separator = rest.indexOf("/")
  if (separator === -1) {
    return undefined
  }
  const method = rest.slice(separator + 1)
  return method.length === 0 ? undefined : method
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const parseParams = async (request: Request): Promise<Record<string, unknown>> => {
  const contentType = request.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const body: unknown = await request.json()
    return isRecord(body) ? body : {}
  }
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData()
    return Object.fromEntries(form.entries())
  }
  return {}
}

const createFakeTelegramApi = (options: FakeTelegramApiOptions = {}): FakeTelegramApi => {
  const botUser = options.botUser ?? DEFAULT_BOT_USER
  const failures = new Map<string, TelegramApiFailure[]>()
  const files = new Map<string, FakeTelegramFile>(Object.entries(options.files ?? {}))
  const calls: TelegramApiCall[] = []
  let messageId = 0

  const resolveResult = (
    method: string,
    params: Record<string, unknown>,
  ): Record<string, unknown> | boolean => {
    const custom = options.methods?.[method]
    if (custom !== undefined) {
      return custom(params)
    }
    switch (method) {
      case "getFile": {
        const fileId = String(params.file_id)
        const file = files.get(fileId)
        if (file === undefined) {
          return { file_id: fileId, file_unique_id: `unique_${fileId}` }
        }
        return {
          file_id: fileId,
          file_unique_id: `unique_${fileId}`,
          file_path: file.file_path,
          file_size: file.data?.byteLength,
        }
      }
      case "getMe": {
        return { ...botUser }
      }
      case "sendMessage": {
        messageId += 1
        return {
          message_id: messageId,
          date: Math.floor(Date.now() / 1000),
          chat: { id: params.chat_id, type: "private" },
          from: botUser,
          text: params.text,
        }
      }
      default: {
        return true
      }
    }
  }

  const server = Bun.serve({
    port: 0,
    async fetch(request) {
      const url = new URL(request.url)
      if (url.pathname.startsWith(FILE_PATH_PREFIX)) {
        const filePath = decodeURIComponent(
          url.pathname.slice(FILE_PATH_PREFIX.length).split("/").slice(1).join("/"),
        )
        const file = [...files.values()].find((candidate) => candidate.file_path === filePath)
        if (file === undefined) {
          return new Response("Not Found", { status: 404 })
        }
        return new Response(file.data === undefined ? null : new Uint8Array(file.data).buffer, {
          headers: { "content-type": file.content_type ?? "application/octet-stream" },
        })
      }

      const method = parseMethod(url.pathname)
      if (method === undefined) {
        return new Response("Not Found", { status: 404 })
      }

      const params = await parseParams(request)
      calls.push({ method, params })

      const failure = failures.get(method)?.shift()
      if (failure !== undefined) {
        const status = failure.status ?? 500
        return Response.json(
          {
            ok: false,
            error_code: failure.errorCode ?? status,
            description: failure.description ?? `fake ${method} failure`,
          },
          { status },
        )
      }

      return Response.json({ ok: true, result: resolveResult(method, params) })
    },
  })

  const stop = async (): Promise<void> => {
    await server.stop(true)
  }

  const callsFor = (method: string): TelegramApiCall[] =>
    calls.filter((call) => call.method === method)

  const clearCalls = (): void => {
    calls.length = 0
  }

  const failNext = (method: string, failure: TelegramApiFailure = {}): void => {
    const queue = failures.get(method) ?? []
    queue.push(failure)
    failures.set(method, queue)
  }

  return {
    apiRoot: `http://127.0.0.1:${server.port}`,
    botUser,
    calls,
    callsFor,
    clearCalls,
    failNext,
    setFile: (fileId, file) => {
      files.set(fileId, file)
    },
    stop,
  }
}

export { createFakeTelegramApi }
export type {
  FakeTelegramApi,
  FakeTelegramApiOptions,
  FakeTelegramFile,
  TelegramApiCall,
  TelegramApiFailure,
  TelegramApiMethodHandler,
  TelegramApiUser,
}
