import { demoCommunity } from '../../../api/src/db/seed-data'
import { STORAGE_KEY } from './people'

type Seed = ReturnType<typeof demoCommunity>
type Row<K extends keyof Seed> = Seed[K][number]

/** The demo database: seed-data.ts with ISO dates, plus the fields the DB fills in. */
export interface DemoState {
  /** Demo dates are relative to this; a stale demo is re-seeded so "this week" stays this week. */
  seededAt: string
  sessionUserId: number | null
  users: Row<'users'>[]
  announcements: (Omit<Row<'announcements'>, 'createdAt' | 'expiresAt'> & { createdAt: string; expiresAt: string | null })[]
  events: (Omit<Row<'events'>, 'startsAt' | 'endsAt'> & { startsAt: string; endsAt: string; status: 'scheduled' | 'canceled' })[]
  amenities: Row<'amenities'>[]
  bookings: (Omit<Row<'bookings'>, 'startsAt' | 'endsAt'> & { startsAt: string; endsAt: string; status: 'confirmed' | 'canceled' })[]
  posts: (Omit<Row<'posts'>, 'createdAt'> & { createdAt: string; hiddenAt: string | null; hiddenReason: string | null })[]
  comments: (Omit<Row<'comments'>, 'createdAt'> & { createdAt: string; hiddenAt: string | null })[]
  likes: Row<'likes'>[]
}

const iso = (d: Date | null) => (d ? d.toISOString() : null)

export function freshState(now = new Date()): DemoState {
  const s = demoCommunity(now)
  return {
    seededAt: now.toISOString(),
    sessionUserId: null,
    users: s.users,
    announcements: s.announcements.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), expiresAt: iso(a.expiresAt) })),
    events: s.events.map((e) => ({ ...e, startsAt: e.startsAt.toISOString(), endsAt: e.endsAt.toISOString(), status: 'scheduled' as const })),
    amenities: s.amenities,
    bookings: s.bookings.map((b) => ({ ...b, startsAt: b.startsAt.toISOString(), endsAt: b.endsAt.toISOString(), status: 'confirmed' as const })),
    posts: s.posts.map((p) => ({ ...p, createdAt: p.createdAt.toISOString(), hiddenAt: null, hiddenReason: null })),
    comments: s.comments.map((c) => ({ ...c, createdAt: c.createdAt.toISOString(), hiddenAt: null })),
    likes: s.likes,
  }
}

let memory: DemoState | null = null

export function load(): DemoState {
  if (memory) return memory
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const saved = raw ? (JSON.parse(raw) as DemoState) : null
    if (saved?.seededAt && Date.now() - new Date(saved.seededAt).getTime() < 2 * 86_400_000) return (memory = saved)
  } catch {
    // fall through to a fresh state
  }
  memory = freshState()
  save(memory)
  return memory
}

export function save(state: DemoState) {
  memory = state
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage full or blocked: the demo keeps working in memory.
  }
}

/** For tests. */
export function setStateForTests(state: DemoState | null) {
  memory = state
}

export const nextId = (rows: { id: number }[]) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1
