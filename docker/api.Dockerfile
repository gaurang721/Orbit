# =============================================================================
# API image — multi-stage build for the npm-workspaces monorepo.
# Build context is the repo root.
# =============================================================================
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ---- Install dependencies (cached on lockfile + manifests) ------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY prisma ./prisma
RUN npm ci

# ---- Build (generate Prisma client + bundle API with tsup) ------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate --schema prisma/schema.prisma
RUN npm run build --workspace=@fbclone/api

# ---- Runtime ----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
# node_modules carries the generated Prisma client; apps/api/package.json sets
# "type": "module" so Node runs the ESM bundle correctly.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json

EXPOSE 4000
# Apply pending migrations, then start. (Use a job/init container in k8s instead.)
CMD ["sh", "-c", "npx prisma migrate deploy --schema prisma/schema.prisma && node apps/api/dist/index.js"]
