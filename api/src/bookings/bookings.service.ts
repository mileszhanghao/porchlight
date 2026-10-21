import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, asc, count, eq, gt, gte, lt } from 'drizzle-orm'
import type { SessionUser } from '../auth/auth.types'
import { Can } from '../auth/auth.types'
import { DB, type Db } from '../db/db'
import { amenities, bookings, users } from '../db/schema'
import { BOOKING_RULES, bookingProblem } from './rules'

const EXCLUSION_VIOLATION = '23P01'

function pgCode(e: unknown): string | undefined {
  const err = e as { code?: string; cause?: { code?: string } }
  return err.code ?? err.cause?.code
}

@Injectable()
export class BookingsService {
  constructor(@Inject(DB) private readonly db: Db) {}

  listAmenities() {
    return this.db.select().from(amenities).orderBy(asc(amenities.id))
  }

  /**
   * Confirmed bookings of one amenity in a range. Residents see that a slot is
   * taken and by which unit; names are shown only to the manager.
   */
  async amenitySchedule(amenityId: number, from: Date, to: Date, viewer: SessionUser) {
    const rows = await this.db
      .select({
        id: bookings.id,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        userId: bookings.userId,
        name: users.name,
        unit: users.unit,
        note: bookings.note,
      })
      .from(bookings)
      .innerJoin(users, eq(users.id, bookings.userId))
      .where(and(eq(bookings.amenityId, amenityId), eq(bookings.status, 'confirmed'), lt(bookings.startsAt, to), gt(bookings.endsAt, from)))
      .orderBy(asc(bookings.startsAt))
    const isManager = Can.manageAnyBooking.includes(viewer.role)
    return rows.map((r) => ({
      id: r.id,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      mine: r.userId === viewer.id,
      unit: r.unit,
      name: isManager || r.userId === viewer.id ? r.name : null,
      note: isManager || r.userId === viewer.id ? r.note : null,
    }))
  }

  mine(user: SessionUser) {
    return this.db
      .select({
        id: bookings.id,
        amenityId: bookings.amenityId,
        amenityName: amenities.name,
        startsAt: bookings.startsAt,
        endsAt: bookings.endsAt,
        note: bookings.note,
      })
      .from(bookings)
      .innerJoin(amenities, eq(amenities.id, bookings.amenityId))
      .where(and(eq(bookings.userId, user.id), eq(bookings.status, 'confirmed'), gte(bookings.endsAt, new Date())))
      .orderBy(asc(bookings.startsAt))
  }

  async create(user: SessionUser, input: { amenityId: number; startsAt: Date; endsAt: Date; note: string }) {
    const [amenity] = await this.db.select().from(amenities).where(eq(amenities.id, input.amenityId))
    if (!amenity) throw new NotFoundException('That room does not exist')
    const problem = bookingProblem(amenity, input.startsAt, input.endsAt)
    if (problem) throw new BadRequestException(problem)

    const [{ upcoming } = { upcoming: 0 }] = await this.db
      .select({ upcoming: count() })
      .from(bookings)
      .where(and(eq(bookings.userId, user.id), eq(bookings.status, 'confirmed'), gte(bookings.endsAt, new Date())))
    if (upcoming >= BOOKING_RULES.maxUpcomingPerResident) {
      throw new ConflictException(`You already have ${upcoming} upcoming bookings. Cancel one to book another.`)
    }

    try {
      const [row] = await this.db
        .insert(bookings)
        .values({ amenityId: amenity.id, userId: user.id, startsAt: input.startsAt, endsAt: input.endsAt, note: input.note })
        .returning()
      return { ...row, amenityName: amenity.name }
    } catch (e) {
      if (pgCode(e) === EXCLUSION_VIOLATION) {
        throw new ConflictException(`${amenity.name} is already booked for part of that time. Pick another slot.`)
      }
      throw e
    }
  }

  async cancel(user: SessionUser, id: number) {
    const [row] = await this.db.select().from(bookings).where(eq(bookings.id, id))
    if (!row || row.status !== 'confirmed') throw new NotFoundException('Booking not found')
    if (row.userId !== user.id && !Can.manageAnyBooking.includes(user.role)) {
      throw new ForbiddenException('You can only cancel your own bookings')
    }
    await this.db.update(bookings).set({ status: 'canceled' }).where(eq(bookings.id, id))
  }
}
