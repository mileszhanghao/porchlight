import luxonPlugin from '@fullcalendar/luxon3'
import { DateTime } from 'luxon'
import { COMMUNITY_TZ } from '../../api/src/common/time'

/**
 * Calendars show the building's clock, not the viewer's. Without this, someone
 * whose computer is set to another time zone would drag "6 PM" on the calendar and
 * book 6 PM in their own zone, while every other screen shows the building's time.
 */
export const buildingClock = { timeZone: COMMUNITY_TZ, luxonPlugin } as const

/** yyyy-MM-ddTHH:mm on the building's clock, for <input type="datetime-local">. */
export const toBuildingInput = (d: Date) => DateTime.fromJSDate(d, { zone: COMMUNITY_TZ }).toFormat("yyyy-LL-dd'T'HH:mm")

/** Read a datetime-local value as the building's clock time. */
export const fromBuildingInput = (s: string) => DateTime.fromISO(s, { zone: COMMUNITY_TZ }).toJSDate()
