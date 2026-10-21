import { hashPassword, verifyPassword } from '../src/auth/password'
import { bookingProblem } from '../src/bookings/rules'
import { localParts, zonedDate } from '../src/common/time'

const clubhouse = { openHour: 8, closeHour: 22, maxHours: 4 }
const now = zonedDate('2026-10-12', 9) // Monday 9 am Pacific

describe('time helpers', () => {
  it('converts wall-clock times across daylight saving changes', () => {
    expect(zonedDate('2026-07-01', 14).toISOString()).toBe('2026-07-01T21:00:00.000Z') // PDT, UTC-7
    expect(zonedDate('2026-12-01', 14).toISOString()).toBe('2026-12-01T22:00:00.000Z') // PST, UTC-8
    expect(localParts(new Date('2026-11-01T09:30:00Z'))).toEqual({ ymd: '2026-11-01', hour: 1, minute: 30 })
  })
})

describe('bookingProblem', () => {
  const ok = (h1: number, h2: number, day = '2026-10-14') => bookingProblem(clubhouse, zonedDate(day, h1), zonedDate(day, h2), now)

  it('accepts a booking inside opening hours', () => {
    expect(ok(14, 17)).toBeNull()
    expect(ok(8, 12)).toBeNull()
    expect(ok(18, 22)).toBeNull()
  })

  it('rejects times outside opening hours, too long, or misaligned', () => {
    expect(ok(7, 9)).toMatch(/open 8 am–10 pm/)
    expect(ok(20, 23)).toMatch(/open/)
    expect(ok(10, 15)).toMatch(/at most 4 hours/)
    const start = zonedDate('2026-10-14', 10, 15)
    expect(bookingProblem(clubhouse, start, new Date(start.getTime() + 3_600_000), now)).toMatch(/hour or half hour/)
  })

  it('rejects the past, far future, reversed and overnight ranges', () => {
    expect(ok(8, 9, '2026-10-12')).toMatch(/already passed/)
    expect(ok(10, 12, '2027-01-30')).toMatch(/60 days/)
    expect(ok(12, 10)).toMatch(/after the start/)
    const late = { openHour: 0, closeHour: 24, maxHours: 4 }
    expect(bookingProblem(late, zonedDate('2026-10-14', 23), zonedDate('2026-10-15', 1), now)).toMatch(/same day/)
  })
})

describe('passwords', () => {
  it('hashes with a random salt and verifies', async () => {
    const a = await hashPassword('correct horse')
    const b = await hashPassword('correct horse')
    expect(a).not.toBe(b)
    expect(a.startsWith('scrypt$')).toBe(true)
    await expect(verifyPassword('correct horse', a)).resolves.toBe(true)
    await expect(verifyPassword('wrong', a)).resolves.toBe(false)
    await expect(verifyPassword('x', 'plaintext')).resolves.toBe(false)
  })
})
