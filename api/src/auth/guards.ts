import { type CanActivate, type ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import type { Request } from 'express'
import type { Role } from '../db/schema'
import { CSRF_HEADER, SESSION_COOKIE, type SessionUser } from './auth.types'
import { IS_PUBLIC, ROLES } from './decorators'

/**
 * Global guard: every route needs a valid session cookie unless marked @Public().
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()])) return true
    const req = ctx.switchToHttp().getRequest<Request & { user?: SessionUser }>()
    const token = req.cookies?.[SESSION_COOKIE]
    if (!token) throw new UnauthorizedException('Please sign in')
    try {
      const payload = await this.jwt.verifyAsync<{ sub: number; name: string; role: Role; unit: string | null }>(token)
      req.user = { id: payload.sub, name: payload.name, role: payload.role, unit: payload.unit }
      return true
    } catch {
      throw new UnauthorizedException('Your session has expired, please sign in again')
    }
  }
}

/**
 * The session cookie is SameSite=Lax, and every state-changing request must
 * also carry a custom header, which a cross-site form or image tag cannot send.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>()
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true
    if (req.get(CSRF_HEADER) !== '1') throw new ForbiddenException(`Missing ${CSRF_HEADER} header`)
    return true
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES, [ctx.getHandler(), ctx.getClass()])
    if (!roles?.length) return true
    const user = ctx.switchToHttp().getRequest<{ user?: SessionUser }>().user
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('Your role cannot do that')
    return true
  }
}
