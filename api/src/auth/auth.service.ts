import { Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { eq } from 'drizzle-orm'
import { DB, type Db } from '../db/db'
import { users } from '../db/schema'
import type { SessionUser } from './auth.types'
import { hashPassword, verifyPassword } from './password'

// Compared against when the email is unknown, so a missing account takes as long as a wrong password.
const DUMMY_HASH = hashPassword('timing-equalizer')

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async login(email: string, password: string): Promise<{ user: SessionUser; token: string }> {
    const [row] = await this.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1)
    const ok = await verifyPassword(password, row?.passwordHash ?? (await DUMMY_HASH))
    if (!row || !ok) throw new UnauthorizedException('Wrong email or password')
    const user: SessionUser = { id: row.id, name: row.name, role: row.role, unit: row.unit }
    const token = await this.jwt.signAsync({ sub: user.id, name: user.name, role: user.role, unit: user.unit })
    return { user, token }
  }
}
