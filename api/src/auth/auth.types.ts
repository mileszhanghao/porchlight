import type { Role } from '../db/schema'

export interface SessionUser {
  id: number
  name: string
  role: Role
  unit: string | null
}

export const SESSION_COOKIE = 'porchlight_session'
export const CSRF_HEADER = 'x-porchlight-csrf'

/** Who may do what. Managers run the building; the board posts community events; moderators keep the board civil. */
export const Can = {
  postAnnouncements: ['manager', 'board'] as Role[],
  postAlerts: ['manager'] as Role[],
  manageEvents: ['manager', 'board'] as Role[],
  manageAnyBooking: ['manager'] as Role[],
  moderate: ['manager', 'moderator'] as Role[],
  manageUsers: ['manager'] as Role[],
}
