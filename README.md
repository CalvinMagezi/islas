# Islas

A personal AI agent orchestration hub with real-time web interface and local worker agent.

## Features

- 🤖 **Real-time AI Agent**: Chat with an intelligent agent powered by OpenRouter models
- 🌐 **Web Interface**: Modern Next.js 16 PWA with generative UI components
- 🔧 **Local Worker**: Pi SDK-powered agent that executes tasks on your machine
- 📝 **Notebooks**: Organize notes, projects, and context for your agent
- 🔍 **Vector Search**: Semantic search across your notes using OpenAI embeddings
- 🔐 **Secure**: Single-user authentication with API key management
- ⚡ **Real-time**: Serverless backend powered by Convex with instant updates

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) v1.1.0+
- Node.js 18+ (for some dependencies)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/islas.git
cd islas

# Install dependencies
bun install

# Set up the CLI and environment
./hq.sh setup

# Start development servers
bun run dev
```

### Commands

The `hq` CLI provides all the tools you need:

```bash
hq setup          # One-command global install (symlink + deps + optional daemon)
hq doctor         # Pre-flight diagnostics (deps, env vars, connectivity)
hq dev [dir]      # Start full dev stack (convex + web + agent) in foreground
hq start [dir]    # Start daemon + open log monitor + web UI
hq stop           # Stop agent daemon
hq restart [dir]  # Restart agent daemon
hq run "task"     # Dispatch a task to the agent from the CLI
hq open           # Open the web UI in browser
hq status         # Show daemon status with resource usage
hq health         # Deep health check (PID + Convex heartbeat + env validation)
hq logs [-f]      # View agent logs (-f to follow)
hq install        # Install as system service (launchd/systemd)
hq uninstall      # Remove system service
```

## Architecture

Islas is a Bun monorepo with three main components:

### 1. Web App (`apps/web`)

Next.js 16 PWA with:
- Chat interface with generative UI
- Real-time updates via Convex
- Progressive Web App features
- Notebook and search interfaces

### 2. Local Agent (`apps/agent`)

Pi SDK-powered worker that:
- Polls Convex for pending jobs
- Executes tasks with local file and shell access
- Streams logs and results back to the web UI
- Supports background, RPC, and interactive job modes

### 3. Shared Backend (`packages/convex`)

Convex serverless backend with:
- Real-time database and subscriptions
- AI agent orchestration (@convex-dev/agent)
- Background workflows (@convex-dev/workflow)
- Vector search for semantic note lookup
- Authentication and API key management

## Environment Variables

### Web App (`apps/web/.env.local`)

```bash
CONVEX_DEPLOYMENT=              # From Convex dashboard
NEXT_PUBLIC_CONVEX_URL=         # Public Convex endpoint
NEXT_PUBLIC_ACCESS_PASSPHRASE=  # Single-user passphrase (32+ chars)
```

### Agent (`apps/agent/.env.local`)

```bash
NEXT_PUBLIC_CONVEX_URL=    # Convex endpoint (same as web)
OPENROUTER_API_KEY=        # For LLM model access
ISLAS_API_KEY=             # API key for Convex HTTP actions (default: "local-master-key")
DEFAULT_MODEL=             # LLM model ID (default: "moonshotai/kimi-k2.5")
TARGET_DIR=                # Agent working directory (default: CWD)
```

### Convex Backend (Set in Convex dashboard)

```bash
OPENROUTER_API_KEY=        # For AI model access via OpenRouter
DEFAULT_MODEL=             # e.g., "anthropic/claude-sonnet-4-5"
```

## Development

```bash
# Start all services
bun run dev

# Individual services
bun run web      # Dev mode for web app only
bun run agent    # Start local worker agent

# Building & linting
bun run build    # Workspace-wide production build
bun run lint     # Lint all packages
bun run check    # Lint + build all packages
```

## Deployment

### Web App (Vercel)

```bash
# Deploy via Vercel CLI
vercel

# Or connect your GitHub repo to Vercel for automatic deployments
```

### Backend (Convex)

```bash
cd packages/convex
npx convex deploy
```

### Agent (Local Only)

The agent runs on your local machine. Install it as a system service:

```bash
hq install    # Installs as launchd (macOS) or systemd (Linux) service
hq status     # Check if it's running
```

## Security

- **Single-user mode**: Simplified passphrase-based authentication
- **API key management**: SHA-256 hashed keys with rate limiting
- **Security profiles**: Configurable tool permissions for the local agent
- **Audit logging**: All agent actions are logged

## Tech Stack

- **Frontend**: React 19, Next.js 16, Tailwind CSS v4, shadcn/ui
- **Backend**: Convex serverless, @convex-dev/agent, @convex-dev/auth
- **Agent**: Pi SDK, TypeScript, Node.js
- **AI**: OpenRouter API, OpenAI embeddings
- **Monorepo**: Turborepo, Bun workspaces

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT

## Support

For issues and questions, please [open an issue](https://github.com/yourusername/islas/issues) on GitHub.
