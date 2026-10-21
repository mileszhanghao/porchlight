import 'reflect-metadata'
import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { createApp } from '../src/bootstrap'
import { localDayOffset, zonedDate } from '../src/common/time'
import { createDb, createPool, runMigrations } from '../src/db/db'
import { DEMO_PASSWORD, seed } from '../src/db/seed'

/**
 * Runs the real app (guards, cookies, validation) against PostgreSQL.
 * Needs TEST_DATABASE_URL; the database is wiped and re-seeded.
 */
const url = process.env.TEST_DATABASE_URL
const describeDb = url ? describe : describe.skip

describeDb('Porchlight API (PostgreSQL)', () => {
  let app: INestApplication
  const pool = createPool(url ?? '')

  beforeAll(async () => {
    const db = createDb(pool)
    await runMigrations(db)
    await seed(db)
    app = await createApp({ databaseUrl: url!, jwtSecret: 'x'.repeat(40), cookieSecure: false, port: 0, rateLimit: false })
    await app.init()
  })

  afterAll(async () => {
    await app?.close()
    await pool.end()
  })

  async function signIn(email: string) {
    const agent = request.agent(app.getHttpServer())
    await agent.post('/api/auth/login').set('x-porchlight-csrf', '1').send({ email, password: DEMO_PASSWORD }).expect(200)
    return {
      get: (path: string) => agent.get(path),
      post: (path: string, body?: object) => agent.post(path).set('x-porchlight-csrf', '1').send(body ?? {}),
      put: (path: string) => agent.put(path).set('x-porchlight-csrf', '1'),
      del: (path: string) => agent.delete(path).set('x-porchlight-csrf', '1'),
    }
  }
  const slot = (daysAhead: number, h1: number, h2: number) => ({
    startsAt: zonedDate(localDayOffset(daysAhead), h1).toISOString(),
    endsAt: zonedDate(localDayOffset(daysAhead), h2).toISOString(),
  })

  describe('auth', () => {
    it('requires a session, rejects bad passwords and requires the CSRF header', async () => {
      const http = request(app.getHttpServer())
      await http.get('/api/dashboard').expect(401)
      await http.post('/api/auth/login').set('x-porchlight-csrf', '1').send({ email: 'resident@larkspur.example', password: 'nope' }).expect(401)
      await http.post('/api/auth/login').send({ email: 'resident@larkspur.example', password: DEMO_PASSWORD }).expect(403)
      const me = await (await signIn('resident@larkspur.example')).get('/api/auth/me').expect(200)
      expect(me.body).toMatchObject({ name: 'Ana Souza', role: 'resident', unit: '4C' })
    })

    it('sets an httpOnly, SameSite=Lax session cookie', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .set('x-porchlight-csrf', '1')
        .send({ email: 'board@larkspur.example', password: DEMO_PASSWORD })
        .expect(200)
      const cookie = String(res.headers['set-cookie'])
      expect(cookie).toMatch(/porchlight_session=/)
      expect(cookie).toMatch(/HttpOnly/)
      expect(cookie).toMatch(/SameSite=Lax/)
    })
  })

  it('rate-limits login attempts when enabled', async () => {
    const limited = await createApp({ databaseUrl: url!, jwtSecret: 'x'.repeat(40), cookieSecure: false, port: 0 })
    await limited.init()
    try {
      const statuses = []
      for (let i = 0; i < 6; i++) {
        const r = await request(limited.getHttpServer())
          .post('/api/auth/login')
          .set('x-porchlight-csrf', '1')
          .send({ email: 'resident@larkspur.example', password: 'guess-' + i })
        statuses.push(r.status)
      }
      expect(statuses).toEqual([401, 401, 401, 401, 401, 429])
    } finally {
      await limited.close()
    }
  })

  describe('roles', () => {
    it('lets the manager send alerts, the board post news, and nobody else', async () => {
      const manager = await signIn('manager@larkspur.example')
      const boardMember = await signIn('board@larkspur.example')
      const resident = await signIn('resident@larkspur.example')
      await manager.post('/api/announcements', { kind: 'alert', title: 'Fire door alarm test', body: 'Brief test at noon.' }).expect(201)
      await boardMember.post('/api/announcements', { kind: 'alert', title: 'Not allowed', body: 'x' }).expect(403)
      await boardMember.post('/api/announcements', { kind: 'news', title: 'Garden club starts', body: 'Saturdays at 10.' }).expect(201)
      await resident.post('/api/announcements', { kind: 'news', title: 'Hello', body: 'x' }).expect(403)
      await boardMember.post('/api/events', { kind: 'maintenance', title: 'Roof check', ...slot(3, 9, 10) }).expect(403)
      await resident.get('/api/users').expect(403)
    })

    it('validates input with field-level messages', async () => {
      const manager = await signIn('manager@larkspur.example')
      const res = await manager.post('/api/events', { kind: 'community', title: 'x', startsAt: 'soon' }).expect(400)
      expect(res.body.errors.map((e: { path: string }) => e.path)).toEqual(expect.arrayContaining(['title', 'startsAt']))
    })
  })

  describe('bookings', () => {
    it('books a free slot and refuses an overlapping one', async () => {
      const ana = await signIn('resident@larkspur.example')
      const chloe = await signIn('chloe@larkspur.example')
      const first = await ana.post('/api/bookings', { amenityId: 1, ...slot(10, 14, 16), note: 'Book club' }).expect(201)
      expect(first.body).toMatchObject({ amenityName: 'Clubhouse', status: 'confirmed' })
      const clash = await chloe.post('/api/bookings', { amenityId: 1, ...slot(10, 15, 17) }).expect(409)
      expect(clash.body.message).toMatch(/already booked/)
      // Back-to-back is fine: ranges are half-open [start, end).
      await chloe.post('/api/bookings', { amenityId: 1, ...slot(10, 16, 18) }).expect(201)
    })

    it('lets exactly one of two simultaneous requests for the same slot win', async () => {
      const ben = await signIn('ben@larkspur.example')
      const chloe = await signIn('chloe@larkspur.example')
      const body = { amenityId: 2, ...slot(11, 17, 19) }
      const results = await Promise.all([ben.post('/api/bookings', body), chloe.post('/api/bookings', body)])
      expect(results.map((r) => r.status).sort()).toEqual([201, 409])
    })

    it('enforces opening hours and lets owners cancel to free the slot', async () => {
      const ana = await signIn('resident@larkspur.example')
      const ben = await signIn('ben@larkspur.example')
      await ana.post('/api/bookings', { amenityId: 3, ...slot(12, 7, 9) }).expect(400)
      const booking = await ana.post('/api/bookings', { amenityId: 3, ...slot(12, 19, 21) }).expect(201)
      await ben.post(`/api/bookings/${booking.body.id}/cancel`).expect(403)
      await ana.post(`/api/bookings/${booking.body.id}/cancel`).expect(204)
      await ben.post('/api/bookings', { amenityId: 3, ...slot(12, 19, 21) }).expect(201)
    })

    it('shows names on the schedule only to the manager and the owner', async () => {
      const range = `from=${new Date().toISOString()}&to=${new Date(Date.now() + 30 * 86_400_000).toISOString()}`
      const asChloe = await (await signIn('chloe@larkspur.example')).get(`/api/amenities/1/bookings?${range}`).expect(200)
      const others = asChloe.body.filter((b: { mine: boolean }) => !b.mine)
      expect(others.length).toBeGreaterThan(0)
      expect(others.every((b: { name: string | null }) => b.name === null)).toBe(true)
      const asManager = await (await signIn('manager@larkspur.example')).get(`/api/amenities/1/bookings?${range}`).expect(200)
      expect(asManager.body.every((b: { name: string | null }) => b.name !== null)).toBe(true)
    })

    it('caps a resident at three upcoming bookings', async () => {
      const ana = await signIn('resident@larkspur.example')
      const mine = await ana.get('/api/bookings/mine').expect(200)
      for (let i = mine.body.length; i < 3; i++) {
        await ana.post('/api/bookings', { amenityId: 3, ...slot(20 + i, 10, 11) }).expect(201)
      }
      const res = await ana.post('/api/bookings', { amenityId: 3, ...slot(30, 10, 11) }).expect(409)
      expect(res.body.message).toMatch(/upcoming bookings/)
    })
  })

  describe('board', () => {
    it('counts likes once per person and hides moderated posts from residents', async () => {
      const ben = await signIn('ben@larkspur.example')
      const mod = await signIn('moderator@larkspur.example')
      const post = await ben.post('/api/posts', { category: 'general', title: 'Selling concert tickets!!!', body: 'DM me' }).expect(201)
      await ben.put(`/api/posts/${post.body.id}/like`).expect(200)
      const again = await ben.put(`/api/posts/${post.body.id}/like`).expect(200)
      expect(again.body).toEqual({ liked: true, likes: 1 })
      await ben.post(`/api/posts/${post.body.id}/comments`, { body: 'Still available' }).expect(201)

      await ben.post(`/api/posts/${post.body.id}/hide`, { reason: 'spam' }).expect(403)
      await mod.post(`/api/posts/${post.body.id}/hide`, { reason: 'Ticket resale is not allowed on the board' }).expect(204)
      const asBen = await ben.get('/api/posts').expect(200)
      expect(asBen.body.posts.some((p: { id: number }) => p.id === post.body.id)).toBe(false)
      const asMod = await mod.get('/api/posts').expect(200)
      expect(asMod.body.posts.find((p: { id: number }) => p.id === post.body.id)).toMatchObject({ hidden: true, comments: 1, likes: 1 })
    })

    it('returns a thread with comments and a dashboard with this week', async () => {
      const ana = await signIn('resident@larkspur.example')
      const thread = await ana.get('/api/posts/1').expect(200)
      expect(thread.body).toMatchObject({ title: 'Light out on garage level P2', comments: 2 })
      expect(thread.body.thread).toHaveLength(2)
      const dash = await ana.get('/api/dashboard').expect(200)
      expect(dash.body.alerts.length).toBeGreaterThan(0)
      expect(dash.body.upcoming.length).toBeGreaterThan(0)
      expect(dash.body.myBookings.length).toBeGreaterThan(0)
    })
  })
})
