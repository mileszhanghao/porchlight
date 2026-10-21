import { BadRequestException, Body, Controller, ForbiddenException, Get, Inject, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common'
import { and, asc, eq, gte, lt } from 'drizzle-orm'
import { z } from 'zod'
import { Can, type SessionUser } from '../auth/auth.types'
import { CurrentUser, Roles } from '../auth/decorators'
import { IdPipe } from '../common/id.pipe'
import { ZodPipe } from '../common/zod.pipe'
import { DB, type Db } from '../db/db'
import { eventKind, events } from '../db/schema'

const DAY = 86_400_000
const EventBody = z
  .object({
    kind: z.enum(eventKind.enumValues),
    title: z.string().trim().min(3).max(140),
    description: z.string().trim().max(2000).default(''),
    location: z.string().trim().max(120).default(''),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
  })
  .refine((e) => e.endsAt > e.startsAt, { message: 'endsAt must be after startsAt', path: ['endsAt'] })
const RangeQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

@Controller('events')
export class EventsController {
  constructor(@Inject(DB) private readonly db: Db) {}

  /** Events overlapping [from, to); defaults to the last week through the next 60 days. */
  @Get()
  list(@Query(new ZodPipe(RangeQuery)) q: z.infer<typeof RangeQuery>) {
    const from = q.from ?? new Date(Date.now() - 7 * DAY)
    const to = q.to ?? new Date(Date.now() + 60 * DAY)
    if (to.getTime() - from.getTime() > 400 * DAY) throw new BadRequestException('Range is limited to about a year')
    return this.db
      .select()
      .from(events)
      .where(and(lt(events.startsAt, to), gte(events.endsAt, from)))
      .orderBy(asc(events.startsAt))
  }

  @Post()
  @Roles(...Can.manageEvents)
  async create(@Body(new ZodPipe(EventBody)) body: z.infer<typeof EventBody>, @CurrentUser() user: SessionUser) {
    this.checkKind(body.kind, user)
    const [row] = await this.db.insert(events).values({ ...body, createdBy: user.id }).returning()
    return row
  }

  @Patch(':id')
  @Roles(...Can.manageEvents)
  async update(@Param('id', IdPipe) id: number, @Body(new ZodPipe(EventBody)) body: z.infer<typeof EventBody>, @CurrentUser() user: SessionUser) {
    this.checkKind(body.kind, user)
    const [row] = await this.db.update(events).set(body).where(eq(events.id, id)).returning()
    if (!row) throw new NotFoundException('Event not found')
    return row
  }

  /** Canceled events stay on the calendar, struck through, so residents see the change. */
  @Post(':id/cancel')
  @Roles(...Can.manageEvents)
  async cancel(@Param('id', IdPipe) id: number) {
    const [row] = await this.db.update(events).set({ status: 'canceled' }).where(eq(events.id, id)).returning()
    if (!row) throw new NotFoundException('Event not found')
    return row
  }

  /** Building maintenance (garage sweeping, alarm tests) is scheduled by the manager; the board runs community events. */
  private checkKind(kind: (typeof eventKind.enumValues)[number], user: SessionUser) {
    if (kind === 'maintenance' && user.role !== 'manager') throw new ForbiddenException('Only the manager schedules maintenance')
  }
}
