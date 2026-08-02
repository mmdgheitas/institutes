# Implementation Plan — Web Console (`apps/web`)

> **Status: DONE — approved and shipped.** Every milestone below was built,
> and the quality gates in §10 pass: `next build` succeeds (27 routes),
> `tsc --noEmit` is clean, ESLint reports 0 problems, and 57 Vitest tests
> pass. The plan text below is the original contract; see §13 for the
> delivery report and the small deviations from it.

---

## 1. Goal

Build the missing `apps/web` app: a **RTL Persian admin & management console**
for the institutes platform. It serves three audiences:

| Audience | Role on the API | What they manage |
| --- | --- | --- |
| Platform operator | `SUPER_ADMIN` | Institute verification queue, payout processing, platform-wide stats |
| Institute staff | `INSTITUTE_ADMIN` | The full institute dashboard: profile, media, courses, instructors, classrooms/timetable, pre-registration forms, lead CRM (Kanban), quizzes + grading, live classes, materials, wallet & payouts, reviews, notifications |
| Teachers | `TEACHER` | Course content they teach: quizzes (authoring + manual grading), materials, live sessions, student enrollments |

**Explicitly out of scope:** the student-facing discovery/storefront — that is the
mobile app's job. A student who signs in on the web sees a friendly notice
pointing them to the mobile app (they have no staff surfaces).

The definition of done is not "pages exist" but: every screen consumes a **real
API endpoint**, with correct role gating, loading/empty/error states, RTL
Persian UX, and no console errors under `next build` + `typecheck` + `lint`.

## 2. Assumptions (please verify)

1. **Language & locale.** The platform is Iranian (Tehran institutes, IRR
   currency, Persian category names, Iranian IBANs). The console will be:
   - **Persian UI, RTL**, with the **Vazirmatn** font (self-hosted via
     `@next/font`), Persian digits, and **Jalali calendar** for all dates.
   - English fallback strings where the API returns them (seed data is partly
     English) — display as-is, never translate server content.
2. **Money.** Currency is IRR (from `PLATFORM_CURRENCY=IRR`). All amounts
   formatted with thousands separators; no decimals. Wallet "available
   balance" is what a payout request draws from.
3. **Auth.** The API is bearer-token based (no cookies). The web app stores
   tokens and silently refreshes (access TTL is 15 min — refresh is mandatory,
   not optional).
4. **Multi-institute admins.** `GET /institutes/mine` returns a list — a user
   can belong to several institutes. The console therefore has an **institute
   switcher** in the sidebar/topbar; every institute-scoped page uses the
   currently selected institute.
5. **Teacher scope.** `TEACHER` can author quizzes, add materials and create
   live sessions for courses of institutes they belong to (per API guards).
   Teachers get a read-only "course overview", not the CRM/finance screens.
6. **CORS/ports.** API at `http://localhost:4000/api/v1`, web at
   `http://localhost:3000` (already allowed by `CORS_ORIGINS` in `.env.example`).
7. **No backend changes.** The API is treated as frozen. If a bug is found
   while integrating, it is reported and fixed separately — never worked
   around silently in the client.

## 3. Tech stack (locked to existing `apps/web/package.json` deps)

| Concern | Choice | Why |
| --- | --- | --- |
| Framework | **Next.js 15 (App Router, RSC + client islands)** | Already in `package.json` |
| UI styling | **Tailwind CSS 3 + `tailwind-merge` + `clsx`** | Pre-installed |
| Icons | **lucide-react** | Pre-installed |
| Server state | **@tanstack/react-query** (queries, mutations, optimistic updates, cache invalidation) | Pre-installed |
| Client state | **zustand** (session, active institute, UI state) | Pre-installed |
| Forms | React Hook Form + zod? **No** — keep to available deps: hand-rolled `useForm`-style hooks + a shared validation module | Avoids adding unapproved deps; API DTOs already define the rules |
| Charts | **recharts** (revenue series, platform stats) | Pre-installed |
| Map (institute picker) | **leaflet + supercluster** (with RTL-aware tile layer, `tile.openstreetmap.org` fallback; marker drag-to-pick for lat/lng) | Pre-installed |
| Realtime | **socket.io-client** (notifications badge, live Kanban moves, proctor focus-loss alerts) | Pre-installed, gateway exists at `/realtime` |
| Dates | **date-fns + a small Jalali adapter** (`Intl.DateTimeFormat('fa-IR-u-ca-persian')` based — no extra dependency) | Pre-installed |
| HTTP | **fetch wrapper** with typed error handling + refresh queue (no axios — not in deps) | Matches existing deps |
| Types | Import enums/DTO types from the shared package via a `file:` workspace reference to `apps/api/src/packages/shared` | Single source of truth — the repo already compiles it to `.d.ts` |
| Tests | **Vitest + React Testing Library** (added as dev deps) | Need to add; will be flagged in approval |
| Lint/format | eslint-config-next + prettier (repo-wide config) | Existing |

## 4. Project structure

```
apps/web/
├── package.json               # + @institutes/shared (file:), vitest dev deps
├── next.config.ts             # rewrites: /api/* -> localhost:4000 (dev only)
├── tsconfig.json
├── postcss.config.js / tailwind.config.ts
├── src/
│   ├── app/
│   │   ├── layout.tsx            # <html dir="rtl" lang="fa">, Vazirmatn, providers
│   │   ├── (auth)/login/page.tsx # password login + OTP tab
│   │   ├── (console)/
│   │   │   ├── layout.tsx        # sidebar + topbar shell, auth gate, institute switcher
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── institutes/       # super-admin directory + detail
│   │   │   ├── verification/page.tsx
│   │   │   ├── payouts/page.tsx
│   │   │   ├── institute/        # institute admin area (switched by active institute)
│   │   │   │   ├── profile/  media/  instructors/
│   │   │   │   ├── courses/[id]/    # edit, quizzes, materials, live-sessions, timetable
│   │   │   │   ├── forms/  slots/  leads/
│   │   │   │   ├── enrollments/  quizzes/  grading/
│   │   │   │   ├── reviews/  finance/
│   │   │   └── notifications/page.tsx
│   │   └── not-found.tsx, error.tsx, loading.tsx
│   ├── components/            # ui/ primitives + feature components
│   ├── lib/
│   │   ├── api/               # client.ts (refresh queue), endpoints.ts (typed), errors.ts
│   │   ├── auth/              # session store, token storage, route guard
│   │   ├── realtime/          # socket.ts (auth + reconnect + events)
│   │   ├── format/            # fa-IR number, currency, Jalali date, relative time
│   │   ├── validation/        # mirrors API DTO rules (client-side parity)
│   │   └── upload/            # presign -> PUT to S3 -> confirm
│   ├── hooks/                 # useQuery/useMutation wrappers per domain
│   ├── types/                 # re-exports from @institutes/shared + response types
│   └── stores/                # zustand: session, activeInstitute, toasts
└── test/                      # vitest setup + unit/component tests
```

## 5. Design system & UI/UX standards

Consistent with the **mobile app's tokens** (`app_theme.dart`):

| Token | Value |
| --- | --- |
| Primary | `#2563EB` |
| Secondary | `#0EA5E9` |
| Success / Warning / Danger | `#16A34A` / `#F59E0B` / `#DC2626` |
| Lead column colors | NEW `#3B82F6`, CONTACTED `#8B5CF6`, INTERVIEWED `#F59E0B`, ENROLLED `#16A34A`, CANCELLED `#6B7280` (identical to mobile Kanban) |
| Radius / cards / inputs | 12–16px rounded, subtle borders, filled inputs — mirroring Material 3 look of the app |

**Mandatory UX rules (applied to every screen):**

1. **RTL-first.** `dir="rtl"` on `<html>`; logical properties (`ms-`/`me-`/`ps-`/`pe-`), never left/right. Numbers/IBANs/lat-lng stay LTR inline.
2. **Persian localization.** Persian digits in all UI text; Jalali dates everywhere (with Gregorian tooltip); IRR formatting via `Intl.NumberFormat('fa-IR')`.
3. **Four states on every data view:** loading skeleton → data → empty state (with an action button) → error state (with retry). No blank screens, no endless spinners.
4. **Mutations:** optimistic where safe (Kanban moves, toggles), always with rollback; error toasts via a shared toast system; destructive actions (delete course, reject payout, cancel slot) require a confirm dialog stating the consequence.
5. **Forms:** inline validation mirroring the API DTOs (same regexes, min/max, required), submitted state disables the button, server errors map to fields or a banner; never lose input on a failed submit.
6. **Accessibility:** keyboard-focusable Kanban (arrow-key moves), `aria` labels on icon buttons, focus rings, `prefers-reduced-motion`, contrast ≥ 4.5:1, semantic `<table>` for lists.
7. **Responsive:** sidebar collapses to a drawer under `lg`; tables become card lists under `md`; forms single column.
8. **Status badges:** consistent badge component with colors from the tokens (verification, lead, enrollment, payout, attempt, media statuses) + Persian labels mapped from enums.
9. **Loading pattern:** skeletons (not spinners) for lists; `useSuspenseQuery` where the page is one query; per-component loading otherwise.
10. **Realtime feedback:** unread notification badge in the topbar (poll + socket); Kanban updates from `lead:moved` events; proctor focus-loss toasts on the quiz-attempts screen.

## 6. Feature breakdown (page → endpoint mapping)

### 6.1 Auth (`/login`)

- Password login: `POST /auth/login` (phone + password). Tabs for **OTP**:
  `POST /auth/otp/request` → `POST /auth/otp/verify` (dev code `11111` works).
- Token handling: access token in memory, refresh token in `localStorage`;
  a **fetch interceptor** queues concurrent 401s, calls `POST /auth/refresh`
  once, replays the queue; on refresh failure → logout → redirect to login
  with a "session expired" notice.
- After login: fetch `/auth/me`; route by role:
  `SUPER_ADMIN` → console dashboard · `INSTITUTE_ADMIN`/`TEACHER` →
  institute dashboard (first institute from `/institutes/mine`) · `STUDENT` →
  "use the mobile app" notice page.
- Profile menu: `PATCH /auth/me`, `POST /auth/logout`, `POST /auth/logout-all`.

### 6.2 Console shell (all authed pages)

- Sidebar nav filtered by role; topbar: institute switcher (INSTITUTE_ADMIN),
  notifications bell, profile menu.
- `GET /institutes/mine` resolves the admin's institutes; the active institute
  id lives in zustand (persisted) and drives every institute-scoped query.
- Notifications: `GET /notifications` (paginated), `GET /notifications/unread-count`,
  `POST /notifications/:id/read`, `POST /notifications/read-all`, plus socket
  push on `user:<id>` room.

### 6.3 Super admin

| Page | Endpoints |
| --- | --- |
| Dashboard | `GET /finance/admin/platform-stats` + charts |
| Verification queue | `GET /institutes/admin/verification/pending` → approve/reject `POST /institutes/admin/verification/:documentId` (view the document via presigned URL) |
| Payouts | `GET /finance/admin/payouts?status=` → `POST /finance/admin/payouts/:payoutId` (approve → pay → reject, with note); IBAN display |
| Institute directory | `GET /discovery/institutes` (paginated search, filters) → `GET /discovery/institutes/:slug` storefront preview |

### 6.4 Institute admin — dashboard

| Page | Endpoints |
| --- | --- |
| Dashboard | `GET /institutes/:id/stats` (headline cards) + `GET /finance/institutes/:id/revenue?months=12` (chart) + upcoming sessions from `GET /institutes/:id/timetable` |
| Institute profile & settings | `GET /institutes/:id/manage`, `PATCH /institutes/:id` (name, description, address, lat/lng **map picker**, working hours, categories, skills, amenities, free pre-registration) |
| Verification | `GET /institutes/:id/verification` (status timeline) + submit document `POST /institutes/:id/verification` (upload via presign `VERIFICATION_DOCUMENT`) |
| Media gallery | `GET /institutes/:id/media`, upload via `POST /uploads/presign` (`INSTITUTE_GALLERY`/`INSTITUTE_LOGO`) → PUT to S3 → `POST /uploads/:mediaId/confirm`; reorder `POST /institutes/:id/media/reorder`, delete `DELETE /media/:mediaId` |
| Instructors | `GET/POST /institutes/:id/instructors`, `PATCH/DELETE /institutes/instructors/:instructorId` |

### 6.5 Institute admin — courses & teaching

| Page | Endpoints |
| --- | --- |
| Courses list | `GET /institutes/:id/courses` (published flag, discount, price, enrollments) |
| Course create/edit | `POST /institutes/:id/courses`, `PATCH /courses/:id`, `DELETE /courses/:id`; sessions editor (day/time/room array per `CourseSession`) |
| Classrooms | `POST/GET /institutes/:id/classrooms` |
| Timetable | `GET /institutes/:id/timetable`, `POST /timetable`, `DELETE /timetable/:entryId` (weekly grid, Persian weekday columns, Sunday first — matching `dayOfWeek: 0 = Sunday`) |
| Course detail tabs | Quizzes, materials, live sessions (below) |

### 6.6 Institute admin — CRM (forms, slots, leads)

| Page | Endpoints |
| --- | --- |
| Forms builder | `GET/POST /institutes/:id/forms`, `GET/PATCH /forms/:formId` — drag-drop field designer for all 11 field types (TEXT, TEXTAREA, NUMBER, EMAIL, PHONE, DATE, SELECT, MULTI_SELECT, CHECKBOX, FILE, NATIONAL_ID) with per-field validation options; contract text + `requiresContract`; activate/deactivate |
| Time slots | `GET/POST /institutes/:id/slots`, `POST /slots/:slotId/cancel` (capacity, course link, booked count) |
| Leads Kanban | `GET /institutes/:id/leads/board` → 5 columns from `LEAD_STATUS_ORDER`; **drag & drop respecting `LEAD_TRANSITIONS`** (invalid moves are rejected client-side AND server-side); moving to `ENROLLED` shows a confirmation explaining "enrollment + wallet entries will be created"; column totals; **live sync** via `lead:moved` socket events |
| Lead detail drawer | `GET /leads/:submissionId` (submission payload, activity timeline, contract acceptance) |
| Lead actions | `PATCH /leads/:submissionId/status` (with `to` + transition validation), `PATCH /leads/:submissionId/course`, `POST /leads/:submissionId/notes` (timeline entry) |
| Students | `GET /courses/:courseId/enrollments`; `PATCH /enrollments/:id/status`; `PATCH /enrollments/:id/progress` |

### 6.7 Institute admin & teacher — LMS

| Page | Endpoints |
| --- | --- |
| Quizzes list | `GET /courses/:courseId/quizzes` (status: draft/published/closed by `opensAt`/`closesAt`) |
| Quiz authoring | `GET /quizzes/:quizId/authoring` (answer key included — **role-gated route**, guard client-side too), `PATCH /quizzes/:quizId`, `DELETE /quizzes/:quizId`, `POST /courses/:courseId/quizzes` — question editor for all 6 types incl. `FILE_UPLOAD` with mime restrictions; settings: time limit, passing score, shuffle, anti-cheat `maxFocusLosses`, attempts, open/close windows |
| Attempts list | `GET /quizzes/:quizId/attempts` (status, focus losses, score) — proctor view with live `proctor:focus-loss` toasts |
| Manual grading | `GET /attempts/:attemptId/result` (per-question breakdown) → `POST /attempts/:attemptId/grade` (award points + feedback); marks `needsManualGrading` items |
| Study materials | `GET/POST /courses/:courseId/materials`, `GET /materials/:materialId/download`, `DELETE /materials/:materialId` — upload via presign `COURSE_MATERIAL` |
| Live sessions | `GET/POST /courses/:courseId/live-sessions`, `POST /live-sessions/:sessionId/recording`, `DELETE /live-sessions/:sessionId`; provider (BBB/Adobe) chosen from enum; join/recording URLs shown |
| Reviews | `GET /discovery/institutes/:slug` (reviews embedded) or via storefront data; reply `POST /institutes/reviews/:reviewId/reply` |

### 6.8 Institute admin — finance

| Page | Endpoints |
| --- | --- |
| Wallet overview | `GET /institutes/:id/wallet` (gross, commission, net, available, pending, paid) — card grid |
| Transactions | `GET /institutes/:id/transactions` (paginated ledger, type badges) |
| Revenue chart | `GET /institutes/:id/revenue?months=` (12-month series, gross/commission/net + enrollment count) |
| Payouts | `GET /institutes/:id/payouts` history; request `POST /institutes/:id/payouts` with amount + **IBAN validated as `IR\d{24}`** and amount ≤ available balance (client pre-check + server error handling) |

### 6.9 Teacher (subset of the above)

- Dashboard: their courses + upcoming live sessions (`GET /me/live-sessions`).
- Course detail: quizzes authoring, grading, materials, live sessions, enrollments — same screens as 6.7, with the API's TEACHER guards.
- **No** CRM, finance, forms, instructors, media, or institute settings.

## 7. Data layer & type safety

- Add `"@institutes/shared": "file:../api/src/packages/shared"` to
  `apps/web/package.json` so enums (`UserRole`, `LeadStatus`,
  `LEAD_TRANSITIONS`, `FormFieldType`, …) and DTO types are **imported, not
  copied**. The shared package is already compiled to `.d.ts`/`.js`.
- `lib/api/client.ts` — typed `fetch` wrapper: base URL from
  `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000/api/v1`),
  `Authorization: Bearer`, 401-refresh queue, typed `ApiErrorBody` handling,
  `X-Request-Id` support.
- `lib/api/endpoints.ts` — one typed function per endpoint (path params,
  query params, body, response type). A page may *only* call these — no raw
  fetch strings anywhere else.
- React Query keys: `['institute', id, 'courses']` style; mutations invalidate
  the exact scopes affected (e.g. lead move invalidates board + stats + wallet).
- Validation parity: `lib/validation` mirrors the class-validator rules of the
  DTOs (phone `09\d{9}`, IBAN `IR\d{24}`, min/max lengths, enum membership)
  so users get instant Persian error messages; the server remains the
  authority.

## 8. Realtime integration

- `socket.io-client` connecting to `http://localhost:4000/realtime` with
  `auth: { token }` (access token from the session store); auto-reconnect with
  backoff; disconnect banner in the topbar.
- Events consumed:
  - `connected` (rooms/ok), `error` (auth failure → re-login),
  - `lead:moved` → invalidate Kanban board (only for the active institute),
  - `proctor:focus-loss` → toast on the quiz-attempts screen,
  - any future `user:<id>` push → bump notification badge.

## 9. Upload flow (used by media, verification, materials, quiz files)

1. `POST /uploads/presign` with `{fileName, mimeType, sizeBytes, kind, purpose, instituteId|courseId}` — client enforces `S3_MAX_UPLOAD_BYTES` and accepts `maxSizeBytes`.
2. `PUT` the file **directly to S3/MinIO** with the returned headers (progress bar, abort support).
3. `POST /uploads/:mediaId/confirm`.
4. Server-side processing state (`PROCESSING`→`READY`) reflected via media list polling/invalidation.

## 10. Quality gates ("no bugs" checklist)

1. `npm run typecheck` (web) — zero errors.
2. `npm run lint` (eslint-config-next) — zero errors.
3. `npm run build` — production build succeeds, no hydration warnings.
4. **Unit tests (Vitest + RTL)** for: `format` (Jalali, currency, digits), `validation` (parity cases from API DTOs), `client` (refresh queue, error mapping), Kanban transitions (LEAD_TRANSITIONS), form builder serialization, and the upload state machine. Target: the logic, not the pixels.
5. **Manual integration pass** against a live stack (docker compose + migrate + seed): every screen visited with the seeded accounts (`09120000001` super admin, `09121000000` institute admin, `09122000000` teacher); happy path + each error path.
6. **Cross-cutting audits:** all API calls go through the typed client (grep for raw `fetch`), no `useEffect` data fetching (React Query only), no `any` leaks (lint rule), no hard-coded Persian strings outside `lib/format`/`messages`, empty/error states present on every list screen.
7. **Docs:** update README (web section) and this file's status to DONE.

## 11. Delivery order (each step ends buildable + typechecked)

1. **Foundation** — workspace wiring, Tailwind/theme, RTL layout, fonts, providers, typed API client, auth store + login page + route guards, shell (sidebar/topbar/switcher), toast/skeleton/badge primitives.
2. **Super admin console** — dashboard, verification queue, payouts, institute directory.
3. **Institute profile & content** — profile/settings (map picker), media gallery, instructors, courses + classrooms + timetable.
4. **CRM** — forms builder, slots, Kanban (drag & drop + transitions + socket), lead drawer, students/enrollments.
5. **LMS** — quiz authoring, attempts/proctoring, manual grading, materials, live sessions, reviews.
6. **Finance** — wallet, ledger, revenue charts, payouts.
7. **Polish & hardening** — responsiveness pass, a11y pass, empty/error state audit, unit tests, README, final build.

## 12. Open questions (only these block start)

1. **Fonts**: self-host Vazirmatn via `@next/font/google` (needs network at build time) — or bundle a local `.woff2` into the repo? (Recommend: local file, offline-safe.)
2. **Testing deps**: OK to add `vitest`, `@testing-library/react`, `jsdom` as devDependencies? (The repo has no web test setup yet.)
3. **Map tiles**: OpenStreetMap tiles are fine for the map picker, or should it be marker-position-only (no tiles) to avoid external calls?
4. **Teacher access**: confirm teachers get the full quiz/material/live-session tooling (per API guards) rather than read-only.
5. **Student sign-in**: confirm the "use the mobile app" notice page is acceptable UX (vs. blocking login entirely).

---

## 13. Delivery report (post-approval)

### What was built
All sections of this plan were implemented in `apps/web`:

- **Foundation**: Next.js 15 App Router, Tailwind design tokens identical to
  the Flutter theme, self-hosted Vazirmatn (FD-NL, bundled in
  `apps/web/public/fonts` — offline-safe), typed API client with a
  single-flight silent refresh queue, Zustand session/active-institute/toast
  stores, RTL shell with sidebar + institute switcher + notification bell +
  profile menu, and a full UI kit (Button, Field, Card, Badge, Modal,
  ConfirmDialog, Table, Tabs, Dropdown, Skeleton, Empty/Error states,
  Pagination, Switch, ProgressBar, UploadButton, MapPicker/Leaflet).
- **Super admin**: platform dashboard (stats cards), institute directory with
  storefront preview, verification queue (view/approve/reject with note),
  payout processing (approve → pay → reject with status filters).
- **Institute admin**: profile editor with Leaflet map picker + working hours
  + category assignment + verification section, media gallery (upload with
  progress, reorder, delete), instructors CRUD, courses (list/create/edit/
  delete with weekly sessions editor), classrooms, weekly timetable grid,
  form builder (all 11 field types, contract/OTP toggles, reorder), time
  slots, **leads Kanban** (drag & drop with server-enforced transitions,
  live socket sync, lead detail drawer with timeline/notes/course assignment),
  reviews with public replies, finance (wallet cards, 12-month revenue chart,
  paginated ledger, payout requests with IBAN validation).
- **LMS (admin + teacher)**: quiz authoring (all 6 question types, answer
  keys, anti-cheat settings, open/close windows), attempts/proctoring list
  with live focus-loss toasts, manual grading with per-question points and
  feedback, study materials (presigned upload + download), live sessions
  (BBB/Adobe Connect, join/recording links), course rosters with status
  management. Teachers get their own dashboard (`/me/courses` +
  `/me/live-sessions`) and the same course tooling.
- **Auth UX**: password + OTP login tabs (dev code surfaced), session
  restore, logout / logout-all, and a friendly "use the mobile app" page for
  student accounts.

### QA performed
- `tsc --noEmit` clean · `eslint .` 0 problems · `next build` succeeds for all
  27 routes · 57 Vitest tests pass (formatting, validation parity with the
  API DTOs, Kanban transitions, refresh-queue behaviour, course/quiz form
  validation).
- **Route audit**: `tools/audit-web-routes.mjs` statically verifies every URL
  the client calls exists in the API controllers — currently 0 unmatched
  (run with `node tools/audit-web-routes.mjs`).
- **Live smoke test**: the API was booted (`SKIP_DB_PING=true`) and the web
  production server against it — login page renders RTL with the bundled
  font, CORS preflight from `localhost:3000` passes, guarded routes return the
  exact 401 shape the client handles, and the discovery routes were found at
  their real unprefixed paths (`/categories` etc. — the plan's §6.3 table had
  assumed `/discovery/*`; the client was fixed accordingly).
- **Caveat**: Docker/PostgreSQL are unavailable in this environment, so the
  full migrate → seed → end-to-end flows could not be executed here. The seed
  had the same unverified status before this task (see README). The client
  contracts were typed against the actual service code and the route audit.

### Deviations from the plan (all additive)
1. `GET /me/courses` added to the API — teachers had no way to list their
   courses (course listing was institute-admin-only; teachers are linked via
   instructor profiles, not `institute_members`).
2. `isPublished` added to course summaries (`toSummary` + shared `CourseSummary`)
   — the read model previously hid the publish flag from the console.
3. `tools/audit-web-routes.mjs` added as a permanent regression guard.
4. Testing deps added as devDependencies: `vitest`, `@testing-library/react`,
   `@testing-library/jest-dom`, `jsdom`, `@vitejs/plugin-react` (approved in
   §12 as recommended).
5. Open questions from §12 were resolved as recommended: local Vazirmatn,
   OpenStreetMap tiles, full teacher tooling, student notice page.

### 14. Completion pass (final)

Following the loop-bug fix, a full completion audit closed every remaining
gap between the web app and the API surface:

- **Onboarding**: «ساخت حساب» (register) tab on the login page
  (`/auth/register`, INSTITUTE_ADMIN or STUDENT), and a complete
  **`/institute/new`** registration page (name/address/categories/skills/
  amenities, Leaflet map picker, working hours, pre-registration toggle).
  Institute admins with no institute now see «ثبت آموزشگاه جدید» CTAs in the
  switcher and on every scoped page, and land on `/institute/new` right after
  registering.
- **Profile editing**: profile menu now opens an editor (PATCH `/auth/me`).
- **Enrollment progress**: editable per-student progress (PATCH
  `/enrollments/:id/progress`) on the course roster tab.
- **Navigation**: «بازههای زمانی» (slots) was built but never linked — added
  to the sidebar.
- **Bug fixes**: nested `<a>` inside `<a>` in the quizzes list (invalid HTML,
  React warning); working-hours saves no longer persist `'closed'`
  placeholders; lint/type errors cleaned.
- **Production hardening**: `robots: noindex` for the private console,
  `apps/web/.env.example` documenting `NEXT_PUBLIC_API_BASE_URL` / `API_TARGET`.

**Final verification:** typecheck ✅ · eslint 0 problems ✅ · 60/60 tests ✅ ·
`next build` 26 routes ✅ · every page smoke-tested over HTTP (200) ✅ ·
route audit 0 unmatched ✅.
