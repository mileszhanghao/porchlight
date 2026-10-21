import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const role = pgEnum('role', ['resident', 'manager', 'board', 'moderator'])
export const announcementKind = pgEnum('announcement_kind', ['news', 'alert', 'newsletter', 'policy'])
export const eventKind = pgEnum('event_kind', ['community', 'maintenance'])
export const eventStatus = pgEnum('event_status', ['scheduled', 'canceled'])
export const bookingStatus = pgEnum('booking_status', ['confirmed', 'canceled'])
export const postCategory = pgEnum('post_category', ['general', 'issue', 'lost_found', 'for_sale'])

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow()

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: role('role').notNull().default('resident'),
  unit: text('unit'),
  createdAt: createdAt(),
})

export const announcements = pgTable(
  'announcements',
  {
    id: serial('id').primaryKey(),
    authorId: integer('author_id').notNull().references(() => users.id),
    kind: announcementKind('kind').notNull().default('news'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    pinned: boolean('pinned').notNull().default(false),
    /** Alerts stop showing on the dashboard after this time. */
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('announcements_created_idx').on(t.createdAt)],
)

export const events = pgTable(
  'events',
  {
    id: serial('id').primaryKey(),
    createdBy: integer('created_by').notNull().references(() => users.id),
    kind: eventKind('kind').notNull(),
    status: eventStatus('status').notNull().default('scheduled'),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    location: text('location').notNull().default(''),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('events_starts_idx').on(t.startsAt), check('events_time_order', sql`${t.endsAt} > ${t.startsAt}`)],
)

export const amenities = pgTable('amenities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  description: text('description').notNull(),
  capacity: integer('capacity').notNull(),
  /** Bookable window in the community's local time zone, as whole hours (0-24). */
  openHour: integer('open_hour').notNull(),
  closeHour: integer('close_hour').notNull(),
  maxHours: integer('max_hours').notNull(),
})

/**
 * Double bookings are prevented by a PostgreSQL exclusion constraint
 * (see drizzle/0001_booking_no_overlap.sql): two confirmed bookings of the same
 * amenity can never have overlapping [starts_at, ends_at) ranges, even when
 * two requests arrive at the same moment.
 */
export const bookings = pgTable(
  'bookings',
  {
    id: serial('id').primaryKey(),
    amenityId: integer('amenity_id').notNull().references(() => amenities.id),
    userId: integer('user_id').notNull().references(() => users.id),
    status: bookingStatus('status').notNull().default('confirmed'),
    note: text('note').notNull().default(''),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('bookings_user_idx').on(t.userId, t.startsAt),
    check('bookings_time_order', sql`${t.endsAt} > ${t.startsAt}`),
  ],
)

export const posts = pgTable(
  'posts',
  {
    id: serial('id').primaryKey(),
    authorId: integer('author_id').notNull().references(() => users.id),
    category: postCategory('category').notNull().default('general'),
    title: text('title').notNull(),
    body: text('body').notNull(),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    hiddenReason: text('hidden_reason'),
    createdAt: createdAt(),
  },
  (t) => [index('posts_created_idx').on(t.createdAt)],
)

export const comments = pgTable(
  'comments',
  {
    id: serial('id').primaryKey(),
    postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
    authorId: integer('author_id').notNull().references(() => users.id),
    body: text('body').notNull(),
    hiddenAt: timestamp('hidden_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('comments_post_idx').on(t.postId, t.createdAt)],
)

export const postLikes = pgTable(
  'post_likes',
  {
    postId: integer('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
    userId: integer('user_id').notNull().references(() => users.id),
  },
  (t) => [primaryKey({ columns: [t.postId, t.userId] })],
)

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, { fields: [posts.authorId], references: [users.id] }),
  comments: many(comments),
}))
export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, { fields: [comments.postId], references: [posts.id] }),
  author: one(users, { fields: [comments.authorId], references: [users.id] }),
}))

export type Role = (typeof role.enumValues)[number]
export type User = typeof users.$inferSelect
