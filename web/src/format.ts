import { COMMUNITY_TZ } from '../../api/src/common/time'

const tz = { timeZone: COMMUNITY_TZ }

export const fmt = {
  day: (iso: string) => new Date(iso).toLocaleDateString('en-US', { ...tz, weekday: 'short', month: 'short', day: 'numeric' }),
  time: (iso: string) => new Date(iso).toLocaleTimeString('en-US', { ...tz, hour: 'numeric', minute: '2-digit' }),
  dayTime: (iso: string) => `${fmt.day(iso)}, ${fmt.time(iso)}`,
  range: (a: string, b: string) => `${fmt.day(a)}, ${fmt.time(a)} – ${fmt.time(b)}`,
  ago: (iso: string) => {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins} min ago`
    const hours = Math.round(mins / 60)
    if (hours < 24) return `${hours} h ago`
    const days = Math.round(hours / 24)
    return days === 1 ? 'yesterday' : `${days} days ago`
  },
}
