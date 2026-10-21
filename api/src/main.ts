import 'reflect-metadata'
import { createApp } from './bootstrap'
import { loadConfig } from './config'
import { createDb, createPool, runMigrations } from './db/db'

async function main() {
  const config = loadConfig()
  // Apply pending migrations before taking traffic.
  const pool = createPool(config.databaseUrl)
  await runMigrations(createDb(pool))
  await pool.end()

  const app = await createApp(config)
  await app.listen(config.port, '0.0.0.0')
  console.log(`Porchlight API on http://localhost:${config.port}/api`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
