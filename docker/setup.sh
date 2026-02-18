#!/bin/bash
# Islas VPS First-Run Setup Script
# Run from the repo root: ./docker/setup.sh
set -euo pipefail

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${BLUE}[islas]${NC} $1"; }
ok()   { echo -e "${GREEN}[ok]${NC} $1"; }
warn() { echo -e "${YELLOW}[warn]${NC} $1"; }
err()  { echo -e "${RED}[error]${NC} $1"; exit 1; }

# ── Pre-flight checks ─────────────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || err "docker not found. Install Docker first."
command -v docker compose >/dev/null 2>&1 || err "'docker compose' not found. Docker Compose v2 required."

[ -f ".env" ] || { warn ".env not found. Copying from docker/.env.example ..."; cp docker/.env.example .env; }

source .env

[ -z "${DOMAIN:-}" ]             && err "DOMAIN is not set in .env"
[ -z "${ACCESS_PASSPHRASE:-}" ]  && err "ACCESS_PASSPHRASE is not set in .env"
[ -z "${OPENROUTER_API_KEY:-}" ] && err "OPENROUTER_API_KEY is not set in .env"

log "Starting Islas setup for domain: $DOMAIN"

# ── Step 1: Start Convex backend only ─────────────────────────────────────────
log "Starting Convex backend..."
docker compose up -d convex
log "Waiting for Convex to initialise..."
sleep 8

# ── Step 2: Generate admin key (if not already set) ───────────────────────────
if [ -z "${CONVEX_ADMIN_KEY:-}" ]; then
    log "Generating Convex admin key..."
    CONVEX_ADMIN_KEY=$(docker compose exec -T convex ./generate_admin_key.sh 2>/dev/null | tail -1)
    if [ -z "$CONVEX_ADMIN_KEY" ]; then
        err "Failed to generate admin key. Is the Convex container healthy?"
    fi
    # Persist to .env
    if grep -q "^CONVEX_ADMIN_KEY=" .env; then
        sed -i "s|^CONVEX_ADMIN_KEY=.*|CONVEX_ADMIN_KEY=$CONVEX_ADMIN_KEY|" .env
    else
        echo "CONVEX_ADMIN_KEY=$CONVEX_ADMIN_KEY" >> .env
    fi
    ok "Admin key saved to .env"
else
    ok "Using existing CONVEX_ADMIN_KEY from .env"
fi

# ── Step 3: Deploy Convex schema and functions ────────────────────────────────
log "Deploying Convex schema and functions..."
docker compose run --rm convex-deploy
ok "Convex schema deployed"

# ── Step 4: Remind about Convex env vars ─────────────────────────────────────
echo ""
warn "Set the following environment variables in the Convex dashboard:"
warn "  https://dash.$DOMAIN"
echo "  OPENROUTER_API_KEY  = $OPENROUTER_API_KEY"
echo "  DEFAULT_MODEL       = ${DEFAULT_MODEL:-moonshotai/kimi-k2.5}"
echo "  ISLAS_API_KEY       = ${ISLAS_API_KEY:-local-master-key}"
echo "  WORKER_SECRET       = ${WORKER_SECRET:-}"
echo "  VAPID_PUBLIC_KEY    = ${VAPID_PUBLIC_KEY:-}"
echo "  VAPID_PRIVATE_KEY   = ${VAPID_PRIVATE_KEY:-}"
echo ""

# ── Step 5: Start all services ────────────────────────────────────────────────
log "Starting all services..."
docker compose up -d

ok "All services started!"
echo ""
echo "  Web app:    https://$DOMAIN"
echo "  Convex API: https://api.$DOMAIN"
echo "  Dashboard:  https://dash.$DOMAIN"
echo ""
log "Run 'docker compose logs -f' to tail logs."
