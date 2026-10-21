import type {
  Amenity,
  Announcement,
  AnnouncementKind,
  CommunityEvent,
  Comment,
  Dashboard,
  EventKind,
  MyBooking,
  PostCategory,
  PostDetail,
  PostSummary,
  ScheduleSlot,
  User,
} from './types'

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: { path: string; message: string }[]

  constructor(status: number, message: string, fieldErrors: { path: string; message: string }[] = []) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }
}

/** Same-origin cookie session; every state-changing request carries the CSRF header the API requires. */
async function request<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = init.method ?? 'GET'
  const headers: Record<string, string> = {}
  if (method !== 'GET') headers['x-porchlight-csrf'] = '1'
  if (init.body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'same-origin',
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
  if (res.status === 204) return undefined as T
  const body = await res.json().catch(() => undefined)
  if (!res.ok) {
    const message = Array.isArray(body?.message) ? body.message.join(', ') : (body?.message ?? `Request failed (${res.status})`)
    throw new ApiError(res.status, message, body?.errors ?? [])
  }
  return body as T
}

const qs = (params: Record<string, string | number | undefined>) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined) p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

export const api = {
  login: (email: string, password: string) => request<User>('/auth/login', { method: 'POST', body: { email, password } }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  me: () => request<User>('/auth/me'),

  dashboard: () => request<Dashboard>('/dashboard'),

  announcements: (kind?: AnnouncementKind) => request<Announcement[]>(`/announcements${qs({ kind })}`),
  createAnnouncement: (body: { kind: AnnouncementKind; title: string; body: string; pinned: boolean; expiresAt?: string }) =>
    request<Announcement>('/announcements', { method: 'POST', body }),
  deleteAnnouncement: (id: number) => request<void>(`/announcements/${id}`, { method: 'DELETE' }),

  events: (from: string, to: string) => request<CommunityEvent[]>(`/events${qs({ from, to })}`),
  createEvent: (body: { kind: EventKind; title: string; description: string; location: string; startsAt: string; endsAt: string }) =>
    request<CommunityEvent>('/events', { method: 'POST', body }),
  cancelEvent: (id: number) => request<CommunityEvent>(`/events/${id}/cancel`, { method: 'POST' }),

  amenities: () => request<Amenity[]>('/amenities'),
  schedule: (amenityId: number, from: string, to: string) =>
    request<ScheduleSlot[]>(`/amenities/${amenityId}/bookings${qs({ from, to })}`),
  myBookings: () => request<MyBooking[]>('/bookings/mine'),
  book: (body: { amenityId: number; startsAt: string; endsAt: string; note: string }) =>
    request<MyBooking>('/bookings', { method: 'POST', body }),
  cancelBooking: (id: number) => request<void>(`/bookings/${id}/cancel`, { method: 'POST' }),

  posts: (category?: PostCategory, before?: number) =>
    request<{ posts: PostSummary[]; nextBefore: number | null }>(`/posts${qs({ category, before })}`),
  post: (id: number) => request<PostDetail>(`/posts/${id}`),
  createPost: (body: { category: PostCategory; title: string; body: string }) => request<PostSummary>('/posts', { method: 'POST', body }),
  deletePost: (id: number) => request<void>(`/posts/${id}`, { method: 'DELETE' }),
  comment: (postId: number, body: string) => request<Comment>(`/posts/${postId}/comments`, { method: 'POST', body: { body } }),
  like: (postId: number, liked: boolean) =>
    request<{ liked: boolean; likes: number }>(`/posts/${postId}/like`, { method: liked ? 'PUT' : 'DELETE' }),
  hidePost: (postId: number, reason: string) => request<void>(`/posts/${postId}/hide`, { method: 'POST', body: { reason } }),
  unhidePost: (postId: number) => request<void>(`/posts/${postId}/unhide`, { method: 'POST' }),
  hideComment: (commentId: number) => request<void>(`/comments/${commentId}/hide`, { method: 'POST' }),
}

export const IS_DEMO = import.meta.env.VITE_DEMO === 'true'
