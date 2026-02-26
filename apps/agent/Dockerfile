FROM oven/bun:1.2-slim

# node-pty requires native compilation tools; add useful agent utilities too
RUN apt-get update && apt-get install -y \
    python3 make g++ \
    bash curl git jq ripgrep \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /agent

# Copy workspace manifests for dependency installation
COPY package.json bun.lock ./
COPY apps/agent/package.json ./apps/agent/
COPY apps/web/package.json ./apps/web/
COPY packages/convex/package.json ./packages/convex/

# Install only the agent workspace deps (skip --frozen-lockfile to avoid
# downloading full web workspace deps like next.js in the agent image)
RUN bun install --filter "islas-agent" || bun install

# Copy source code
COPY packages/convex ./packages/convex
COPY apps/agent ./apps/agent

WORKDIR /agent/apps/agent

# Volumes for persistent/hot-reloadable state
# - skills: agent can self-grow by creating new skills via skill-creator
# - islas-context.md: local memory survives restarts
# - /workspace: sandboxed working directory for agent file ops
VOLUME ["/agent/apps/agent/skills", "/workspace"]

CMD ["bun", "index.ts"]
