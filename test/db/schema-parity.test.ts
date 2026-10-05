import { expect, test } from "bun:test"
import path from "node:path"

import { diffSchemaStatements, dumpSchema, normalizeSchemaDump } from "./dump-tools"
import { findProductionSchema } from "./production-fixtures"
import { createTestDatabase } from "./test-database"

const productionSchemaPath = await findProductionSchema()

if (productionSchemaPath === undefined) {
  process.stdout.write("schema parity: skipped (no prod-schema.sql in the backup directory)\n")
}

const parityTest = productionSchemaPath === undefined ? test.skip : test

parityTest(
  productionSchemaPath === undefined
    ? "schema parity (skipped: no prod-schema.sql in the backup directory)"
    : `schema parity (${path.basename(productionSchemaPath)})`,
  async () => {
    if (productionSchemaPath === undefined) {
      throw new Error("missing production schema fixture")
    }
    const database = await createTestDatabase()
    try {
      const freshDump = await dumpSchema(database.databaseUrl)
      const productionDump = await Bun.file(productionSchemaPath).text()
      const productionStatements = normalizeSchemaDump(productionDump)
      const freshStatements = normalizeSchemaDump(freshDump)
      const differences = diffSchemaStatements(productionStatements, freshStatements)
      process.stdout.write(
        `schema parity: ${productionStatements.length} production statements, ${freshStatements.length} fresh statements, ${differences.length} differences\n`,
      )
      expect({ differences, statements: freshStatements.length }).toEqual({
        differences: [],
        statements: productionStatements.length,
      })
    } finally {
      await database.close()
    }
  },
)
