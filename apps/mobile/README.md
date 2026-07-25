# Institutes — Flutter client

Map-first marketplace client for students: discover institutes on a full-screen
map, pre-register online, and take exams that survive losing connection.

## Running it

```bash
cd apps/mobile
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
```

`10.0.2.2` is how the Android emulator reaches your host machine. Use the value
that matches your target:

| Target            | `API_BASE_URL`                        |
| ----------------- | ------------------------------------- |
| Android emulator  | `http://10.0.2.2:4000/api/v1`         |
| iOS simulator     | `http://localhost:4000/api/v1`        |
| Physical device   | `http://<your-lan-ip>:4000/api/v1`    |

Other overrides: `REALTIME_URL`, `TILE_URL`.

Signing in locally needs no SMS gateway — the API returns the OTP in the
response outside production and the login screen prefills it.

## Tests

```bash
flutter test
```

The suites cover the two pieces of pure logic where a bug would be silent:
form validation (which must agree with the server byte-for-byte) and map
clustering.

## Structure

```
lib/
├── app/router.dart            # go_router, auth redirects
├── blocs/                     # auth, discovery, quiz
├── core/
│   ├── config/                # --dart-define configuration
│   ├── map/                   # grid clustering, haversine
│   ├── network/               # Dio client, token refresh, error mapping
│   ├── storage/               # secure token storage
│   ├── theme/                 # Material 3 theme
│   └── validation/            # Dart port of the shared validator
├── data/
│   ├── local/quiz_cache.dart  # Hive offline exam state + outbox
│   ├── models/                # hand-written JSON, no codegen
│   └── repositories/          # one per API area
└── ui/
    ├── screens/               # map, institute, registration, quiz, home
    └── widgets/               # shared components
```

## Notes on a few decisions

**No code generation.** No `build_runner`, no `.g.dart`. Models parse JSON by
hand and Hive stores JSON strings. This removes the most common reason a fresh
checkout fails to build.

**Validation lives in two places on purpose.** `core/validation/form_validator.dart`
is a direct port of `packages/shared/src/validation.ts`. The client uses it for
instant feedback; the server re-runs the identical rules before persisting. If
you change one, change the other — `test/form_validator_test.dart` pins the
behaviour.

**Exam timing is never trusted to the client.** The countdown is derived from
the server's `expiresAt`, and a server-side cron force-submits overdue attempts.
Backgrounding the app, changing the device clock, or killing the process cannot
buy extra time.

**Offline exams.** Every answer is written to Hive immediately and queued in an
outbox. A timer flushes the queue whenever the device is online; on reconnect
the queue replays and the server rejects anything older than what it holds
(last-write-wins on `clientUpdatedAt`).

## Not yet wired

- `FILE_UPLOAD` quiz answers show a pointer message rather than opening the
  picker; the presigned-upload plumbing exists in `UploadRepository` and needs
  connecting in `quiz_screen.dart`.
- Socket.IO realtime (`REALTIME_URL`) is configured but the client is not built;
  the backend gateway is ready.
- The institute-staff dashboard is web-only for now (`apps/web`).
