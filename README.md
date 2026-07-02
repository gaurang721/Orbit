# fbclone

A production-grade, **Facebook-inspired social platform** built as a TypeScript monorepo.

> **Scope & status.** A true Facebook-scale clone is months of work for a team. This
> repository is built **in phases** so each domain ships as real, tested, reviewable code
> rather than one giant unusable dump. **Phase 1 — the full Authentication system — is
> complete and verified.** The database schema and infrastructure for *all* later phases
> are already in place. See the [roadmap](#-roadmap) below.

---

## 🧱 Tech stack

| Layer        | Choice                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn-style UI, TanStack Query, Zustand, Socket.io client |
| **Backend**  | Node.js, Express, TypeScript, Socket.io, JWT auth, REST                   |
| **Database** | PostgreSQL + Prisma ORM                                                    |
| **Cache/RT** | Redis (cache, rate-limit store, session/presence)                         |
| **Storage**  | S3-compatible object storage (MinIO locally; AWS S3/R2 in prod)           |
| **Infra**    | Docker, Docker Compose, Nginx reverse proxy, GitHub Actions CI            |

Architecture follows **clean architecture** with explicit **controller → service →
repository** layers, shared types/validation in a `packages/types` workspace, and a
strict security baseline (Helmet, CORS, rate limiting, CSRF/origin checks, audit logs).

## 📂 Monorepo layout

```
.
├─ apps/
│  ├─ api/                 # Express REST + Socket.io (clean architecture)
│  │  └─ src/
│  │     ├─ config/        # env validation (zod)
│  │     ├─ lib/           # prisma, redis, logger, mailer, audit
│  │     ├─ middleware/    # auth, validation, rate-limit, security, errors
│  │     ├─ modules/       # feature modules (auth/ … more per phase)
│  │     │  └─ auth/       # controller · service · repository · routes · validation
│  │     ├─ socket/        # realtime layer (JWT handshake, presence)
│  │     ├─ docs/          # Swagger / OpenAPI
│  │     └─ utils/         # jwt, crypto, totp, cookies, http-error, response
│  └─ web/                 # Next.js 15 App Router
│     └─ src/
│        ├─ app/           # routes (auth pages, dashboard, settings)
│        ├─ components/    # ui primitives, providers, guards
│        ├─ hooks/         # React Query hooks
│        ├─ lib/           # API client (auto token-refresh)
│        └─ stores/        # Zustand auth store
├─ packages/
│  ├─ types/               # shared DTOs + zod schemas (used by api AND web)
│  ├─ ui/                  # shared UI helpers (cn)
│  └─ config/              # shared tsconfig / eslint presets
├─ prisma/                 # schema (all domains), migrations, seed
├─ docker/                 # compose, Dockerfiles, nginx
├─ docs/                   # architecture, deployment, API
└─ .github/workflows/      # CI/CD
```

## ✅ Prerequisites

- **Node.js ≥ 20** and npm 10+
- **PostgreSQL** and **Redis** — either installed locally, or via the provided Docker Compose

## 🚀 Quick start (local dev)

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env        # then edit secrets / DB connection

# 3. Start Postgres + Redis (if you don't have them running)
docker compose -f docker/docker-compose.yml up -d postgres redis

# 4. Apply the schema and seed demo data
npm run prisma:deploy       # or: npm run prisma:migrate  (dev)
npm run prisma:seed

# 5. Run both apps (turbo, parallel)
npm run dev
#   API → http://localhost:4000   (Swagger at /api/docs)
#   Web → http://localhost:3000
```

Seeded logins (password **`Password123`**): `ada@fbclone.local`, `alan@fbclone.local`,
`grace@fbclone.local`, `admin@fbclone.local`, …

> **Dev email:** with no `SMTP_HOST` set, verification/reset emails are **printed to the
> API logs** (look for `📧 [dev] email`) so you can grab the link without a mail server.

## 🐳 Run the whole stack with Docker

```bash
cp .env.example .env        # set JWT_*/COOKIE_* secrets
npm run docker:up           # postgres, redis, minio, api, web, nginx
# open http://localhost     (nginx proxies web + /api + /socket.io)
```

The API container runs `prisma migrate deploy` on boot. See
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for production notes (TLS, secrets, scaling).

## 📜 Scripts (root)

| Script                    | Description                                  |
| ------------------------- | -------------------------------------------- |
| `npm run dev`             | Run api + web in parallel (turbo)            |
| `npm run build`           | Build all workspaces                         |
| `npm run typecheck`       | Type-check all workspaces                    |
| `npm run test`            | Run tests (Vitest)                           |
| `npm run prisma:migrate`  | Create/apply a dev migration                 |
| `npm run prisma:deploy`   | Apply migrations (CI/prod)                   |
| `npm run prisma:seed`     | Seed demo data                               |
| `npm run prisma:studio`   | Open Prisma Studio                           |
| `npm run docker:up/down`  | Start/stop the full Docker stack             |

## 🔐 Phase 1 — Authentication (done)

Register · Login · Logout · Logout-all · **JWT access + rotating refresh tokens** ·
Email verification · Forgot/Reset password · Change password · **TOTP 2FA** (with backup
codes) · **Session management** (list/revoke devices) · **Remember me** · refresh-token
**reuse detection** · rate limiting · audit logging.

REST endpoints (all under `/api/v1`, documented in Swagger at `/api/docs`):

```
POST   /auth/register             POST   /auth/login            POST /auth/login/2fa
POST   /auth/refresh              POST   /auth/logout           POST /auth/logout-all
GET    /auth/me                   POST   /auth/change-password
POST   /auth/verify-email         POST   /auth/resend-verification
POST   /auth/forgot-password      POST   /auth/reset-password
POST   /auth/2fa/setup            POST   /auth/2fa/enable       POST /auth/2fa/disable
GET    /auth/sessions             DELETE /auth/sessions/:id
```

See [docs/API.md](docs/API.md) for request/response examples.

## 🧪 Testing

```bash
npm run test                 # unit tests (no DB required)
npm run test --workspace=@fbclone/api -- --watch
```

The CI pipeline (`.github/workflows/ci.yml`) spins up Postgres + Redis, generates the
Prisma client, applies migrations, then runs typecheck → test → build, and builds the
Docker images on `main`.

## 🗺️ Roadmap

The Prisma schema already models **every** domain below; each phase wires up its module
(routes/service/repository) + UI:

1. ✅ **Authentication** — *complete*
2. ⬜ Profiles (about, education, work, skills, privacy, featured photos)
3. ⬜ Posts & News Feed (privacy, polls, scheduling, ranking, infinite scroll)
4. ⬜ Comments & Reactions (nested, 7 reactions, mentions, real-time)
5. ⬜ Messenger (1:1 + group, voice/file, typing, read receipts, presence)
6. ⬜ Notifications (real-time center)
7. ⬜ Stories (24h expiry, viewers, reactions)
8. ⬜ Groups & Pages
9. ⬜ Marketplace & Events
10. ⬜ Admin Panel (moderation, reports, analytics)

## 📄 License

MIT — a learning project.
