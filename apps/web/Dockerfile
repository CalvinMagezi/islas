# ── Stage 1: Install dependencies ────────────────────────────────────────────
FROM oven/bun:1.2 AS deps
WORKDIR /app

# Copy workspace manifests only (for layer caching)
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY apps/agent/package.json ./apps/agent/
COPY packages/convex/package.json ./packages/convex/

RUN bun install --frozen-lockfile

# ── Stage 2: Build ────────────────────────────────────────────────────────────
FROM oven/bun:1.2 AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars must be baked in at build time for client-side code
ARG NEXT_PUBLIC_CONVEX_URL
ARG NEXT_PUBLIC_ACCESS_PASSPHRASE
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY

ENV NEXT_PUBLIC_CONVEX_URL=$NEXT_PUBLIC_CONVEX_URL \
    NEXT_PUBLIC_ACCESS_PASSPHRASE=$NEXT_PUBLIC_ACCESS_PASSPHRASE \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NODE_ENV=production

WORKDIR /app/apps/web
RUN bun run build
WORKDIR /app

# ── Stage 3: Minimal runtime image ───────────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# standalone output includes a self-contained server.js
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

CMD ["node", "apps/web/server.js"]
