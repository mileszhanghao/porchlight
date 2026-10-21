import { DEMO_PASSWORD } from '../../../api/src/db/seed-data'

/** Quick sign-in buttons for the demo: one person per role. */
export const DEMO_PEOPLE = [
  { name: 'Ana Souza', label: 'Resident, 4C', email: 'resident@larkspur.example', password: DEMO_PASSWORD },
  { name: 'Priya Raman', label: 'Building manager', email: 'manager@larkspur.example', password: DEMO_PASSWORD },
  { name: 'Tom Okafor', label: 'Board member', email: 'board@larkspur.example', password: DEMO_PASSWORD },
  { name: 'Mei Lin', label: 'Moderator', email: 'moderator@larkspur.example', password: DEMO_PASSWORD },
]

export const STORAGE_KEY = 'porchlight-demo-v1'

export function resetDemo() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Storage unavailable: nothing persisted anyway.
  }
}
