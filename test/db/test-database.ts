import path from "node:path"

import type { Db } from "@/db/client"

import { createDb } from "@/db/client"

import { runCommand } from "./run-command"

const CONTAINER_NAME = "sutekkapakku-test-postgres"
const POSTGRES_IMAGE = "postgres:15-alpine"
const POSTGRES_HOST = "127.0.0.1"
const POSTGRES_USER = "postgres"
const POSTGRES_PASSWORD = "postgres"
const FIRST_PORT = 55_432
const LAST_PORT = 55_632
const STARTUP_TIMEOUT_MS = 120_000
const POLL_INTERVAL_MS = 500
const CONTAINER_ATTEMPTS = 3

const repositoryRoot = path.join(import.meta.dir, "..", "..")

interface TestDatabase {
  databaseUrl: string
  db: Db
  close: () => Promise<void>
}

const ensureDocker = async (): Promise<void> => {
  const result = await runCommand(["docker", "info"])
  if (result.exitCode !== 0) {
    throw new Error(
      `Docker is required to provision the test Postgres database: ${result.stderr.trim()}`,
    )
  }
}

const findFreePort = async (): Promise<number> => {
  const result = await runCommand(["ss", "-ltn"])
  if (result.exitCode !== 0) {
    throw new Error(`ss -ltn failed: ${result.stderr.trim()}`)
  }
  const busyPorts = new Set<number>()
  for (const line of result.stdout.split("\n")) {
    const localAddress = line.trim().split(/\s+/u)[3] ?? ""
    const match = /:(?<port>\d+)$/u.exec(localAddress)
    const port = match?.groups?.port
    if (port !== undefined) {
      busyPorts.add(Number(port))
    }
  }
  const candidates = Array.from(
    { length: LAST_PORT - FIRST_PORT + 1 },
    (_, index) => FIRST_PORT + index,
  )
  const freePort = candidates.find((port) => !busyPorts.has(port))
  if (freePort === undefined) {
    throw new Error(
      `no free port between ${FIRST_PORT} and ${LAST_PORT} for the test Postgres container`,
    )
  }
  return freePort
}

const inspectContainer = async (format: string): Promise<string | undefined> => {
  const result = await runCommand(["docker", "inspect", "--format", format, CONTAINER_NAME])
  return result.exitCode === 0 ? result.stdout.trim() : undefined
}

const containerExists = async (): Promise<boolean> =>
  (await inspectContainer("{{.Id}}")) !== undefined

const containerIsRunning = async (): Promise<boolean> =>
  (await inspectContainer("{{.State.Running}}")) === "true"

const containerPort = async (): Promise<number> => {
  const result = await runCommand(["docker", "port", CONTAINER_NAME, "5432/tcp"])
  if (result.exitCode !== 0) {
    throw new Error(`could not read the test Postgres container port: ${result.stdout.trim()}`)
  }
  const match = /:(?<port>\d+)\s*$/u.exec(result.stdout.trim())
  const port = match?.groups?.port
  if (port === undefined) {
    throw new Error(`unexpected docker port output: ${result.stdout}`)
  }
  return Number(port)
}

const waitForContainerRunning = async (deadline: number): Promise<void> => {
  if (await containerIsRunning()) {
    return
  }
  if (Date.now() > deadline) {
    throw new Error(`the ${CONTAINER_NAME} container did not start`)
  }
  await Bun.sleep(POLL_INTERVAL_MS)
  return waitForContainerRunning(deadline)
}

const waitForPostgres = async (port: number, deadline: number): Promise<void> => {
  const result = await runCommand([
    "pg_isready",
    "--host",
    POSTGRES_HOST,
    "--port",
    String(port),
    "--username",
    POSTGRES_USER,
    "--quiet",
  ])
  if (result.exitCode === 0) {
    return
  }
  if (Date.now() > deadline) {
    throw new Error(`Postgres did not become ready on ${POSTGRES_HOST}:${port}`)
  }
  await Bun.sleep(POLL_INTERVAL_MS)
  return waitForPostgres(port, deadline)
}

const createContainer = async (attempt: number): Promise<void> => {
  const port = await findFreePort()
  const result = await runCommand([
    "docker",
    "run",
    "--detach",
    "--name",
    CONTAINER_NAME,
    "--env",
    `POSTGRES_USER=${POSTGRES_USER}`,
    "--env",
    `POSTGRES_PASSWORD=${POSTGRES_PASSWORD}`,
    "--publish",
    `${POSTGRES_HOST}:${port}:5432`,
    POSTGRES_IMAGE,
  ])
  if (result.exitCode === 0) {
    return
  }
  if (await containerExists()) {
    return
  }
  if (attempt >= CONTAINER_ATTEMPTS) {
    throw new Error(`failed to start the test Postgres container: ${result.stderr.trim()}`)
  }
  await Bun.sleep(POLL_INTERVAL_MS)
  return createContainer(attempt + 1)
}

const startContainerIfNeeded = async (deadline: number): Promise<void> => {
  if (await containerIsRunning()) {
    return
  }
  if (await containerExists()) {
    const result = await runCommand(["docker", "start", CONTAINER_NAME])
    if (result.exitCode !== 0) {
      throw new Error(
        `failed to start the existing test Postgres container: ${result.stderr.trim()}`,
      )
    }
  } else {
    await createContainer(1)
  }
  await waitForContainerRunning(deadline)
}

const ensureContainer = async (): Promise<number> => {
  await ensureDocker()
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  await startContainerIfNeeded(deadline)
  const port = await containerPort()
  await waitForPostgres(port, deadline)
  return port
}

const createDatabase = async (port: number, name: string): Promise<void> => {
  const result = await runCommand(
    [
      "createdb",
      "--host",
      POSTGRES_HOST,
      "--port",
      String(port),
      "--username",
      POSTGRES_USER,
      name,
    ],
    { env: { PGPASSWORD: POSTGRES_PASSWORD } },
  )
  if (result.exitCode !== 0) {
    throw new Error(`createdb ${name} failed: ${result.stderr.trim()}`)
  }
}

const dropDatabase = async (port: number, name: string): Promise<void> => {
  await runCommand(
    [
      "dropdb",
      "--if-exists",
      "--host",
      POSTGRES_HOST,
      "--port",
      String(port),
      "--username",
      POSTGRES_USER,
      name,
    ],
    { env: { PGPASSWORD: POSTGRES_PASSWORD } },
  )
}

const runMigrations = async (databaseUrl: string): Promise<void> => {
  const result = await runCommand([process.execPath, "--bun", "run", "db:migrate"], {
    cwd: repositoryRoot,
    env: { DATABASE_URL: databaseUrl },
  })
  if (result.exitCode !== 0) {
    throw new Error(`db:migrate failed:\n${result.stdout}\n${result.stderr}`)
  }
}

const createTestDatabase = async (): Promise<TestDatabase> => {
  const port = await ensureContainer()
  const name = `sutekkapakku_test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  await createDatabase(port, name)
  const databaseUrl = `postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${port}/${name}`
  try {
    await runMigrations(databaseUrl)
  } catch (error) {
    await dropDatabase(port, name)
    throw error
  }
  const db = createDb(databaseUrl)
  const close = async (): Promise<void> => {
    await db.$client.close()
    await dropDatabase(port, name)
  }
  return { close, databaseUrl, db }
}

export { createTestDatabase }
export type { TestDatabase }
