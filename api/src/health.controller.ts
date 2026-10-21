import { Controller, Get, Inject } from '@nestjs/common'
import { sql } from 'drizzle-orm'
import { Public } from './auth/decorators'
import { DB, type Db } from './db/db'

@Controller('health')
export class HealthController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Public()
  @Get()
  async health() {
    await this.db.execute(sql`select 1`)
    return { status: 'ok' }
  }
}
