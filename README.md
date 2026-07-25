# institutes

Map-first educational marketplace: students discover institutes on a full-screen
map, pre-register online, and study through an LMS with offline-capable exams.

- `apps/api` — NestJS modular monolith (PostgreSQL + PostGIS, Kysely, BullMQ)
- `apps/mobile` — Flutter client (map discovery, pre-registration, quizzes)
- `apps/web` — Next.js staff/admin console *(not built yet)*

## Getting started

```bash
# 1. dependencies
npm install

# 2. configuration
cp .env.example .env

# 3. infrastructure — Postgres+PostGIS, Redis, MinIO
docker compose up -d

# 4. schema + demo data
npm run db:migrate
npm run db:seed

# 5. run it
npm run start:api        # http://localhost:4000/api/v1
```

Swagger UI is at `http://localhost:4000/api/v1/docs`.

Then the mobile client:

```bash
cd apps/mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
```

`10.0.2.2` is the host as seen from the Android emulator; use `localhost` for
the iOS simulator, or your LAN IP for a physical device.

## Seeded accounts

Every seeded account uses the password `Password123` (override with
`SEED_PASSWORD`). OTP login also works — the API returns the code in the
response outside production, and `11111` is always accepted.

| Role | Phone |
| --- | --- |
| Super admin | `09120000001` |
| Institute admin | `09121000000` … `09121000011` (one per institute) |
| Teacher | `09122000000` … `09122000012` |
| Student | `09120000002` (Sara Ahmadi) + 30 more at `09123000000`+ |

The seed creates 12 institutes across Tehran, 22 courses, 13 instructors,
reviews, leads at every CRM stage, enrollments with matching wallet entries,
quizzes, live sessions and payout requests. The data is deliberately varied so
every discovery filter returns a meaningful subset — 11 published (one draft),
7 verified, ratings from 3.4 to 4.9, 7 institutes with online courses and 8
with an active discount.

```bash
npm run db:seed           # idempotent: safe to re-run
npm run db:seed:fresh     # wipe seeded rows first
npm run db:setup          # migrate + seed in one step
```

The seed refuses to run if `DATABASE_URL` or `NODE_ENV` looks like production,
unless `ALLOW_PRODUCTION_SEED=true`.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run build:api` | Compile the API to `apps/api/dist` |
| `npm run start:api` | Build, then run |
| `npm run dev:api` | Watch mode |
| `npm run typecheck` | Type-check without emitting |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run db:seed` | Load demo data |
| `npm run infra:up` / `infra:down` | Start/stop containers |

## Architecture notes

**PostGIS owns discovery.** `institutes.location` is a `geography(Point,4326)`
column with a GIST index, kept in sync from `latitude`/`longitude` by a trigger.
A single SQL function, `search_institutes()`, applies radius, bounding box,
category, skill, rating, price and feature filters in one index-accelerated
query.

**Triggers maintain derived data.** Ratings, review counts, `enrolled_count`
and the denormalised course flags (`has_online_courses`, `min_price`, …) are all
computed by database triggers. Application code — including the seed — writes
only the source rows and lets the database derive the rest.

**Kysely rather than Prisma.** PostGIS geography has no native Prisma type and
every discovery query is raw spatial SQL, so Kysely gives the same type safety
with no codegen step or engine binaries.

**Validation is shared.** `apps/mobile/lib/core/validation/form_validator.dart`
is a direct port of the TypeScript validator. The client uses it for instant
feedback and the server re-runs the identical rules before persisting, so the
two can never disagree.

## Status

Working: API (99 routes), schema and migrations, seed data, Flutter client.

Not done: `apps/web` admin console, an API test suite, and wiring the Flutter
`FILE_UPLOAD` quiz answers and Socket.IO client.
