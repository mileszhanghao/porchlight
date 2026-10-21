/** All "opening hours" rules use the community's local time, not the server's. */
// Read through globalThis so this file also runs in the browser demo (no Node `process` there).
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
export const COMMUNITY_TZ = env?.COMMUNITY_TZ ?? 'America/Los_Angeles'

export interface LocalParts {
  ymd: string
  hour: number
  minute: number
}

export function localParts(d: Date, tz = COMMUNITY_TZ): LocalParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return { ymd: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')), minute: Number(get('minute')) }
}

/** Minutes the zone is ahead of UTC at instant d (e.g. -420 for PDT). */
function offsetMinutes(d: Date, tz: string): number {
  const p = localParts(d, tz)
  const [y, m, day] = p.ymd.split('-').map(Number)
  const asUtc = Date.UTC(y!, m! - 1, day!, p.hour, p.minute)
  return Math.round((asUtc - Math.floor(d.getTime() / 60_000) * 60_000) / 60_000)
}

/** The instant when the wall clock in tz shows ymd hour:minute (DST-aware). */
export function zonedDate(ymd: string, hour: number, minute = 0, tz = COMMUNITY_TZ): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  const guess = Date.UTC(y!, m! - 1, d!, hour, minute)
  let t = guess - offsetMinutes(new Date(guess), tz) * 60_000
  t = guess - offsetMinutes(new Date(t), tz) * 60_000
  return new Date(t)
}

/** Local calendar date n days from `from`. */
export function localDayOffset(days: number, from = new Date(), tz = COMMUNITY_TZ): string {
  return localParts(new Date(from.getTime() + days * 86_400_000), tz).ymd
}
