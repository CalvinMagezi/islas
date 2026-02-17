#!/usr/bin/env bash
# Build script for @repo/convex that works both locally and on Vercel.
#
# On Vercel: convex codegen requires CONVEX_DEPLOY_KEY. If not set, we skip
# codegen and rely on the committed _generated/ files. The dist/ (agent types)
# is only needed by the HQ agent, not the web app, so it's optional on Vercel.
#
# Locally: codegen runs normally using CONVEX_DEPLOYMENT from .env.local.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PKG_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PKG_DIR"

GENERATED_DIR="convex/_generated"

# Step 1: Run convex codegen (skip if not possible)
if command -v convex &>/dev/null || npx convex --version &>/dev/null 2>&1; then
  if convex codegen 2>/dev/null; then
    echo "==> convex codegen: success"
  else
    if [ -f "$GENERATED_DIR/api.js" ] && [ -f "$GENERATED_DIR/server.js" ]; then
      echo "==> convex codegen: skipped (failed but _generated/ files exist from git)"
    else
      echo "ERROR: convex codegen failed and no _generated/ files found" >&2
      exit 1
    fi
  fi
else
  if [ -f "$GENERATED_DIR/api.js" ] && [ -f "$GENERATED_DIR/server.js" ]; then
    echo "==> convex codegen: skipped (convex CLI not available, using committed _generated/)"
  else
    echo "ERROR: convex CLI not available and no _generated/ files found" >&2
    exit 1
  fi
fi

# Step 2: Build type declarations for agent (optional on Vercel)
if [ -f "tsconfig.build.json" ]; then
  bash scripts/build-types.sh
else
  echo "==> build-types: skipped (no tsconfig.build.json)"
fi

echo "==> @repo/convex build complete"
