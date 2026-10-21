import { sql } from 'drizzle-orm'
import { hashPassword } from '../auth/password'
import { createDb, createPool, runMigrations, type Db } from './db'
import { amenities, announcements, bookings, comments, events, postLikes, posts, users } from './schema'
import { demoCommunity, DEMO_PASSWORD as DEFAULT_PASSWORD } from './seed-data'

/** Every demo account uses this password (SEED_PASSWORD overrides it). */
export const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? DEFAULT_PASSWORD

/** Wipes the database and loads Larkspur Court. Ids restart at 1, matching seed-data.ts. */
export async function seed(db: Db) {
  const data = demoCommunity()
  await db.execute(sql`TRUNCATE post_likes, comments, posts, bookings, amenities, events, announcements, users RESTART IDENTITY CASCADE`)
  const passwordHash = await hashPassword(DEMO_PASSWORD)
  const strip = <T extends { id?: number }>(rows: T[]) => rows.map(({ id: _id, ...rest }) => rest)
  await db.insert(users).values(strip(data.users).map((u) => ({ ...u, passwordHash })))
  await db.insert(announcements).values(strip(data.announcements))
  await db.insert(events).values(strip(data.events))
  await db.insert(amenities).values(strip(data.amenities))
  await db.insert(bookings).values(strip(data.bookings))
  await db.insert(posts).values(strip(data.posts))
  await db.insert(comments).values(strip(data.comments))
  await db.insert(postLikes).values(data.likes)
}

if (require.main === module) {
  const pool = createPool(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/porchlight')
  const db = createDb(pool)
  runMigrations(db)
    .then(() => seed(db))
    .then(() => pool.end())
    .then(() => console.log(`Seeded Larkspur Court. Password for every demo account: ${DEMO_PASSWORD}`))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
