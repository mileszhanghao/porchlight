export type Role = 'resident' | 'manager' | 'board' | 'moderator'
export type AnnouncementKind = 'news' | 'alert' | 'newsletter' | 'policy'
export type EventKind = 'community' | 'maintenance'
export type PostCategory = 'general' | 'issue' | 'lost_found' | 'for_sale'

export interface User {
  id: number
  name: string
  role: Role
  unit: string | null
}

export interface Announcement {
  id: number
  kind: AnnouncementKind
  title: string
  body: string
  pinned: boolean
  expiresAt: string | null
  createdAt: string
  authorId: number
  authorName: string
}

export interface CommunityEvent {
  id: number
  kind: EventKind
  status: 'scheduled' | 'canceled'
  title: string
  description: string
  location: string
  startsAt: string
  endsAt: string
  createdBy: number
}

export interface Amenity {
  id: number
  name: string
  description: string
  capacity: number
  openHour: number
  closeHour: number
  maxHours: number
}

export interface ScheduleSlot {
  id: number
  startsAt: string
  endsAt: string
  mine: boolean
  unit: string | null
  name: string | null
  note: string | null
}

export interface MyBooking {
  id: number
  amenityId: number
  amenityName: string
  startsAt: string
  endsAt: string
  note: string
}

export interface PostSummary {
  id: number
  category: PostCategory
  title: string
  body: string
  createdAt: string
  hidden: boolean
  hiddenReason: string | null
  authorId: number
  authorName: string
  authorUnit: string | null
  likes: number
  comments: number
  likedByMe: boolean
}

export interface Comment {
  id: number
  body: string
  createdAt: string
  hidden: boolean
  authorId: number
  authorName: string
  authorUnit: string | null
}

export interface PostDetail extends PostSummary {
  thread: Comment[]
}

export interface Dashboard {
  alerts: Announcement[]
  news: Announcement[]
  upcoming: CommunityEvent[]
  myBookings: MyBooking[]
  latestPosts: { id: number; title: string; category: PostCategory; createdAt: string; authorName: string }[]
}

export const CATEGORY_LABEL: Record<PostCategory, string> = {
  general: 'General',
  issue: 'Building issue',
  lost_found: 'Lost & found',
  for_sale: 'Free / for sale',
}

export const ROLE_LABEL: Record<Role, string> = {
  resident: 'Resident',
  manager: 'Building manager',
  board: 'Board member',
  moderator: 'Moderator',
}

/** Mirrors the API's permission table (api/src/auth/auth.types.ts) so the UI only shows what will work. */
export const can = {
  postAnnouncements: (u: User) => u.role === 'manager' || u.role === 'board',
  postAlerts: (u: User) => u.role === 'manager',
  manageEvents: (u: User) => u.role === 'manager' || u.role === 'board',
  scheduleMaintenance: (u: User) => u.role === 'manager',
  moderate: (u: User) => u.role === 'manager' || u.role === 'moderator',
}
