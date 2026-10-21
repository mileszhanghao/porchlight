import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common'
import type { Role } from '../db/schema'
import type { SessionUser } from './auth.types'

export const IS_PUBLIC = 'isPublic'
export const ROLES = 'roles'

/** Route needs no session (login, health). */
export const Public = () => SetMetadata(IS_PUBLIC, true)
/** Route is limited to these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles)

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): SessionUser => ctx.switchToHttp().getRequest().user,
)
