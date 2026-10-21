import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Inject, NotFoundException, Param, Post, Query } from '@nestjs/common'
import { and, desc, eq, gt, isNull, or } from 'drizzle-orm'
import { z } from 'zod'
import { Can, type SessionUser } from '../auth/auth.types'
import { CurrentUser, Roles } from '../auth/decorators'
import { IdPipe } from '../common/id.pipe'
import { ZodPipe } from '../common/zod.pipe'
import { DB, type Db } from '../db/db'
import { announcementKind, announcements, users } from '../db/schema'

const CreateAnnouncement = z.object({
  kind: z.enum(announcementKind.enumValues).default('news'),
  title: z.string().trim().min(3).max(140),
  body: z.string().trim().min(1).max(5000),
  pinned: z.boolean().default(false),
  expiresAt: z.coerce.date().optional(),
})
const ListQuery = z.object({ kind: z.enum(announcementKind.enumValues).optional() })

export const announcementColumns = {
  id: announcements.id,
  kind: announcements.kind,
  title: announcements.title,
  body: announcements.body,
  pinned: announcements.pinned,
  expiresAt: announcements.expiresAt,
  createdAt: announcements.createdAt,
  authorId: announcements.authorId,
  authorName: users.name,
}

/** Still relevant: not an expired alert. */
export const notExpired = () => or(isNull(announcements.expiresAt), gt(announcements.expiresAt, new Date()))

@Controller('announcements')
export class AnnouncementsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Get()
  list(@Query(new ZodPipe(ListQuery)) q: z.infer<typeof ListQuery>) {
    return this.db
      .select(announcementColumns)
      .from(announcements)
      .innerJoin(users, eq(users.id, announcements.authorId))
      .where(and(notExpired(), q.kind ? eq(announcements.kind, q.kind) : undefined))
      .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
      .limit(100)
  }

  @Post()
  @Roles(...Can.postAnnouncements)
  async create(@Body(new ZodPipe(CreateAnnouncement)) body: z.infer<typeof CreateAnnouncement>, @CurrentUser() user: SessionUser) {
    // Emergency alerts go out to every resident, so only the manager sends them.
    if (body.kind === 'alert' && !Can.postAlerts.includes(user.role)) {
      throw new ForbiddenException('Only the building manager can send alerts')
    }
    const [row] = await this.db
      .insert(announcements)
      .values({ ...body, expiresAt: body.expiresAt ?? null, authorId: user.id })
      .returning()
    return { ...row, authorName: user.name }
  }

  @Delete(':id')
  @HttpCode(204)
  @Roles(...Can.postAnnouncements)
  async remove(@Param('id', IdPipe) id: number, @CurrentUser() user: SessionUser) {
    const [row] = await this.db.select().from(announcements).where(eq(announcements.id, id))
    if (!row) throw new NotFoundException('Announcement not found')
    if (row.authorId !== user.id && user.role !== 'manager') throw new ForbiddenException('You can only delete your own posts')
    await this.db.delete(announcements).where(eq(announcements.id, id))
  }
}
