import { http, HttpResponse, type JsonBodyType } from 'msw'
import { BOOKING_RULES, bookingProblem } from '../../../api/src/bookings/rules'
import { DEMO_PASSWORD } from '../../../api/src/db/seed-data'
import type { Role } from '../api/types'
import { type DemoState, load, nextId, save } from './store'

// An in-browser stand-in for the NestJS API, used by the GitHub Pages demo.
// Same routes, same permission table and the same booking rules (imported from
// the API's source), so the demo behaves like the real thing.

type User = DemoState['users'][number]
const PAGE_SIZE = 20

const json = (body: JsonBodyType, status = 200) => HttpResponse.json(body, { status })
const fail = (status: number, message: string) => json({ statusCode: status, message }, status)
const noContent = () => new HttpResponse(null, { status: 204 })

const roles = {
  postAnnouncements: ['manager', 'board'] as Role[],
  manageEvents: ['manager', 'board'] as Role[],
  moderate: ['manager', 'moderator'] as Role[],
}

/** Runs a handler with the signed-in user and the state, saving any changes. */
function authed(fn: (ctx: { s: DemoState; me: User; req: Request; params: Record<string, string> }) => Promise<Response> | Response) {
  return async ({ request, params }: { request: Request; params: Record<string, string | readonly string[] | undefined> }) => {
    const s = load()
    const me = s.users.find((u) => u.id === s.sessionUserId)
    if (!me) return fail(401, 'Please sign in')
    if (request.method !== 'GET' && request.headers.get('x-porchlight-csrf') !== '1') return fail(403, 'Missing x-porchlight-csrf header')
    const res = await fn({ s, me, req: request, params: params as Record<string, string> })
    save(s)
    return res
  }
}

const sessionUser = (u: User) => ({ id: u.id, name: u.name, role: u.role, unit: u.unit })
const userName = (s: DemoState, id: number) => s.users.find((u) => u.id === id)!
const active = (a: DemoState['announcements'][number]) => !a.expiresAt || new Date(a.expiresAt) > new Date()

function announcementView(s: DemoState, a: DemoState['announcements'][number]) {
  return { ...a, authorName: userName(s, a.authorId).name }
}

function postView(s: DemoState, p: DemoState['posts'][number], me: User) {
  const author = userName(s, p.authorId)
  return {
    id: p.id,
    category: p.category,
    title: p.title,
    body: p.body,
    createdAt: p.createdAt,
    hidden: p.hiddenAt !== null,
    hiddenReason: p.hiddenReason,
    authorId: p.authorId,
    authorName: author.name,
    authorUnit: author.unit,
    likes: s.likes.filter((l) => l.postId === p.id).length,
    comments: s.comments.filter((c) => c.postId === p.id && !c.hiddenAt).length,
    likedByMe: s.likes.some((l) => l.postId === p.id && l.userId === me.id),
  }
}

function myBookings(s: DemoState, me: User) {
  const now = new Date()
  return s.bookings
    .filter((b) => b.userId === me.id && b.status === 'confirmed' && new Date(b.endsAt) >= now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .map((b) => ({ id: b.id, amenityId: b.amenityId, amenityName: s.amenities.find((a) => a.id === b.amenityId)!.name, startsAt: b.startsAt, endsAt: b.endsAt, note: b.note }))
}

export const handlers = [
  http.post('*/api/auth/login', async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string }
    const s = load()
    const user = s.users.find((u) => u.email === email?.toLowerCase())
    if (!user || password !== DEMO_PASSWORD) return fail(401, 'Wrong email or password')
    s.sessionUserId = user.id
    save(s)
    return json(sessionUser(user))
  }),
  http.post('*/api/auth/logout', () => {
    const s = load()
    s.sessionUserId = null
    save(s)
    return noContent()
  }),
  http.get('*/api/auth/me', authed(({ me }) => json(sessionUser(me)))),

  http.get(
    '*/api/dashboard',
    authed(({ s, me }) => {
      const now = new Date()
      const week = new Date(now.getTime() + 7 * 86_400_000)
      const byNewest = <T extends { createdAt: string }>(a: T, b: T) => b.createdAt.localeCompare(a.createdAt)
      return json({
        alerts: s.announcements.filter((a) => a.kind === 'alert' && active(a)).sort(byNewest).map((a) => announcementView(s, a)),
        news: s.announcements
          .filter((a) => a.kind !== 'alert')
          .sort((a, b) => Number(b.pinned) - Number(a.pinned) || byNewest(a, b))
          .slice(0, 5)
          .map((a) => announcementView(s, a)),
        upcoming: s.events
          .filter((e) => new Date(e.endsAt) >= now && new Date(e.startsAt) < week)
          .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
        myBookings: myBookings(s, me),
        latestPosts: s.posts
          .filter((p) => !p.hiddenAt)
          .sort((a, b) => b.id - a.id)
          .slice(0, 3)
          .map((p) => ({ id: p.id, title: p.title, category: p.category, createdAt: p.createdAt, authorName: userName(s, p.authorId).name })),
      })
    }),
  ),

  http.post(
    '*/api/announcements',
    authed(async ({ s, me, req }) => {
      if (!roles.postAnnouncements.includes(me.role)) return fail(403, 'Your role cannot do that')
      const body = (await req.json()) as { kind: DemoState['announcements'][number]['kind']; title: string; body: string; pinned?: boolean; expiresAt?: string }
      if (body.kind === 'alert' && me.role !== 'manager') return fail(403, 'Only the building manager can send alerts')
      if (!body.title || body.title.trim().length < 3) return fail(400, 'Title must be at least 3 characters')
      const row = { id: nextId(s.announcements), authorId: me.id, kind: body.kind, title: body.title.trim(), body: body.body.trim(), pinned: Boolean(body.pinned), expiresAt: body.expiresAt ?? null, createdAt: new Date().toISOString() }
      s.announcements.push(row)
      return json(announcementView(s, row), 201)
    }),
  ),

  http.get(
    '*/api/events',
    authed(({ s, req }) => {
      const url = new URL(req.url)
      const from = url.searchParams.get('from') ?? new Date(0).toISOString()
      const to = url.searchParams.get('to') ?? new Date(8.64e15).toISOString()
      return json(s.events.filter((e) => e.startsAt < to && e.endsAt >= from).sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
    }),
  ),
  http.post(
    '*/api/events',
    authed(async ({ s, me, req }) => {
      if (!roles.manageEvents.includes(me.role)) return fail(403, 'Your role cannot do that')
      const body = (await req.json()) as { kind: 'community' | 'maintenance'; title: string; description: string; location: string; startsAt: string; endsAt: string }
      if (body.kind === 'maintenance' && me.role !== 'manager') return fail(403, 'Only the manager schedules maintenance')
      if (!(new Date(body.endsAt) > new Date(body.startsAt))) return fail(400, 'endsAt must be after startsAt')
      const row = { ...body, id: nextId(s.events), createdBy: me.id, status: 'scheduled' as const }
      s.events.push(row)
      return json(row, 201)
    }),
  ),
  http.post(
    '*/api/events/:id/cancel',
    authed(({ s, me, params }) => {
      if (!roles.manageEvents.includes(me.role)) return fail(403, 'Your role cannot do that')
      const ev = s.events.find((e) => e.id === Number(params.id))
      if (!ev) return fail(404, 'Event not found')
      ev.status = 'canceled'
      return json(ev)
    }),
  ),

  http.get('*/api/amenities', authed(({ s }) => json(s.amenities))),
  http.get(
    '*/api/amenities/:id/bookings',
    authed(({ s, me, req, params }) => {
      const url = new URL(req.url)
      const from = url.searchParams.get('from')!
      const to = url.searchParams.get('to')!
      const manager = me.role === 'manager'
      return json(
        s.bookings
          .filter((b) => b.amenityId === Number(params.id) && b.status === 'confirmed' && b.startsAt < to && b.endsAt > from)
          .map((b) => {
            const owner = userName(s, b.userId)
            const visible = manager || b.userId === me.id
            return { id: b.id, startsAt: b.startsAt, endsAt: b.endsAt, mine: b.userId === me.id, unit: owner.unit, name: visible ? owner.name : null, note: visible ? b.note : null }
          }),
      )
    }),
  ),
  http.get('*/api/bookings/mine', authed(({ s, me }) => json(myBookings(s, me)))),
  http.post(
    '*/api/bookings',
    authed(async ({ s, me, req }) => {
      const body = (await req.json()) as { amenityId: number; startsAt: string; endsAt: string; note?: string }
      const amenity = s.amenities.find((a) => a.id === body.amenityId)
      if (!amenity) return fail(404, 'That room does not exist')
      const start = new Date(body.startsAt)
      const end = new Date(body.endsAt)
      const problem = bookingProblem(amenity, start, end)
      if (problem) return fail(400, problem)
      if (myBookings(s, me).length >= BOOKING_RULES.maxUpcomingPerResident) {
        return fail(409, `You already have ${BOOKING_RULES.maxUpcomingPerResident} upcoming bookings. Cancel one to book another.`)
      }
      // The real API leaves this to a PostgreSQL exclusion constraint.
      const clash = s.bookings.some(
        (b) => b.amenityId === amenity.id && b.status === 'confirmed' && new Date(b.startsAt) < end && new Date(b.endsAt) > start,
      )
      if (clash) return fail(409, `${amenity.name} is already booked for part of that time. Pick another slot.`)
      const row = { id: nextId(s.bookings), amenityId: amenity.id, userId: me.id, note: body.note?.trim() ?? '', startsAt: start.toISOString(), endsAt: end.toISOString(), status: 'confirmed' as const }
      s.bookings.push(row)
      return json({ ...row, amenityName: amenity.name }, 201)
    }),
  ),
  http.post(
    '*/api/bookings/:id/cancel',
    authed(({ s, me, params }) => {
      const b = s.bookings.find((x) => x.id === Number(params.id) && x.status === 'confirmed')
      if (!b) return fail(404, 'Booking not found')
      if (b.userId !== me.id && me.role !== 'manager') return fail(403, 'You can only cancel your own bookings')
      b.status = 'canceled'
      return noContent()
    }),
  ),

  http.get(
    '*/api/posts',
    authed(({ s, me, req }) => {
      const url = new URL(req.url)
      const category = url.searchParams.get('category')
      const before = Number(url.searchParams.get('before') ?? Infinity)
      const visible = s.posts
        .filter((p) => (roles.moderate.includes(me.role) || !p.hiddenAt) && (!category || p.category === category) && p.id < before)
        .sort((a, b) => b.id - a.id)
      const page = visible.slice(0, PAGE_SIZE)
      return json({ posts: page.map((p) => postView(s, p, me)), nextBefore: visible.length > PAGE_SIZE ? page.at(-1)!.id : null })
    }),
  ),
  http.get(
    '*/api/posts/:id',
    authed(({ s, me, params }) => {
      const p = s.posts.find((x) => x.id === Number(params.id))
      const moderator = roles.moderate.includes(me.role)
      if (!p || (p.hiddenAt && !moderator)) return fail(404, 'Post not found')
      const thread = s.comments
        .filter((c) => c.postId === p.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((c) => {
          const author = userName(s, c.authorId)
          const hidden = c.hiddenAt !== null
          return { id: c.id, body: hidden && !moderator ? '[removed by a moderator]' : c.body, createdAt: c.createdAt, hidden, authorId: c.authorId, authorName: author.name, authorUnit: author.unit }
        })
      return json({ ...postView(s, p, me), thread })
    }),
  ),
  http.post(
    '*/api/posts',
    authed(async ({ s, me, req }) => {
      const body = (await req.json()) as { category: DemoState['posts'][number]['category']; title: string; body: string }
      if (!body.title || body.title.trim().length < 3) return fail(400, 'Title must be at least 3 characters')
      const row = { id: nextId(s.posts), authorId: me.id, category: body.category, title: body.title.trim(), body: body.body.trim(), createdAt: new Date().toISOString(), hiddenAt: null, hiddenReason: null }
      s.posts.push(row)
      return json(postView(s, row, me), 201)
    }),
  ),
  http.delete(
    '*/api/posts/:id',
    authed(({ s, me, params }) => {
      const p = s.posts.find((x) => x.id === Number(params.id))
      if (!p) return fail(404, 'Post not found')
      if (p.authorId !== me.id && !roles.moderate.includes(me.role)) return fail(403, 'You can only delete your own posts')
      s.posts = s.posts.filter((x) => x.id !== p.id)
      s.comments = s.comments.filter((c) => c.postId !== p.id)
      s.likes = s.likes.filter((l) => l.postId !== p.id)
      return noContent()
    }),
  ),
  http.post(
    '*/api/posts/:id/comments',
    authed(async ({ s, me, req, params }) => {
      const p = s.posts.find((x) => x.id === Number(params.id))
      if (!p) return fail(404, 'Post not found')
      if (p.hiddenAt) return fail(403, 'This post has been hidden')
      const { body } = (await req.json()) as { body: string }
      if (!body?.trim()) return fail(400, 'Reply cannot be empty')
      const row = { id: nextId(s.comments), postId: p.id, authorId: me.id, body: body.trim(), createdAt: new Date().toISOString(), hiddenAt: null }
      s.comments.push(row)
      return json({ ...row, hidden: false, authorName: me.name, authorUnit: me.unit }, 201)
    }),
  ),
  ...(['put', 'delete'] as const).map((method) =>
    http[method](
      '*/api/posts/:id/like',
      authed(({ s, me, params }) => {
        const postId = Number(params.id)
        if (!s.posts.some((p) => p.id === postId)) return fail(404, 'Post not found')
        s.likes = s.likes.filter((l) => !(l.postId === postId && l.userId === me.id))
        if (method === 'put') s.likes.push({ postId, userId: me.id })
        return json({ liked: method === 'put', likes: s.likes.filter((l) => l.postId === postId).length })
      }),
    ),
  ),
  http.post(
    '*/api/posts/:id/hide',
    authed(async ({ s, me, req, params }) => {
      if (!roles.moderate.includes(me.role)) return fail(403, 'Your role cannot do that')
      const p = s.posts.find((x) => x.id === Number(params.id))
      if (!p) return fail(404, 'Post not found')
      const { reason } = (await req.json()) as { reason: string }
      p.hiddenAt = new Date().toISOString()
      p.hiddenReason = reason
      return noContent()
    }),
  ),
  http.post(
    '*/api/posts/:id/unhide',
    authed(({ s, me, params }) => {
      if (!roles.moderate.includes(me.role)) return fail(403, 'Your role cannot do that')
      const p = s.posts.find((x) => x.id === Number(params.id))
      if (!p) return fail(404, 'Post not found')
      p.hiddenAt = null
      p.hiddenReason = null
      return noContent()
    }),
  ),
  http.post(
    '*/api/comments/:id/hide',
    authed(({ s, me, params }) => {
      if (!roles.moderate.includes(me.role)) return fail(403, 'Your role cannot do that')
      const c = s.comments.find((x) => x.id === Number(params.id))
      if (!c) return fail(404, 'Comment not found')
      c.hiddenAt = new Date().toISOString()
      return noContent()
    }),
  ),
]
