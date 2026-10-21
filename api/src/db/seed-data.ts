import { COMMUNITY_TZ, localDayOffset, zonedDate } from '../common/time'

/**
 * Demo community: "Larkspur Court", a fictional 48-unit condo in Redmond, WA.
 * Plain data with ids in insertion order, so the PostgreSQL seed and the
 * in-browser demo (web/src/demo) start from exactly the same state.
 * No imports from Node or the database, so the browser can use it too.
 */
export const DEMO_PASSWORD = 'porchlight-demo'

const HOUR = 3_600_000

export function demoCommunity(now = new Date()) {
  const at = (days: number, hour: number, minute = 0) => zonedDate(localDayOffset(days, now), hour, minute)
  const ago = (hours: number) => new Date(now.getTime() - hours * HOUR)
  const weekday = (days: number) => at(days, 12).toLocaleDateString('en-US', { weekday: 'long', timeZone: COMMUNITY_TZ })
  const month = now.toLocaleDateString('en-US', { month: 'long', timeZone: COMMUNITY_TZ })

  const users = [
    { id: 1, name: 'Priya Raman', email: 'manager@larkspur.example', role: 'manager' as const, unit: 'Office' },
    { id: 2, name: 'Tom Okafor', email: 'board@larkspur.example', role: 'board' as const, unit: '3B' },
    { id: 3, name: 'Mei Lin', email: 'moderator@larkspur.example', role: 'moderator' as const, unit: '2A' },
    { id: 4, name: 'Ana Souza', email: 'resident@larkspur.example', role: 'resident' as const, unit: '4C' },
    { id: 5, name: 'Ben Carter', email: 'ben@larkspur.example', role: 'resident' as const, unit: '1D' },
    { id: 6, name: 'Chloe Nguyen', email: 'chloe@larkspur.example', role: 'resident' as const, unit: '5A' },
  ]

  const announcements = [
    {
      id: 1, authorId: 1, kind: 'alert' as const, pinned: true, createdAt: ago(5), expiresAt: at(3, 13),
      title: `Water shut-off in Building B, ${weekday(3)} 10 am – 1 pm`,
      body: 'The plumber is replacing the main valve in Building B. Please fill a kettle beforehand. Building A is not affected.',
    },
    {
      id: 2, authorId: 1, kind: 'newsletter' as const, pinned: false, createdAt: ago(30), expiresAt: null,
      title: `${month} newsletter: rain gutters, the new bike room and a pumpkin carving night`,
      body: `Gutter cleaning is booked for ${weekday(8)}. The bike room by the P1 elevator is open, so please register your bike with the office. Pumpkin carving in the clubhouse on ${weekday(6)} evening; pumpkins provided.`,
    },
    {
      id: 3, authorId: 1, kind: 'policy' as const, pinned: false, createdAt: ago(24 * 9), expiresAt: null,
      title: 'Package room policy',
      body: 'Packages are kept in the locked package room for 7 days. Perishables go in the package fridge. If a delivery is missing, report it on the board under Lost & found and the office will check the camera log.',
    },
    {
      id: 4, authorId: 2, kind: 'news' as const, pinned: false, createdAt: ago(52), expiresAt: null,
      title: 'Board meeting minutes: reserve study approved',
      body: 'The board approved the reserve study and the roof repair schedule. Minutes are posted in the office and summarized in the newsletter.',
    },
  ]

  const events = [
    { id: 1, createdBy: 1, kind: 'maintenance' as const, title: 'Garage sweeping, levels P1–P2', description: 'Please move cars out of the garage by 8:45 am.', location: 'Parking garage', startsAt: at(2, 9), endsAt: at(2, 12) },
    { id: 2, createdBy: 1, kind: 'maintenance' as const, title: 'Fire alarm test', description: 'Alarms will sound briefly in both buildings.', location: 'Buildings A and B', startsAt: at(5, 10), endsAt: at(5, 11) },
    { id: 3, createdBy: 1, kind: 'maintenance' as const, title: 'Elevator inspection (Building A)', description: 'The Building A elevator is out of service during the inspection.', location: 'Building A', startsAt: at(9, 13), endsAt: at(9, 15) },
    { id: 4, createdBy: 2, kind: 'community' as const, title: 'Pumpkin carving night', description: 'Pumpkins, tools and hot cider provided. Kids welcome.', location: 'Clubhouse', startsAt: at(6, 18), endsAt: at(6, 20) },
    { id: 5, createdBy: 2, kind: 'community' as const, title: 'Board meeting (open to residents)', description: 'Agenda: roof repair bids, bike room rules.', location: 'Clubhouse', startsAt: at(12, 19), endsAt: at(12, 20, 30) },
    { id: 6, createdBy: 1, kind: 'maintenance' as const, title: 'Dumpster cleaning', description: '', location: 'Trash room', startsAt: at(-3, 8), endsAt: at(-3, 10) },
    { id: 7, createdBy: 2, kind: 'community' as const, title: 'Coffee on the rooftop', description: 'Bring a mug. The board brings the coffee.', location: 'Rooftop deck', startsAt: at(-6, 9), endsAt: at(-6, 10, 30) },
  ]

  const amenities = [
    { id: 1, name: 'Clubhouse', description: 'Kitchen, long table for 16, TV. Good for parties and meetings.', capacity: 30, openHour: 8, closeHour: 22, maxHours: 4 },
    { id: 2, name: 'Rooftop deck', description: 'Gas grill and fire pit with a view of the Cascades on a clear day.', capacity: 20, openHour: 10, closeHour: 21, maxHours: 3 },
    { id: 3, name: 'Media room', description: 'Projector, surround sound, 10 recliners.', capacity: 10, openHour: 9, closeHour: 23, maxHours: 3 },
  ]

  const bookings = [
    { id: 1, amenityId: 1, userId: 5, note: 'Birthday party', startsAt: at(4, 15), endsAt: at(4, 18) },
    { id: 2, amenityId: 2, userId: 4, note: 'Dinner with friends', startsAt: at(1, 17), endsAt: at(1, 19) },
    { id: 3, amenityId: 3, userId: 6, note: 'Movie night', startsAt: at(2, 19), endsAt: at(2, 22) },
    { id: 4, amenityId: 1, userId: 2, note: 'Garden club planning', startsAt: at(3, 10), endsAt: at(3, 12) },
  ]

  const posts = [
    { id: 1, authorId: 5, category: 'issue' as const, createdAt: ago(20), title: 'Light out on garage level P2', body: 'The light next to stall 41 has been out since Monday. It is really dark back there at night.' },
    { id: 2, authorId: 6, category: 'lost_found' as const, createdAt: ago(8), title: 'Found: kid’s blue bike helmet', body: 'Found by the mailboxes in Building A. It’s at my door in 5A, knock any time after 5.' },
    { id: 3, authorId: 4, category: 'for_sale' as const, createdAt: ago(3), title: 'Free couch, you haul', body: 'Grey three-seater, good condition, moving out at the end of the month.' },
  ]

  const comments = [
    { id: 1, postId: 1, authorId: 1, createdAt: ago(18), body: 'Thanks Ben, the electrician is coming Wednesday.' },
    { id: 2, postId: 1, authorId: 6, createdAt: ago(16), body: 'Same at stall 12 on P1, if they can check that too.' },
    { id: 3, postId: 2, authorId: 4, createdAt: ago(6), body: 'I think it belongs to the family in 2C!' },
  ]

  const likes = [
    { postId: 1, userId: 6 },
    { postId: 1, userId: 4 },
    { postId: 3, userId: 5 },
  ]

  return { users, announcements, events, amenities, bookings, posts, comments, likes }
}
