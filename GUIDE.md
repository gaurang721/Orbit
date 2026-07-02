# fbclone — Developer Guide

A complete, accurate guide to running, developing, and navigating **fbclone** — a
production-grade, Facebook-inspired social platform built as a TypeScript monorepo.

> **Status:** All major domains are built and verified — auth, profiles, feed, posts,
> comments, 7 reactions, friends/follow, real-time notifications, Messenger (1:1 chat with
> voice notes + forward + read receipts), Stories, Groups, Pages, Marketplace, Events,
> global search, Watch/video, Saved, Memories, a playable Gaming arcade, and an Admin
> panel. (The top-level `README.md` is older and only describes Phase 1 — trust this file.)

---

## 1. Tech stack

| Layer        | Choice |
| ------------ | ------ |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind, TanStack Query, Zustand, Socket.io client |
| **Backend**  | Node.js, Express, TypeScript, Socket.io, JWT auth, REST |
| **Database** | PostgreSQL + Prisma ORM |
| **Cache/RT** | Redis (optional in dev — can be disabled) |
| **Storage**  | Local disk in dev (`apps/web/public/`), S3-swappable for prod |
| **Build**    | Turborepo, npm workspaces |

Backend follows clean architecture: **controller → service → repository**, with shared
DTOs + zod schemas in `packages/types` consumed by *both* the API and the web app.

## 2. Prerequisites

- **Node.js ≥ 20** (developed on **24.14.1**) and **npm ≥ 10** (using **11.11.0**)
- A **PostgreSQL** server. You have two options:
  - **No Docker (recommended on this Windows machine):** an embedded Postgres via
    `scripts/dev-db.mjs` — no install required.
  - **Docker:** the provided `docker/docker-compose.yml`.
- Redis is **optional** — set `REDIS_ENABLED=false` to use in-memory rate limiting.

## 3. Running locally — the no-Docker way (verified on this machine)

This is the path that currently works here. Run each step in its own terminal.

```bash
# 0. Install dependencies (once, from repo root) — installs all workspaces
npm install

# 1. Start PostgreSQL (embedded, no Docker) on :5432, data in ./.pgdata
node scripts/dev-db.mjs            # leave running; Ctrl+C to stop

# 2. Apply schema + generate client + seed demo data (first run only)
npm run prisma:generate
npm run prisma:deploy              # or prisma:migrate in dev
npm run prisma:seed                # idempotent; SEED_RESET=1 forces a fresh seed

# 3. Start the API on :4000
cd apps/api && npx tsx src/index.ts

# 4. Start the web app on :3000
cd apps/web && npx next dev
```

Then open **http://localhost:3000** and log in.

> The `.env` file lives at the **repo root** and is loaded by the API regardless of the
> current working directory. `CORS_ORIGINS` allows both `:3000` and `:3001`, so if Next.js
> falls back to `:3001` (port 3000 busy), it still works.

### Or: run both apps together with Turbo

If you have Postgres + Redis available, the original quick path is:

```bash
npm run dev        # turbo runs api + web in parallel
```

### Or: full Docker stack

```bash
cp .env.example .env       # set JWT_*/COOKIE_* secrets
npm run docker:up          # postgres, redis, minio, api, web, nginx
# open http://localhost    (nginx proxies web + /api + /socket.io)
npm run docker:down        # stop
```

## 4. URLs & ports

| Service        | URL                                   |
| -------------- | ------------------------------------- |
| Web (Next.js)  | http://localhost:3000                 |
| API (REST)     | http://localhost:4000/api/v1          |
| Health check   | http://localhost:4000/api/v1/health   |
| Swagger / OpenAPI | http://localhost:4000/api/docs     |
| Socket.io      | ws://localhost:4000                   |
| PostgreSQL     | localhost:5432 (db `fbclone`, user `fbclone`) |

## 5. Seeded logins

All seeded users share the password **`Password123`**. Log in with the **username** or the
**email** (the login field is `identifier`, accepting either).

| Username     | Email                   | Role        |
| ------------ | ----------------------- | ----------- |
| `superadmin` | `admin@fbclone.local`   | SUPER_ADMIN |
| `grace`      | `grace@fbclone.local`   | MODERATOR   |
| `ada`        | `ada@fbclone.local`     | USER        |
| `alan`       | `alan@fbclone.local`    | USER        |

…plus `linus`, `margaret`, `katherine`, `dennis`, `tim`, `hedy`, `woz`, `radia` (13 total).
Seed data includes posts with reactions/comments, stories, groups, pages, marketplace
products, events, conversations, and notifications.

> **Dev email:** with no `SMTP_HOST` set, verification/reset emails are **printed to the
> API logs** — look for `📧 [dev] email` to grab the link without a mail server.

## 6. Feature tour (web routes)

| Route                | What it is |
| -------------------- | ---------- |
| `/` (home)           | News feed + composer, left/right sidebars, stories bar |
| `/(auth)/login` etc. | Login, register, forgot/reset password, verify email |
| `/u/[username]`      | User profile (posts, about, cover) |
| `/friends`           | Friends / follow requests |
| `/messages`          | Messenger — 1:1 realtime chat, voice notes, forward, read receipts |
| `/stories`           | Stories bar + full-screen viewer (24h expiry) |
| `/watch`             | Video feed + reusable fullscreen video player |
| `/groups`            | Create / list / join / leave groups |
| `/pages`             | Create / list / follow pages |
| `/marketplace` `/marketplace/[id]` | Listings, categories, search, message seller |
| `/events`            | Create / list / RSVP events |
| `/search`            | Global search across people/posts/groups/pages/marketplace |
| `/saved`             | Saved posts + saved marketplace items |
| `/memories`          | Your own past posts |
| `/menu`              | Shortcut grid to all sections |
| `/gaming`            | Playable arcade — 2048, Snake, Memory Match, Tic-Tac-Toe, Connect Four, Minesweeper, Simon, Whack-a-Mole, Word Guess (9 games) |
| `/post/[id]`         | Single-post permalink |
| `/settings/security` | Sessions, 2FA, password |
| `/admin`             | Admin dashboard (stats, reports, user management) — role-gated |

## 7. Project structure

```
apps/
  api/   Express REST + Socket.io
    src/
      config/      env validation (zod)
      lib/         prisma, redis, logger, mailer, audit
      middleware/  auth, validation, rate-limit, security, errors
      modules/     feature modules (see below) — each: controller·service·repository·routes·validation
      socket/      realtime layer (JWT handshake, presence)
      docs/        Swagger / OpenAPI
      utils/       jwt, crypto, totp, cookies, http-error, response
  web/   Next.js 15 App Router (app/, components/, hooks/, lib/, stores/)
packages/
  types/   shared DTOs + zod schemas (used by API AND web)
  ui/      shared UI helpers
  config/  shared tsconfig / eslint presets
prisma/    schema (all domains), migrations, seed
scripts/   dev-db.mjs (embedded postgres), recreate-db-utf8.mjs
docker/    compose, Dockerfiles, nginx
docs/      API.md, ARCHITECTURE.md, DEPLOYMENT.md
```

**API modules** (`apps/api/src/modules/`): `auth`, `users`, `posts`, `friends`,
`notifications`, `chat`, `stories`, `groups`, `pages`, `market`, `events`, `search`,
`admin`. Each is mounted under `/api/v1/<module>` in `apps/api/src/routes/index.ts`.

## 8. API reference

All routes live under `/api/v1`. Interactive docs: **http://localhost:4000/api/docs**.

Quick login example:

```bash
# Login (note: the field is "identifier", not "email")
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H "Content-Type: application/json" -H "Origin: http://localhost:3000" \
  -d '{"identifier":"ada@fbclone.local","password":"Password123"}'

# Use the returned accessToken as a Bearer token
curl http://localhost:4000/api/v1/auth/me -H "Authorization: Bearer <token>"
curl "http://localhost:4000/api/v1/posts/feed?limit=10" -H "Authorization: Bearer <token>"
```

See [docs/API.md](docs/API.md) for more examples and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
for the layering rationale.

## 9. Common commands

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Run api + web in parallel (turbo) |
| `npm run build` | Build all workspaces |
| `npm run typecheck` | Type-check all workspaces |
| `npm run test` | Run unit tests (Vitest, no DB needed) |
| `npm run prisma:generate` | Generate the Prisma client |
| `npm run prisma:migrate` | Create/apply a dev migration |
| `npm run prisma:deploy` | Apply migrations (CI/prod) |
| `npm run prisma:seed` | Seed demo data (idempotent) |
| `npm run prisma:studio` | Open Prisma Studio (browse the DB) |
| `npm run docker:up` / `down` | Start/stop the full Docker stack |
| `node scripts/dev-db.mjs` | Start embedded Postgres (no Docker) |

## 10. Verify without a live database

Typecheck, test, and build all work without a running DB:

```bash
# Prisma client is needed for the api typecheck — generate with a dummy URL
DATABASE_URL="postgresql://u:p@localhost:5432/db?schema=public" \
  npx prisma generate --schema prisma/schema.prisma

# Per-workspace typecheck (more reliable than turbo on Windows)
cd apps/api  && npx tsc --noEmit
cd apps/web  && npx tsc --noEmit
cd packages/types && npx tsc --noEmit

# API unit tests + builds
cd apps/api && npx vitest run
cd apps/api && npx tsup
cd apps/web && NEXT_TELEMETRY_DISABLED=1 npx next build
```

## 11. Troubleshooting

- **Port already in use (3000/4000):** Next.js auto-falls back to `:3001` (allowed by
  CORS). For the API, free the port first:
  `Get-NetTCPConnection -LocalPort 4000 -State Listen | %{ Stop-Process -Id $_.OwningProcess -Force }`
- **Transient `401` then it works:** the access token expired and the web client
  auto-refreshed it. Expected; no action needed.
- **Emojis fail to store (Postgres error `22P05`):** the embedded DB was created as
  WIN1252 instead of UTF8. Stop the API and run `node scripts/recreate-db-utf8.mjs`, then
  re-migrate and re-seed. Fresh clusters from `dev-db.mjs` are already UTF8.
- **Embedded Postgres won't start (missing VC++ DLLs):** the Windows build needs runtime
  DLLs copied into `node_modules/@embedded-postgres/windows-x64/native/bin`.
- **Avatars/cover images blank:** seed data references `i.pravatar.cc` and `picsum.photos`,
  which need internet in the browser. The app itself works fully offline.
- **SSR 500 on pages using `SectionShell`:** don't read `useAuthStore(s=>s.user)!.x` in the
  page component that builds children — the JSX is evaluated before `AuthGuard` gates it
  and `user` is null during SSR. Put user-accessing JSX in a child component (see `/menu`,
  `/memories`).

## 12. Environment variables

The root `.env` is the single source of truth (loaded by the API at any cwd). Key groups:

- **App:** `NODE_ENV`, `WEB_URL`, `API_URL`, `API_PORT`, `CORS_ORIGINS`
- **Database:** `DATABASE_URL` (+ `POSTGRES_*`)
- **Redis:** `REDIS_ENABLED` (set `false` in dev), `REDIS_URL`/`REDIS_*`
- **Auth:** `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_*_EXPIRES_IN`, `COOKIE_SECRET`
- **Mail:** `SMTP_*`, `EMAIL_FROM` (omit `SMTP_HOST` in dev to log emails)
- **Web (public):** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NEXT_PUBLIC_WEB_URL`

> In **production** (`NODE_ENV=production`), `config/env.ts` rejects placeholder/weak
> secrets (`change_me*`, anything < 32 chars, or access == refresh). Dev stays permissive.

---

*See also: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/API.md](docs/API.md),
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).*
