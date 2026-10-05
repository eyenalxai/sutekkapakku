import { describe, expect, test } from "bun:test"

import { loadConfig } from "@/config"

const baseEnv: Record<string, string> = {
  API_TOKEN: "123456:secret",
  ADMIN_USERNAME: "admin",
  DATABASE_URL: "postgres://user:pass@localhost:5432/sutekkapakku",
  DOMAIN: "example.com",
  PORT: "3000",
  POLL_TYPE: "WEBHOOK",
}

const without = (name: string): Record<string, string> => {
  const env = { ...baseEnv }
  Reflect.deleteProperty(env, name)
  return env
}

const withOverride = (overrides: Record<string, string>): Record<string, string> => ({
  ...baseEnv,
  ...overrides,
})

describe("loadConfig", () => {
  test("returns the parsed config for a valid environment", () => {
    expect(loadConfig(baseEnv)).toEqual({
      apiToken: "123456:secret",
      adminUsername: "admin",
      databaseUrl: "postgres://user:pass@localhost:5432/sutekkapakku",
      domain: "example.com",
      port: 3000,
      pollType: "WEBHOOK",
      mainBotPath: "/webhook/main",
    })
  })

  test("accepts POLLING for POLL_TYPE", () => {
    expect(loadConfig(withOverride({ POLL_TYPE: "POLLING" })).pollType).toBe("POLLING")
  })

  const requiredVariables = [
    "API_TOKEN",
    "ADMIN_USERNAME",
    "DATABASE_URL",
    "DOMAIN",
    "PORT",
    "POLL_TYPE",
  ]

  for (const name of requiredVariables) {
    test(`rejects a missing ${name}`, () => {
      expect(() => loadConfig(without(name))).toThrow(name)
    })

    test(`rejects an empty ${name}`, () => {
      expect(() => loadConfig({ ...baseEnv, [name]: "" })).toThrow(name)
    })
  }

  test("rejects a non-integer PORT", () => {
    expect(() => loadConfig(withOverride({ PORT: "abc" }))).toThrow("PORT")
  })

  test("rejects PORT below 1", () => {
    expect(() => loadConfig(withOverride({ PORT: "0" }))).toThrow("PORT")
  })

  test("rejects PORT above 65535", () => {
    expect(() => loadConfig(withOverride({ PORT: "65536" }))).toThrow("PORT")
  })

  test("rejects an unknown POLL_TYPE", () => {
    expect(() => loadConfig(withOverride({ POLL_TYPE: "webhook" }))).toThrow("POLL_TYPE")
  })

  test("rejects a DOMAIN with a scheme", () => {
    expect(() => loadConfig(withOverride({ DOMAIN: "https://example.com" }))).toThrow("DOMAIN")
  })

  test("rejects a DOMAIN starting with http", () => {
    expect(() => loadConfig(withOverride({ DOMAIN: "httpbin.org" }))).toThrow("DOMAIN")
  })

  test("rejects a DOMAIN ending with a slash", () => {
    expect(() => loadConfig(withOverride({ DOMAIN: "example.com/" }))).toThrow("DOMAIN")
  })
})
