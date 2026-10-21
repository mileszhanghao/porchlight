import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common'
import type { Pool } from 'pg'
import { CONFIG, type AppConfig } from '../config'
import { createDb, createPool, DB } from './db'

const POOL = Symbol('POOL')

@Global()
@Module({
  providers: [
    { provide: POOL, inject: [CONFIG], useFactory: (c: AppConfig) => createPool(c.databaseUrl) },
    { provide: DB, inject: [POOL], useFactory: (pool: Pool) => createDb(pool) },
  ],
  exports: [DB],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end()
  }
}
