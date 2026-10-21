import { createDb, createPool, runMigrations } from './db'

async function main() {
  const pool = createPool(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/porchlight')
  await runMigrations(createDb(pool))
  await pool.end()
  console.log('Migrations applied')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
