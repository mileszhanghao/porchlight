import { setupServer } from 'msw/node'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { localDayOffset, zonedDate } from '../../../api/src/common/time'
import { DEMO_PASSWORD } from '../../../api/src/db/seed-data'
import { handlers } from './handlers'
import { resetDemo } from './people'
import { setStateForTests } from './store'

const server = setupServer(...handlers)
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  resetDemo()
  setStateForTests(null)
})

const call = (path: string, init: { method?: string; body?: unknown; csrf?: boolean } = {}) =>
  fetch(`http://localhost/api${path}`, {
    method: init.method ?? 'GET',
    headers: { 'content-type': 'application/json', ...(init.csrf === false ? {} : { 'x-porchlight-csrf': '1' }) },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
const signIn = (email: string) => call('/auth/login', { method: 'POST', body: { email, password: DEMO_PASSWORD } })
const slot = (days: number, h1: number, h2: number) => ({
  startsAt: zonedDate(localDayOffset(days), h1).toISOString(),
  endsAt: zonedDate(localDayOffset(days), h2).toISOString(),
})

describe('demo API (MSW)', () => {
  it('needs a session and the CSRF header, like the real API', async () => {
    expect((await call('/dashboard')).status).toBe(401)
    expect((await call('/auth/login', { method: 'POST', body: { email: 'resident@larkspur.example', password: 'nope' } })).status).toBe(401)
    await signIn('resident@larkspur.example')
    expect((await call('/posts', { method: 'POST', body: { title: 'Hi there', body: 'x' }, csrf: false })).status).toBe(403)
    const dash = await (await call('/dashboard')).json()
    expect(dash.alerts).toHaveLength(1)
    expect(dash.myBookings[0]).toMatchObject({ amenityName: 'Rooftop deck' })
  })

  it('applies the shared booking rules and refuses overlaps', async () => {
    await signIn('ben@larkspur.example')
    expect((await call('/bookings', { method: 'POST', body: { amenityId: 3, ...slot(10, 6, 8) } })).status).toBe(400)
    expect((await call('/bookings', { method: 'POST', body: { amenityId: 3, ...slot(10, 18, 20) } })).status).toBe(201)
    await signIn('chloe@larkspur.example')
    const clash = await call('/bookings', { method: 'POST', body: { amenityId: 3, ...slot(10, 19, 21) } })
    expect(clash.status).toBe(409)
    expect((await clash.json()).message).toMatch(/already booked/)
    const schedule = await (await call(`/amenities/3/bookings?from=${slot(10, 0, 1).startsAt}&to=${slot(11, 0, 1).startsAt}`)).json()
    expect(schedule).toEqual([expect.objectContaining({ mine: false, unit: '1D', name: null, note: null })])
  })

  it('enforces roles for alerts and moderation', async () => {
    await signIn('board@larkspur.example')
    expect((await call('/announcements', { method: 'POST', body: { kind: 'alert', title: 'Fire!', body: 'x' } })).status).toBe(403)
    expect((await call('/posts/3/hide', { method: 'POST', body: { reason: 'nope' } })).status).toBe(403)
    await signIn('moderator@larkspur.example')
    expect((await call('/posts/3/hide', { method: 'POST', body: { reason: 'Duplicate listing' } })).status).toBe(204)
    await signIn('resident@larkspur.example')
    const { posts } = await (await call('/posts')).json()
    expect(posts.map((p: { id: number }) => p.id)).toEqual([2, 1])
  })
})
