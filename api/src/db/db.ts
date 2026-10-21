import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import path from 'node:path'
import { Pool } from 'pg'
import * as schema from './schema'

export type Db = NodePgDatabase<typeof schema>
export const DB = Symbol('DB')

export function createPool(url: string) {
  return new Pool({ connectionString: url, max: 10 })
}

export function createDb(pool: Pool): Db {
  return drizzle(pool, { schema })
}

/** Works from both src/ (tsx, tests) and dist/ (production): migrations live in api/drizzle. */
export const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'drizzle')

export async function runMigrations(db: Db) {
  await migrate(db, { migrationsFolder: MIGRATIONS_DIR })
}
