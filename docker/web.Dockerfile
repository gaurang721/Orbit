# =============================================================================
# Web image — Next.js 15 standalone output. Build context is the repo root.
# =============================================================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

# ---- Install dependencies ---------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/config/package.json ./packages/config/package.json
RUN npm ci

# ---- Build ------------------------------------------------------------------
FROM base AS build
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_SOCKET_URL=$NEXT_PUBLIC_SOCKET_URL \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --workspace=@fbclone/web

# ---- Runtime (standalone) ---------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# The standalone bundle mirrors the monorepo layout under /app.
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
