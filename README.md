# institutes

Map-first educational marketplace. Students discover institutes on a
full-screen map, pre-register online, and study through an LMS whose exams keep
working when the connection drops.

| Package | Stack | Status |
| --- | --- | --- |
| `apps/api` | NestJS · PostgreSQL + PostGIS · Kysely · BullMQ | Working — 99 routes |
| `apps/mobile` | Flutter · Bloc · flutter_map · Hive | Written, not yet compiled |
| `apps/web` | Next.js RTL Persian admin console | Working — builds, typechecks, 57 unit tests |

---

## Quick start

Requires Node 20+, Docker, and (for the client) Flutter 3.35+.

```bash
npm install
cp .env.example .env

docker compose up -d      # Postgres+PostGIS, Redis, MinIO
npm run db:migrate        # create the schema
npm run db:seed           # load demo data
npm run start:api         # http://localhost:4000/api/v1
```

Then the web console:

```bash
npm run dev:web          # http://localhost:3000
```

Sign in with the seeded accounts (every password is `Password123`); the
console routes by role: `SUPER_ADMIN` gets the platform console (verification
queue, payout processing, institute directory), `INSTITUTE_ADMIN` gets the
full institute dashboard (profile + map picker, media, instructors, courses,
timetable, form builder, lead CRM Kanban, quiz authoring & grading, live
classes, materials, reviews, finance), and `TEACHER` gets their courses and
LMS tooling. Students are pointed to the mobile app.

Check it came up:

```bash
curl http://localhost:4000/api/v1/health
# {"status":"ok","timestamp":"..."}
```

Swagger UI: **http://localhost:4000/api/v1/docs**
MinIO console: **http://localhost:9001** (`minioadmin` / `minioadmin`)

Then the mobile client:

```bash
cd apps/mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
```

| Target | `API_BASE_URL` |
| --- | --- |
| Android emulator | `http://10.0.2.2:4000/api/v1` |
| iOS simulator | `http://localhost:4000/api/v1` |
| Physical device | `http://<your-lan-ip>:4000/api/v1` |

---

## Signing in

Every seeded account uses the password `Password123` (override with
`SEED_PASSWORD`). OTP login also works without an SMS gateway: outside
production the API returns the code in the response, and `11111` is always
accepted.

| Role | Phone |
| --- | --- |
| Super admin | `09120000001` |
| Institute admin | `09121000000` … `09121000011` (one per institute) |
| Teacher | `09122000000` … `09122000012` |
| Student (demo) | `09120000002` — Sara Ahmadi |
| Students | `09123000000` … `09123000029` |

---

## Demo data

`npm run db:seed` creates 8 categories, 12 institutes across Tehran with real
coordinates, 22 courses, 13 instructors, 31 students, plus reviews, leads at
every CRM stage, enrollments with matching wallet entries, quizzes, live
sessions and payout requests.

The mix is deliberate, so every discovery filter returns a meaningful subset
instead of everything or nothing:

| Filter | Data |
| --- | --- |
| Published | 11 of 12 — one draft, to prove drafts stay hidden |
| Verification | 7 verified · 2 pending · 2 unverified · 1 rejected |
| Rating | 3.4 → 4.9, so `minRating=4.5` genuinely narrows results |
| Has online classes | 7 institutes |
| Active discount | 8 institutes |

```bash
npm run db:seed         # idempotent — safe to re-run
npm run db:seed:fresh   # wipe seeded rows first
npm run db:setup        # migrate + seed
```

Three properties worth knowing:

- **Idempotent.** Every insert is `ON CONFLICT DO UPDATE` on a natural key, so
  re-running changes nothing and never duplicates.
- **Transactional.** One `BEGIN`/`COMMIT`; a failure leaves the database
  untouched.
- **Trigger-friendly.** It writes only latitude/longitude and reviews, letting
  database triggers derive `location`, `rating`, `enrolled_count` and the
  denormalised course flags rather than fighting them.

The seed refuses to run against a `DATABASE_URL` or `NODE_ENV` that looks like
production unless `ALLOW_PRODUCTION_SEED=true`.

---

## Commands

Run from the repository root.

| Command | Purpose |
| --- | --- |
| `npm run start:api` | Build, then run the API |
| `npm run dev:api` | Watch mode |
| `npm run build:api` | Compile to `apps/api/dist` |
| `npm run typecheck` | Type-check without emitting |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run db:migrate:down` | Roll back the last migration |
| `npm run db:seed` / `db:seed:fresh` | Load demo data |
| `npm run db:setup` | Migrate + seed |
| `npm run dev:web` / `build:web` | Run/build the web console |
| `npm run infra:up` / `infra:down` | Start/stop containers |

In `apps/api`, `npm run worker` runs the FFmpeg transcoding worker (needs
`ffmpeg` and `ffprobe` on `PATH`). In `apps/mobile`, `flutter test` runs the
Dart suites.

---

## Layout

```
apps/
├── api/
│   ├── migrations/            0001 schema · 0002 search functions
│   └── src/
│       ├── db/                Kysely types, migration runner, seed
│       ├── modules/           13 feature modules
│       └── packages/shared/   enums, DTOs, shared validator
├── mobile/
│   ├── lib/
│   │   ├── blocs/             auth · discovery · quiz
│   │   ├── core/              config, map clustering, networking, validation
│   │   ├── data/              models, repositories, Hive cache
│   │   └── ui/                screens and widgets
│   └── test/                  validator + clustering suites
└── web/                       Next.js 15 console (RTL Persian, React Query, Tailwind)
    ├── src/app/               27 routes — super-admin + institute + teacher areas
    ├── src/lib/api/            typed client with silent token refresh
    ├── src/components/         ui primitives + feature components
    └── test/                   vitest suites (format, validation, Kanban, client)
tools/dart_sanity_check.py     structural checks for the Flutter code
tools/audit-web-routes.mjs      verifies every web client URL exists in the API
```

---

## How it works

**PostGIS owns discovery.** `institutes.location` is a `geography(Point,4326)`
column with a GIST index, kept in sync from `latitude`/`longitude` by a trigger.
One SQL function — `search_institutes()` — applies radius, bounding box,
category, skill, rating, price and feature filters in a single
index-accelerated query.

**The database derives its own data.** Ratings, review counts,
`enrolled_count` and the denormalised course flags are all maintained by
triggers. Application code writes source rows only.

**Money moves with the CRM.** Dragging a lead to `ENROLLED` creates the
enrollment plus the revenue and commission ledger entries in one transaction,
so finances cannot drift from the pipeline.

**Exam timing is never trusted to the client.** The countdown derives from the
server's `expiresAt`, and a cron force-submits overdue attempts. Backgrounding
the app, changing the device clock or killing the process cannot buy extra
time. Answers persist to Hive immediately and queue in an outbox that replays
on reconnect, with last-write-wins on `clientUpdatedAt`.

**Media never passes through the API.** Clients get a presigned URL and upload
straight to S3/MinIO; the API records metadata and queues an FFmpeg transcode.

**Kysely rather than Prisma.** PostGIS geography has no native Prisma type and
every discovery query is raw spatial SQL, so Kysely gives equivalent type
safety with no codegen step or engine binaries.

**Validation is deliberately duplicated.**
`apps/mobile/lib/core/validation/form_validator.dart` is a direct port of the
TypeScript validator in `apps/api/src/packages/shared/src/validation.ts`. The
client uses it for instant feedback; the server re-runs identical rules before
persisting. Change one, change the other —
`apps/mobile/test/form_validator_test.dart` pins the behaviour.

---

## Web console notes

- Point it at a different API with `NEXT_PUBLIC_API_BASE_URL` (default
  `http://localhost:4000`). In dev, `/api/*` rewrites to the API as well.
- The console is **RTL Persian** end-to-end: Vazirmatn (bundled locally),
  Jalali dates, Persian digits and IRR formatting. Status colours match the
  mobile app's theme tokens.
- Access tokens live in memory and rotate silently via `/auth/refresh`; a
  single in-flight refresh serves any number of concurrent 401s.
- Uploads never pass through the API: presign → direct S3/MinIO PUT → confirm.
- The Kanban enforces the same lead transitions as the server
  (`LEAD_TRANSITIONS`), and moving a lead to `ENROLLED` warns that the
  enrollment plus wallet entries are created atomically.
- Two small additive API additions were made while building the console:
  `GET /me/courses` (courses the current teacher/admin is involved with) and
  `isPublished` on course summaries (the read model previously hid it).

## Troubleshooting

**`Cannot find module dist/main.js`** — the build produced nothing. Clear the
cache and rebuild:

```bash
rm -rf apps/api/dist apps/api/tsconfig.tsbuildinfo && npm run build:api
```

**`Unable to reach PostgreSQL`** — the API fails fast by design. Confirm the
containers are healthy with `docker compose ps`. To start the API without a
database (HTTP routes only), set `SKIP_DB_PING=true REDIS_ENABLED=false`.

**`Table "institutes" not found`** when seeding — run `npm run db:migrate`
first.

**`could not determine executable to run`** — dependencies are missing; run
`npm install`.

---

## Status

**Working:** the API builds, boots and maps 100 routes; schema, migrations and
seed are in place. The web console builds (`next build`), typechecks, lints
clean and ships 57 unit tests across formatting, validation parity, Kanban
transitions and the token-refresh client.

**Not done yet:**

- API test suite (`npm test` is currently a placeholder)
- Flutter: `FILE_UPLOAD` quiz answers and the Socket.IO client are unwired

**Verified with caveats.** The API was built and its endpoints exercised
(`/health`, Swagger, a 401 on a guarded route). The seed typechecks and its 23
INSERTs were validated statically against the migrations — columns exist,
`NOT NULL`s are supplied, placeholder counts match, `ON CONFLICT` targets real
unique keys — but **it has not been executed against a live database**, as none
was available in the authoring environment. The Flutter app has likewise never
been compiled (no SDK available), so expect minor analyzer fixes;
`tools/dart_sanity_check.py` validates imports, delimiter balance and
`part`/`part of` pairing as a partial substitute.
