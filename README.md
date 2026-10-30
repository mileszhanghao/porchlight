# Porchlight

A community app for a condo building. The manager posts notices and emergency alerts, everyone sees the building calendar, residents book the clubhouse or rooftop without double-booking, and neighbors use a moderated board to report a broken light or give away a couch.

**Live demo:** https://mileszhanghao.github.io/porchlight/ runs in your browser against a fictional 48-unit condo, *Larkspur Court* in Redmond, WA. Pick a person to sign in as (resident, building manager, board member or moderator) and switch roles from the bar at the top to see what each one can do.

**Stack:** TypeScript · NestJS 11 · PostgreSQL 16 · Drizzle ORM · zod · React 19 · Vite · Tailwind CSS 4 · TanStack Query · React Router · FullCalendar · MSW · Jest + Supertest · Vitest · Playwright · Docker · GitHub Actions

## Background

This started as my LaiOffer Flag Camp team project (spring 2025): a five-person team building a *Community Property Management System* for a condo whose residents kept running into clashing common-room bookings, lost packages and scattered notices. I was co-tech lead and worked on the front end; others owned the back end and the API design.

**Porchlight is my own rewrite**, written from scratch in 2026 rather than taken from the team's code. I kept the product scope we agreed on as a team and rebuilt every layer myself. The rewrite was developed with AI pair-programming assistance (Claude).

## What it does

| Area | What you can do | Who |
|---|---|---|
| Home | Active alerts in red, pinned notices, newsletter and policies, the next 7 days, your bookings, new board posts | everyone |
| Notices | Post news, newsletters and policies; send alerts that expire on their own | manager (alerts and all notices), board (no alerts) |
| Calendar | Month/week view of community events and building maintenance; add or cancel events | manager (maintenance and community), board (community) |
| Book a room | Drag across free time on a room's week calendar; see what's taken; cancel your own | everyone (manager can cancel any) |
| Board | Post, reply, like; filter by category (building issue, lost & found, free/for sale) | everyone |
| Moderation | Hide posts with a reason, hide replies, unhide | moderator, manager |

The team's original priorities had payments (condo fees) as P2 and a trustee chat as P1. I left both out. Payments mean handling card data, and a chat needs a real-time service that a free demo can't host. Those would be next.

## Design decisions

**Double bookings are impossible, not just unlikely.** A booking is a time range, and PostgreSQL enforces that no two confirmed bookings of the same room overlap:

```sql
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (amenity_id WITH =, tstzrange(starts_at, ends_at, '[)') WITH &&)
  WHERE (status = 'confirmed');
```

A check in application code ("is the slot free? then insert") can be passed by two requests arriving at the same moment. With the constraint, the database rejects the second request and the API returns 409. An end-to-end test fires two simultaneous requests for the same slot and expects exactly one 201 and one 409. The team's original schema stored a single `booking_date` per booking, with no end time, so it could not express overlap at all.

**Booking rules run in the building's time zone.** Opening hours ("Clubhouse 8 am – 10 pm"), the 4-hour limit, half-hour slots, no booking in the past or more than 60 days ahead, and at most 3 upcoming bookings per resident all live in one pure function, `api/src/bookings/rules.ts`. It uses DST-aware helpers so "8 am" means 8 am in Redmond in July and in December, wherever the server runs. The browser demo imports the same file, so the demo and the API can't disagree. The calendars also show the building's clock, not the viewer's: the browser tests run with the browser set to Tokyo time, which caught a bug where someone outside Seattle dragging "6 PM" would have booked a different hour.

**Auth.**
- Accounts are created by the manager. There is no open sign-up, since residents are verified owners or tenants.
- Passwords are hashed with scrypt.
- Sessions are a signed JWT in an `httpOnly`, `SameSite=Lax`, `Secure` cookie, so the token is never readable by JavaScript.
- Every state-changing request must carry a custom `x-porchlight-csrf` header, which a cross-site form can't send.
- Login is rate-limited to 5 attempts per minute.
- Global guards run in order: rate limit, CSRF header, session, role. Routes opt out with `@Public()` and opt in to roles with `@Roles(...)`. The permission table lives in one place (`api/src/auth/auth.types.ts`).

**Privacy on the room calendar.** Residents see that a slot is taken and by which unit. Only the manager and the person who booked see names and notes.

**Moderation keeps a record.** Hidden posts stay in the database with the moderator's reason, which moderators and the manager still see. Residents stop seeing the post, and a hidden reply shows to them as "[removed by a moderator]".

**Queries.** Board pages are keyset-paginated by id. Like and reply counts come from correlated subqueries, so a page is one query instead of N+1. The schema lives in `api/src/db/schema.ts`, and migrations are generated by drizzle-kit and applied on startup. The exclusion constraint is a hand-written migration.

## Architecture

```
web/  React SPA ──/api──▶  api/  NestJS
                              ├─ auth/          login, cookie session, guards (rate limit → CSRF → session → role)
                              ├─ announcements/ notices and alerts
                              ├─ events/        community calendar
                              ├─ bookings/      rooms, booking rules, schedules
                              ├─ board/         posts, replies, likes, moderation
                              ├─ dashboard/     one request for the home page
                              └─ db/            Drizzle schema, migrations, seed  ──▶ PostgreSQL
```

In production one container serves the API and the built React app (`Dockerfile`). For the GitHub Pages demo, [MSW](https://mswjs.io) runs an in-browser version of the API (`web/src/demo/`). It follows the same routes and permission rules and the same booking-rule code, and keeps its data in `localStorage`. The seed data (`api/src/db/seed-data.ts`) is shared too, so the demo and a freshly seeded database look the same.

## Running it

```bash
cp .env.example .env            # set JWT_SECRET
docker compose up --build
docker compose exec app node dist/db/seed.js   # load Larkspur Court (first time)
# open http://localhost:3000 — e.g. resident@larkspur.example / porchlight-demo
```

Developing:

```bash
cd api && npm install && npm run db:seed && npm run dev    # API on :3000 (needs DATABASE_URL, JWT_SECRET)
cd web && npm install && npm run dev                       # UI on :5173, proxies /api
cd web && npm run dev:demo                                 # UI with the in-browser API, no backend needed
```

## Tests

```bash
cd api && TEST_DATABASE_URL=postgres://... npm test   # unit + end-to-end against PostgreSQL (Jest, Supertest)
cd web && npm test                                    # demo API handlers (Vitest + MSW)
cd web && npm run e2e                                 # browser tests (Playwright)
```

- **API end-to-end tests** cover:
  - auth, the cookie flags, the CSRF header and the login rate limit
  - role checks and field-level validation errors
  - bookings: overlaps, the two-request race, opening hours, ownership on cancel, the 3-booking cap, and who sees names
  - the board's like idempotency and moderation
- **Unit tests** cover the booking rules, daylight-saving conversion and password hashing.
- **Playwright** drives the real UI through four flows:
  - drag-select a booking on the calendar, then cancel it
  - the manager sends an alert that a resident then sees, while a board member doesn't get the option
  - a moderator hides a post and residents stop seeing it
  - likes toggle, and replies appear in the thread

GitHub Actions runs all of it, plus a Docker build, on every push.
