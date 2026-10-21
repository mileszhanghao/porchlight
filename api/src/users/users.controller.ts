import { Body, ConflictException, Controller, Get, Inject, Post } from '@nestjs/common'
import { asc } from 'drizzle-orm'
import { z } from 'zod'
import { Can } from '../auth/auth.types'
import { Roles } from '../auth/decorators'
import { hashPassword } from '../auth/password'
import { ZodPipe } from '../common/zod.pipe'
import { DB, type Db } from '../db/db'
import { role, users } from '../db/schema'

const CreateUser = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.email().transform((e) => e.toLowerCase()),
  unit: z.string().trim().max(20).optional(),
  role: z.enum(role.enumValues).default('resident'),
  password: z.string().min(10).max(200),
})

/** Accounts are created by the manager (residents are verified owners or tenants), not by open sign-up. */
@Controller('users')
@Roles(...Can.manageUsers)
export class UsersController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  list() {
    return this.db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role, unit: users.unit })
      .from(users)
      .orderBy(asc(users.name))
  }

  @Post()
  async create(@Body(new ZodPipe(CreateUser)) body: z.infer<typeof CreateUser>) {
    try {
      const [row] = await this.db
        .insert(users)
        .values({ ...body, unit: body.unit ?? null, passwordHash: await hashPassword(body.password) })
        .returning({ id: users.id, name: users.name, email: users.email, role: users.role, unit: users.unit })
      return row
    } catch (e) {
      if ((e as { cause?: { code?: string } }).cause?.code === '23505' || (e as { code?: string }).code === '23505') {
        throw new ConflictException('An account with that email already exists')
      }
      throw e
    }
  }
}
