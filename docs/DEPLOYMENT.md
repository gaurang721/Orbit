# Deployment

## Environment variables

All variables are documented in [`.env.example`](../.env.example). The API **fails fast**
on boot if required values are missing or malformed (validated with Zod in
`apps/api/src/config/env.ts`). The critical ones:

| Variable                       | Notes                                                            |
| ------------------------------ | ---------------------------------------------------------------- |
| `DATABASE_URL`                 | Postgres connection string                                       |
| `REDIS_URL`                    | Redis connection string                                          |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | ≥16 chars; generate with `openssl rand -base64 48`    |
| `COOKIE_SECRET`                | Signs cookies                                                    |
| `COOKIE_SECURE`                | Defaults to `true` in production; **requires HTTPS**             |
| `CORS_ORIGINS`                 | Comma-separated allow-list of web origins                        |
| `SMTP_*` / `EMAIL_FROM`        | Mail delivery (omit `SMTP_HOST` in dev to log emails instead)    |
| `S3_*`                         | Object storage for media                                         |
| `NEXT_PUBLIC_API_URL`          | Browser-reachable API origin (build-time for the web app)        |

## Production checklist

- [ ] Strong, unique `JWT_*` and `COOKIE_SECRET` values (store in a secret manager).
- [ ] Serve over **HTTPS**; keep `COOKIE_SECURE=true` so refresh cookies transmit.
- [ ] Set `CORS_ORIGINS` to your real web origin(s) only.
- [ ] Configure real SMTP credentials.
- [ ] Point `S3_*` at a real bucket (AWS S3 / Cloudflare R2) and lock down its policy.
- [ ] Run database migrations as a release step (not in-process for multi-replica).
- [ ] Set up backups for Postgres and persistence for Redis.
- [ ] Put a WAF / TLS terminator (or managed LB) in front of nginx.

## Database migrations

```bash
# create a migration during development
npm run prisma:migrate -- --name <change>

# apply migrations in CI / production
npm run prisma:deploy
```

An initial migration (`prisma/migrations/0_init`) is included. The API Docker image runs
`prisma migrate deploy` on container start; for multi-replica deployments, run migrations
once as a dedicated job/init container instead, and remove the migrate step from the
runtime command.

## Docker

```bash
# build + run the full stack (postgres, redis, minio, api, web, nginx)
npm run docker:up
# tear down
npm run docker:down
```

- `docker/api.Dockerfile` — multi-stage: install → `prisma generate` + `tsup` bundle →
  slim runtime that runs the ESM bundle.
- `docker/web.Dockerfile` — multi-stage producing Next.js **standalone** output.
- `docker/nginx/` — reverse proxy: `/` → web, `/api/` → api, `/socket.io/` → api
  (with WebSocket upgrade).

> For local HTTP testing the compose file sets `COOKIE_SECURE=false`. In production put
> TLS in front and set it back to `true`.

## Scaling

- **API** is stateless — run N replicas behind the load balancer. Sessions/refresh tokens
  live in Postgres; rate-limit counters and cache live in Redis (shared).
- **Socket.io** across replicas: add `@socket.io/redis-adapter` (Redis already present)
  so realtime events fan out to all instances.
- **Postgres**: use a managed instance with read replicas for feed-heavy phases; the
  schema already indexes hot paths and denormalizes engagement counters.
- **Media**: served directly from S3/CDN, not through the API.

## Observability

- Structured JSON logs via **pino** (pretty in dev). Each request carries an
  `x-request-id` for correlation.
- `audit_logs` records security-relevant actions (login, password change, 2FA, session
  revocation, …) with actor, ip, and user-agent.
- Health probe: `GET /api/v1/health`.
