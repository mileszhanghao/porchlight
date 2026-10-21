import { Controller, Get, Inject } from '@nestjs/common'
import { and, asc, desc, eq, gte, isNull, lt, ne } from 'drizzle-orm'
import { notExpired, announcementColumns } from '../announcements/announcements.controller'
import type { SessionUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/decorators'
import { BookingsService } from '../bookings/bookings.service'
import { DB, type Db } from '../db/db'
import { announcements, events, posts, users } from '../db/schema'

/** One request for the home screen: active alerts, news, the coming week, my bookings, board activity. */
@Controller('dashboard')
export class DashboardController {
  constructor(
    @Inject(DB) private readonly db: Db,
    @Inject(BookingsService) private readonly bookings: BookingsService,
  ) {}

  @Get()
  async get(@CurrentUser() user: SessionUser) {
    const now = new Date()
    const weekAhead = new Date(now.getTime() + 7 * 86_400_000)
    const [alerts, news, upcoming, myBookings, latestPosts] = await Promise.all([
      this.db
        .select(announcementColumns)
        .from(announcements)
        .innerJoin(users, eq(users.id, announcements.authorId))
        .where(and(eq(announcements.kind, 'alert'), notExpired()))
        .orderBy(desc(announcements.createdAt)),
      this.db
        .select(announcementColumns)
        .from(announcements)
        .innerJoin(users, eq(users.id, announcements.authorId))
        .where(ne(announcements.kind, 'alert'))
        .orderBy(desc(announcements.pinned), desc(announcements.createdAt))
        .limit(5),
      this.db
        .select()
        .from(events)
        .where(and(gte(events.endsAt, now), lt(events.startsAt, weekAhead)))
        .orderBy(asc(events.startsAt)),
      this.bookings.mine(user),
      this.db
        .select({ id: posts.id, title: posts.title, category: posts.category, createdAt: posts.createdAt, authorName: users.name })
        .from(posts)
        .innerJoin(users, eq(users.id, posts.authorId))
        .where(isNull(posts.hiddenAt))
        .orderBy(desc(posts.id))
        .limit(3),
    ])
    return { alerts, news, upcoming, myBookings, latestPosts }
  }
}
