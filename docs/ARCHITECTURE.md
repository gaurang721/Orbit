# Architecture

## Overview

```
                ┌──────────────┐      HTTPS       ┌──────────────────────────┐
   Browser ───▶ │    nginx     │ ───────────────▶ │  Next.js 15 (web)        │
                │ reverse proxy│                  │  App Router · RSC        │
                └──────┬───────┘                  └──────────────────────────┘
                       │ /api/* , /socket.io/*
                       ▼
                ┌──────────────────────────┐   Prisma    ┌──────────────┐
                │  Express API (api)        │ ──────────▶ │  PostgreSQL  │
                │  REST + Socket.io         │             └──────────────┘
                │  controller→service→repo  │   ioredis   ┌──────────────┐
                │                           │ ──────────▶ │    Redis     │
                └───────────┬───────────────┘             └──────────────┘
                            │  S3 SDK
                            ▼
                    ┌──────────────┐
                    │  S3 / MinIO  │  (media)
                    └──────────────┘
```

## Layering (backend)

Each feature lives in `apps/api/src/modules/<feature>/` and is split into four layers
so responsibilities stay isolated and testable:

| Layer          | File                    | Responsibility                                       |
| -------------- | ----------------------- | ---------------------------------------------------- |
| **Routes**     | `*.routes.ts`           | HTTP wiring: method/path, middleware, validation, Swagger |
| **Controller** | `*.controller.ts`       | Translate HTTP ⇄ domain (read req, set cookies, format response). No business logic. |
| **Service**    | `*.service.ts`          | Business logic & orchestration. Framework-agnostic.  |
| **Repository** | `*.repository.ts`       | The only place that touches Prisma. Swappable persistence. |

Cross-cutting concerns live outside modules: `middleware/` (auth, validation,
rate-limit, security, error handling), `lib/` (prisma, redis, logger, mailer, audit),
and `utils/` (jwt, crypto, totp, cookies, response envelope).

### Request lifecycle

```
requestId → helmet → cors → body parsers → cookies → compression
  → verifyOrigin (CSRF) → pino-http (logging) → rate-limit
  → route: validate(zod) → requireAuth? → controller → service → repository
  → response envelope  |  errorHandler (AppError / Zod / Prisma / JWT → JSON)
```

Every response uses a consistent envelope (`packages/types`):

```jsonc
// success
{ "success": true, "data": { /* ... */ }, "message": "optional" }
// error
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": { "email": ["A valid email is required"] } } }
```

## Shared types & validation

`packages/types` exports Zod schemas (e.g. `loginSchema`, `registerSchema`) and their
inferred TS types. **Both** the API (request validation) and the web app (react-hook-form
resolvers) import the same schemas — one source of truth, no drift between client and
server contracts.

## Authentication & token flow

- **Access token** — short-lived JWT (`15m`), sent as `Authorization: Bearer …`. Kept in
  memory on the client (never in `localStorage`).
- **Refresh token** — JWT (`7d`, or `30d` with *Remember me*), delivered as an
  **httpOnly, SameSite, path-scoped** cookie. Only a SHA-256 **hash** is stored in the
  DB (`refresh_tokens`), enabling revocation.
- **Rotation + reuse detection** — every refresh issues a new token and revokes the old
  one (`replacedById` chain). Presenting an already-revoked token nukes the whole session
  family (theft response).
- **Sessions** — each login creates a `Session` row (device, ip, rememberMe). Users can
  list and revoke sessions; password reset/change revokes others.
- **2FA** — TOTP (otplib) with a staged secret that only activates after a verified code;
  hashed single-use backup codes.

```
login ──password ok?──┐
                       ├─ 2FA off ─▶ issue session (access + refresh cookie)
                       └─ 2FA on  ─▶ challengeToken ─▶ /auth/login/2fa (code) ─▶ issue session
client 401 ─▶ api-client silently calls /auth/refresh (cookie) ─▶ retries original request
```

## Realtime (Socket.io)

`apps/api/src/socket` authenticates the WebSocket handshake with the same JWT access
token, joins each connection to a `user:<id>` room, and tracks online/last-seen presence.
`emitToUser()` is the hook later phases use to push notifications and chat. To scale
across multiple API instances, add `@socket.io/redis-adapter` (Redis is already wired).

## Data model

`prisma/schema.prisma` models all product domains (identity/auth, social graph, posts &
feed, reactions, comments, stories, messenger, notifications, groups, pages, marketplace,
events, hashtags/search, media, admin/moderation) with explicit relations, indexes on
foreign keys + hot query paths, denormalized counters for feed performance, and a single
polymorphic-via-nullable-FK `Media` table shared across owners.

## Security baseline

Helmet headers · CORS allow-list with credentials · global + strict auth rate limiting
(Redis-backed) · origin/referer CSRF check on mutations · Zod input validation ·
Prisma parameterized queries (SQL-injection safe) · React output escaping (XSS) ·
bcrypt password hashing · token hashing at rest · audit logs (`audit_logs`).
