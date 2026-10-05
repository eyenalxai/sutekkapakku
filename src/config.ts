const MAIN_BOT_PATH = "/webhook/main"

const requireEnv = (env: Bun.Env, name: string): string => {
  const record: Record<string, string | undefined> = { ...env }
  const value = record[name]
  if (value === undefined || value.length === 0) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

const parsePort = (value: string): number => {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got "${value}"`)
  }
  return port
}

const parseDomain = (value: string): string => {
  if (value.includes("://") || value.startsWith("http")) {
    throw new Error(`DOMAIN must not include a scheme, got "${value}"`)
  }
  if (value.endsWith("/")) {
    throw new Error(`DOMAIN must not end with a slash, got "${value}"`)
  }
  return value
}

const parsePollType = (value: string): "WEBHOOK" | "POLLING" => {
  if (value !== "WEBHOOK" && value !== "POLLING") {
    throw new Error(`POLL_TYPE must be either "WEBHOOK" or "POLLING", got "${value}"`)
  }
  return value
}

export interface Config {
  apiToken: string
  adminUsername: string
  databaseUrl: string
  domain: string
  port: number
  pollType: "WEBHOOK" | "POLLING"
  mainBotPath: string
}

export const loadConfig = (env: Bun.Env): Config => ({
  apiToken: requireEnv(env, "API_TOKEN"),
  adminUsername: requireEnv(env, "ADMIN_USERNAME"),
  databaseUrl: requireEnv(env, "DATABASE_URL"),
  domain: parseDomain(requireEnv(env, "DOMAIN")),
  port: parsePort(requireEnv(env, "PORT")),
  pollType: parsePollType(requireEnv(env, "POLL_TYPE")),
  mainBotPath: MAIN_BOT_PATH,
})
