import { Body, Controller, Get, HttpCode, Inject, Post, Res } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import type { Response } from 'express'
import { z } from 'zod'
import { CONFIG, type AppConfig } from '../config'
import { ZodPipe } from '../common/zod.pipe'
import { AuthService } from './auth.service'
import { SESSION_COOKIE, type SessionUser } from './auth.types'
import { CurrentUser, Public } from './decorators'

const LoginBody = z.object({ email: z.email(), password: z.string().min(1).max(200) })

export const SESSION_HOURS = 8

@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: AppConfig,
  ) {}

  /** 5 attempts per minute per IP, to slow down password guessing. */
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body(new ZodPipe(LoginBody)) body: z.infer<typeof LoginBody>, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.login(body.email, body.password)
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: this.config.cookieSecure,
      sameSite: 'lax',
      maxAge: SESSION_HOURS * 3_600_000,
      path: '/',
    })
    return user
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' })
  }

  @Get('me')
  me(@CurrentUser() user: SessionUser) {
    return user
  }
}
