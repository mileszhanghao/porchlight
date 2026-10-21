import { localParts } from '../common/time'

export interface AmenityHours {
  openHour: number
  closeHour: number
  maxHours: number
}

export const BOOKING_RULES = {
  slotMinutes: 30,
  maxDaysAhead: 60,
  maxUpcomingPerResident: 3,
}

/**
 * Checks a requested booking against the amenity's rules. Returns a message a
 * resident can act on, or null if the request is fine. Overlaps are not checked
 * here: the database's exclusion constraint handles those, race-free.
 */
export function bookingProblem(a: AmenityHours, start: Date, end: Date, now = new Date()): string | null {
  const slot = BOOKING_RULES.slotMinutes * 60_000
  if (!(end > start)) return 'The end time must be after the start time.'
  if (start.getTime() % slot !== 0 || end.getTime() % slot !== 0) return 'Bookings start and end on the hour or half hour.'
  if (start < now) return 'That time has already passed.'
  if (start.getTime() - now.getTime() > BOOKING_RULES.maxDaysAhead * 86_400_000) {
    return `You can book up to ${BOOKING_RULES.maxDaysAhead} days ahead.`
  }
  const hours = (end.getTime() - start.getTime()) / 3_600_000
  if (hours > a.maxHours) return `This room can be booked for at most ${a.maxHours} hours.`

  const s = localParts(start)
  const e = localParts(new Date(end.getTime() - 1)) // the last minute that is actually booked
  if (s.ymd !== e.ymd) return 'A booking has to start and end on the same day.'
  const startMin = s.hour * 60 + s.minute
  const endMin = startMin + hours * 60
  if (startMin < a.openHour * 60 || endMin > a.closeHour * 60) {
    return `This room is open ${fmtHour(a.openHour)}–${fmtHour(a.closeHour)}.`
  }
  return null
}

function fmtHour(h: number): string {
  const suffix = h >= 12 && h < 24 ? 'pm' : 'am'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12} ${suffix}`
}
