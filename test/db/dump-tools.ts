import { runCommand } from "./run-command"

const ALLOWED_RESTORE_ERRORS = ['unrecognized configuration parameter "transaction_timeout"']

const OWNERSHIP_STATEMENT = /^ALTER (?:TABLE|TYPE|SEQUENCE) .* OWNER TO /u

const dumpSchema = async (databaseUrl: string): Promise<string> => {
  const result = await runCommand([
    "pg_dump",
    "--schema-only",
    "--no-owner",
    "--no-privileges",
    "--dbname",
    databaseUrl,
  ])
  if (result.exitCode !== 0) {
    throw new Error(`pg_dump failed: ${result.stderr.trim()}`)
  }
  return result.stdout
}

const normalizeSchemaDump = (dump: string): string[] =>
  dump
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith("--"))
    .filter((line) => !line.startsWith("SET "))
    .filter((line) => !line.startsWith("SELECT pg_catalog.set_config"))
    .filter((line) => !line.startsWith(String.raw`\restrict`))
    .filter((line) => !line.startsWith(String.raw`\unrestrict`))
    .filter((line) => !line.startsWith("CREATE EXTENSION"))
    .filter((line) => !line.startsWith("COMMENT ON EXTENSION"))
    .filter((line) => !OWNERSHIP_STATEMENT.test(line))
    .join(" ")
    .split(";")
    .map((statement) => statement.replaceAll(/\s+/gu, " ").trim())
    .filter((statement) => statement.length > 0)
    .filter((statement) => !statement.includes("alembic_version"))
    .filter((statement) => !statement.includes("drizzle"))
    .toSorted()

const diffSchemaStatements = (expected: string[], actual: string[]): string[] => {
  const actualSet = new Set(actual)
  const expectedSet = new Set(expected)
  const missing = expected
    .filter((statement) => !actualSet.has(statement))
    .map((statement) => `- ${statement}`)
  const extra = actual
    .filter((statement) => !expectedSet.has(statement))
    .map((statement) => `+ ${statement}`)
  return [...missing, ...extra]
}

const restoreData = async (
  databaseUrl: string,
  dumpPath: string,
  tables: string[],
): Promise<void> => {
  const result = await runCommand([
    "pg_restore",
    "--data-only",
    "--no-owner",
    "--strict-names",
    ...tables.flatMap((table) => ["--table", table]),
    "--dbname",
    databaseUrl,
    dumpPath,
  ])
  if (result.exitCode === 0) {
    return
  }
  const errorLines = result.stderr
    .split("\n")
    .filter((line) => line.startsWith("pg_restore: error:"))
  const onlyKnownErrors =
    errorLines.length > 0 &&
    errorLines.every((line) => ALLOWED_RESTORE_ERRORS.some((allowed) => line.includes(allowed)))
  if (!onlyKnownErrors) {
    throw new Error(`pg_restore failed:\n${result.stderr}`)
  }
}

export { diffSchemaStatements, dumpSchema, normalizeSchemaDump, restoreData }
