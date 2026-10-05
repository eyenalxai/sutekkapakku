import path from "node:path"

const DEFAULT_BACKUP_DIRECTORY = "/home/ulezot/.local/share/sutekkapakku/backups"

const backupDirectory = Bun.env.SUTEKKAPAKKU_BACKUP_DIR ?? DEFAULT_BACKUP_DIRECTORY

const listBackupFiles = async (pattern: string): Promise<string[]> => {
  try {
    const glob = new Bun.Glob(pattern)
    return await Array.fromAsync(glob.scan(backupDirectory))
  } catch {
    return []
  }
}

const findProductionDump = async (): Promise<string | undefined> => {
  const files = await listBackupFiles("prod-*.dump")
  const newest = files.toSorted().at(-1)
  return newest === undefined ? undefined : path.join(backupDirectory, newest)
}

const findProductionSchema = async (): Promise<string | undefined> => {
  const schemaPath = path.join(backupDirectory, "prod-schema.sql")
  return (await Bun.file(schemaPath).exists()) ? schemaPath : undefined
}

export { findProductionDump, findProductionSchema }
