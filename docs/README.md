# Workout Tracker

A mobile-first workout tracking app: daily cardio and strength logging,
body-weight/BMI tracking, an exercise library, workout templates, goals,
and progress analytics with charts.

## Stack

- **Server**: Node.js + Express + PostgreSQL, JWT auth (`server/`)
- **Client**: React 19 + Vite, built as a single self-contained HTML file
  that the server serves directly (`app/`)
- No ORM — plain SQL via `pg`, migrations are a single idempotent `schema.sql`

## Project layout

```
server/
  schema.sql          All tables (CREATE TABLE IF NOT EXISTS — safe to re-run)
  migrate.js           Applies schema.sql
  seed.js               Seeds default cardio activities + starter exercise library
  src/
    db.js                 Postgres pool + DATE type-parser fix (see comment)
    auth.js               JWT issuing/verification, requireAuth middleware
    calc.js                Unit conversions, training volume, 1RM, BMI
    helpers.js            IDs, date helpers (Monday-start week math etc.)
    starterData.js       Preloaded exercises + cardio activities
    routes/
      auth.js               register / login / profile / change-password
      exercises.js          Exercise library CRUD
      cardioActivities.js  Predefined + custom cardio activity types
      dailyLogs.js           Core: daily log, cardio sessions, strength sets
      bodyMeasurements.js  Body-weight/waist/body-fat history
      templates.js           Workout templates (save & apply a routine)
      goals.js                 Weekly/target goals
      progress.js            Dashboard + all analytics/trends/records
      exportImport.js      CSV export, JSON backup export/import
  test/pglite-server.js   Local dev database (no Postgres install needed — see below)

app/
  src/
    lib/           api client, unit conversion, date helpers (client mirrors server's calc.js)
    context/      Auth, Theme (light/dark/system), Toast notifications
    components/  Shared UI: modals, forms, charts, exercise picker
    pages/          Dashboard, LogWorkout, CalendarPage, Progress, ExerciseLibrary, Profile, Settings
```

## Local development

### 1. Install dependencies

```bash
cd server && npm install
cd ../app && npm install
```

### 2. Database — two options

**Option A — no local Postgres needed (recommended for quick start).**
This project can run against [PGlite](https://pglite.dev) (Postgres compiled
to WASM) exposed over a real Postgres wire-protocol socket, so the ordinary
`pg` client works unmodified:

```bash
# from the project root
node server/test/pglite-server.js
```

Leave that running, then point `server/.env`'s `DATABASE_URL` at it (see
`server/.env.example` — the PGlite server listens on `127.0.0.1:55433`, and
`PG_POOL_MAX=1` because PGlite's socket adapter only really serves one
connection at a time).

**Option B — a real local Postgres.** Create a database and point
`DATABASE_URL` at it instead; nothing else changes.

### 3. Apply the schema and seed starter data

```bash
cd server
npm run migrate
npm run seed
```

### 4. Run the server and client

```bash
# terminal 1
cd server && npm start        # http://localhost:4001

# terminal 2
cd app && npm run dev          # http://localhost:5173, proxies /api to :4001
```

Register an account at `http://localhost:5173` — an account only needs a
name, email, and password. Every account sees the same preloaded starter
exercises and default cardio activities (see `server/seed.js`), plus
whatever custom exercises/activities it adds.

## Environment variables (`server/.env`)

See `server/.env.example`. `JWT_SECRET` and `DATABASE_URL` are required;
everything else has a sane default for local dev.

## Key business logic

- **Training volume** = Σ(reps × weight) across *completed* sets only.
- **Estimated 1RM** uses the Epley formula: `weight × (1 + reps/30)`, and a
  multi-set exercise reports the *best* set's estimate, not the last one.
- **BMI** = weight(kg) / height(m)². Shown with a screening-metric disclaimer
  throughout the UI, per the spec.
- Weight is always stored internally in **kg** and distance in **km**,
  converted to the user's preferred unit only at the API boundary and in
  the client's display formatting (`calc.js` server-side, `lib/units.js`
  client-side — kept as parallel, independently-testable implementations).
- A day's `day_type` (workout / cardio_only / strength_only / rest) is
  auto-derived from whatever cardio sessions and strength exercises exist
  for that day, recomputed after every add/remove — explicitly marking a
  day "Rest" only sticks until an entry is added to it.
- Archiving or deleting an exercise never touches past workout records —
  every logged strength exercise keeps a `exercise_name_snapshot` /
  `muscle_group_snapshot` taken at log time.

## A timezone note worth knowing if you touch date math

Postgres `DATE` columns have no timezone, but two different libraries in
this stack default to introducing one anyway:

1. `pg`'s default DATE parser returns a JS `Date` at **local midnight**.
2. Calling `.toISOString()` on any `Date` always renders in **UTC**.

Chaining those two (`row.date.toISOString().slice(0, 10)`) silently shifts
the calendar day on any server not running at UTC+0. This app disables
step 1 entirely (`pg.types.setTypeParser(1082, v => v)` in `server/src/db.js`),
so date columns come back as plain `"YYYY-MM-DD"` strings — no Date object,
no conversion, no bug. The remaining date arithmetic (`addDaysISO`,
`startOfWeekISO` in `helpers.js` and `lib/dates.js`) does its own
UTC-anchored (server) or local-getter-based (client) math for the same
reason — never construct-then-`toISOString()` a locally-parsed date.

## Deploying

See `DEPLOY.md` for the Railway deployment flow (same pattern as this
project's sibling job-order app: one Postgres + one Express service, client
built into `server/public` and served from the same origin).
