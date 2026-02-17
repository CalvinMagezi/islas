# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Islas** is a Bun monorepo implementing a generative UI agent hub with a local worker agent. The system features:
- **Web App**: Next.js 16 PWA with real-time chat and generative UI
- **Islas Agent**: Local Node.js worker (Pi SDK) that executes jobs from the web UI
- **Shared Backend**: Convex serverless backend with @convex-dev/agent and @convex-dev/workflow components

Package manager: **Bun** (v1.1.0+)

## Monorepo Structure

```
.
├── apps/
│   ├── web/              # Next.js 16 PWA (frontend)
│   └── agent/            # Local worker agent ("islas-agent", Pi SDK)
├── packages/
│   └── convex/           # Shared Convex backend (@repo/convex)
├── turbo.json            # Turborepo pipeline config
└── vercel.json           # Vercel deployment (web app only)
```

## Development Commands

**All commands run from the monorepo root unless specified otherwise.**

```bash
# Development (all services)
bun run dev          # Starts web + agent + convex via Turbo (persistent tasks)

# Individual services
bun run web          # Dev mode for web app only
bun run agent        # Start local worker agent

# Building & linting
bun run build        # Workspace-wide production build
bun run lint         # Lint all packages
bun run check        # Lint + build all packages

# Package-specific
bun --cwd apps/web dev              # Run web app directly
bun --cwd apps/agent start          # Run agent directly
bun --cwd packages/convex dev       # Run convex dev server (auto-codegen)
```

**IMPORTANT**: `convex/_generated/` is auto-generated. Never edit manually.

## Architecture

### 1. Frontend (Next.js App Router)
**Location**: `apps/web/`

- **Routes**: `app/page.tsx` (main chat), `app/notebooks/`, `app/search/`, `app/signin/`
- **Components by feature**:
  - `components/ui/` — shadcn/ui primitives
  - `components/chat/` — Chat interface and message rendering
  - `components/tools/` — Generative UI tool components (rendered from agent tool calls)
  - `components/notifications/` — Notification system with web push
- **Hooks**: `hooks/use-chat-action.ts`, `hooks/use-thread.ts` for chat state
- **PWA**: Service worker in `worker/` bundled via `@ducanh2912/next-pwa` (`customWorkerSrc: "worker"`)
- **Path Alias**: `@/*` maps to `apps/web/` root

### 2. Shared Backend (Convex)
**Location**: `packages/convex/`

Exported as `@repo/convex` workspace package. Both web app and agent import from this.

**Directory Layout**:
```
packages/convex/convex/
├── schema.ts              # Database schema (see Schema section)
├── convex.config.ts       # Component registration
├── auth.config.ts         # Auth provider config (uses CONVEX_SITE_URL)
├── http.ts                # HTTP actions (MCP server, webhooks, API endpoints)
├── agents/
│   └── orchestrator.ts    # Main AI agent definition (tools, instructions, model)
├── tools/
│   ├── uiTools.ts         # Generative UI rendering (showDashboard, showNote, etc.)
│   ├── actionTools.ts     # Data mutations (storeMemory, createProject, etc.)
│   ├── ragTools.ts        # Search & context (searchNotes, searchWeb, loadContext)
│   └── index.ts           # Tool barrel export
├── functions/             # Convex query/mutation/action functions
│   ├── internal.ts        # Internal utilities (large, core logic)
│   ├── notebooks.ts       # Notebook CRUD
│   ├── notifications.ts   # Notification management
│   ├── apiKeys.ts         # API key management
│   ├── settings.ts        # User settings
│   ├── users.ts           # User management
│   ├── usage.ts           # Token/cost tracking
│   └── system.ts          # System operations (agent context, health)
├── chat/                  # Chat-specific helpers
│   ├── getPinnedNotes.ts  # Load pinned notes for agent context
│   ├── searchWeb.ts       # Web search (Brave)
│   └── searchNotes.ts     # Note search (text + vector)
└── lib/                   # Shared utilities
    ├── mcpTools.ts        # MCP server implementation (large, JSON-RPC 2.0)
    ├── braveSearch.ts     # Brave Search API wrapper
    ├── searchParser.ts    # Search query parsing
    ├── models.ts          # LLM model config (OpenRouter)
    ├── pricing.ts         # Token cost calculations
    ├── auth.ts            # Auth helpers
    └── cors.ts            # CORS headers
```

**Component System** (registered in `convex.config.ts`):
- `components.agent` — @convex-dev/agent for AI SDK integration
- `components.workflow` — @convex-dev/workflow for background jobs

**Export Pattern** in `packages/convex/index.ts`:
```typescript
export * from "./convex/_generated/api";
export * from "./convex/_generated/server";
export type * from "./convex/_generated/dataModel";
```

### 3. Local Worker Agent (Islas Agent)
**Location**: `apps/agent/`

A polling worker that picks up jobs from Convex and executes them locally using the Pi SDK.

**Core Architecture**:
- Polls `api.agent.getPendingJob` every 5 seconds
- Executes jobs with Pi SDK tools: `BashTool`, `FileTool`, `LocalContextTool`, `MCPBridgeTool`
- Streams logs to Convex via `api.agent.addJobLog`
- Updates job status: `pending` → `running` → `done`/`failed`

**Key Files**:
- `index.ts` — Main entry point, polling loop, tool registration
- `governance.ts` — Security profiles (`MINIMAL`, `STANDARD`, `ADMIN`) and `ToolGuardian` class
- `skills.ts` — Skill loading infrastructure (`LoadSkillTool`, `ListSkillsTool`, `SkillLoader`)
- `session-utils.ts` — Session recovery utilities

**Worker Identity**:
- Worker ID: `apps/agent/.islas-worker-id`
- Local Memory: `apps/agent/islas-context.md`
- Sessions: `apps/agent/.islas-sessions/`

#### Agent Skills System

Skills are modular capabilities loaded at runtime from `apps/agent/skills/{name}/`:
```
skills/
├── pdf/           # PDF processing
├── docx/          # Word document processing
├── pptx/          # PowerPoint processing
├── xlsx/          # Excel processing
├── frontend-design/  # Frontend code generation
├── mcp-builder/   # MCP server builder
├── skill-creator/ # Meta-skill for creating new skills
└── find-skills/   # Discover available skills
```

Each skill has a `SKILL.md` with YAML frontmatter (name, description, license). The agent's `load_skill` tool dynamically loads skills by name.

#### Agent Job Types

Three job modes supported:
1. **`background`** — Fire and forget (default)
2. **`rpc`** — Return a value via `submit_result` tool
3. **`interactive`** — Multi-turn conversation with user via `chat_with_user` tool (status cycles through `running` ↔ `waiting_for_user`)

#### Agent Security

`governance.ts` implements a permission-gating system:
- `SecurityProfile` enum: `MINIMAL` (read-only), `STANDARD` (+ write), `ADMIN` (all tools)
- `ToolGuardian` class wraps tools with permission checks based on profile
- Default policies defined in `DEFAULT_POLICIES`

## Schema Overview

Key database tables in `packages/convex/convex/schema.ts`:

| Table | Purpose | Notable Fields |
|-------|---------|---------------|
| `notebooks` | Note organization | `type`: personal/system/digest/project |
| `notes` | Content with RAG | `noteType`: note/digest/system-file/report; `embedding` (1536-dim vector); `fileName`, `version` for system files |
| `agentJobs` | Job queue for Islas Agent | `type`: background/rpc/interactive; `status` includes `waiting_for_user`; `streamingText`, `conversationHistory` |
| `jobLogs` | Real-time agent output | Many event types including `turn_start/end`, `auto_compaction_*`, `auto_retry_*` |
| `agentSessions` | Worker state | `serializedState` for crash recovery; heartbeat-based timeout |
| `threadMetadata` | Chat thread state | `status`: active/archived/deleted |
| `notifications` | Push notification store | Types: permission_prompt, idle_prompt, task_complete, etc. |
| `apiKeys` | API key management | SHA-256 hashed keys with rate limiting |
| `usageLog` | Token/cost tracking | Per-model cost calculation |
| `settings` | User preferences | Key-value per user |

## Tech Stack

### Frontend
- **React 19** with Server Components
- **Tailwind CSS v4** with OKLCH color variables in `app/globals.css`
- **shadcn/ui** — `new-york` style, `lucide` icons, CSS variables, `neutral` base
- **AI SDK** (`ai` package) — Streaming agent responses and tool calls
- **Web Push** — `webpush-webcrypto` for push notifications

### Backend
- **Convex** — Serverless with real-time subscriptions
- **@convex-dev/agent** — Agent orchestration (threads, messages, tools)
- **@convex-dev/auth** — Authentication (passphrase-based single-user)
- **Vector Search** — OpenAI embeddings (1536 dims) for semantic note search
- **OpenRouter** — LLM provider (`@openrouter/ai-sdk-provider`)

### Agent
- **Pi SDK** (`@mariozechner/pi-coding-agent`) — Local AI agent with shell & file access
- **Convex HTTP Client** — Job polling and log streaming

## Key Conventions

### Tailwind CSS
- ✅ Use opacity modifiers: `bg-black/30`, `text-white/80`
- ❌ Never use deprecated classes: `bg-opacity-*`, `text-opacity-*`

### Convex Functions
- `query()` — Read-only, real-time reactive
- `mutation()` — Write operations, transactional
- `action()` — Non-deterministic (HTTP, AI calls), can call queries/mutations via `ctx.runQuery`/`ctx.runMutation`

### Filenames
- Convex files: **Cannot contain hyphens**. Use camelCase (e.g., `getPinnedNotes.ts`, not `get-pinned-notes.ts`)
- Next.js routes: Use kebab-case or folders

### Agent Tools Pattern
Tools in `convex/tools/` follow this structure:
```typescript
import { createTool } from "@convex-dev/agent";

export const toolName = createTool({
  description: "...",
  parameters: { /* zod schema */ },
  handler: async (ctx, args) => {
    // For queries: use explicit return types if circular inference
    // For UI tools: return { type: "ui", component: "ComponentName", data: {...} }
    // For actions: return confirmation message
  }
});
```

### Streaming Pattern (AI SDK)
1. Mutation saves user message + schedules action
2. Action runs `streamText` with `saveStreamDeltas`
3. Client uses `useUIMessages` with `stream: true`
4. Query returns `{ ...paginated, streams }` from `listUIMessages` + `syncStreams`

**UIMessage Parts**:
- Text: `{ type: "text", state: "streaming" | "done" }`
- Tools: `{ type: "tool-<name>", state: "input-streaming" | "input-available" | "output-available" | "output-error", input: {...}, output: {...} }`

## Environment Variables

### Web App (`apps/web/.env.local`)
```bash
CONVEX_DEPLOYMENT=                    # From Convex dashboard
NEXT_PUBLIC_CONVEX_URL=               # Public Convex endpoint
NEXT_PUBLIC_ACCESS_PASSPHRASE=        # Single-user passphrase (32+ chars)
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

## Single-User Authentication

Islas uses a simplified passphrase-based authentication:
- **Frontend**: Login at `/login` validates passphrase → sets httpOnly cookie for 30 days
- **Backend**: All requests authenticated as `"local-user"` via `getAuthUserId()`
- **MCP Gateway**: Separate Bearer token authentication for Claude Code integration

Set `NEXT_PUBLIC_ACCESS_PASSPHRASE` to a strong passphrase (minimum 32 characters).

## Deployment

### Vercel (Web App)
`vercel.json`:
- Build: `bun run build --filter=web`
- Output: `apps/web/.next`
- Build detection: `turbo-ignore`

### Convex (Backend)
```bash
cd packages/convex && npx convex deploy
```

### Agent (Local Only)
Runs on user machines. Not deployed to cloud.

## Islas Agent Flow

1. Web UI dispatches job via `/hq` command or tool call
2. Mutation creates `agentJobs` entry with status `pending` and type (`background`/`rpc`/`interactive`)
3. Local agent polls and picks up job
4. Agent updates status to `running`, executes with Pi SDK tools
5. Agent streams logs to `jobLogs` table + `streamingText` for real-time output
6. Web UI displays real-time terminal emulator in chat
7. For `interactive` jobs: agent can set `waiting_for_user` status, user responds, agent resumes
8. Agent updates status to `done`/`failed`

**Security**: Agent runs with local user permissions, gated by `ToolGuardian` security profiles.

## Important Gotchas

### Convex Component Types
- Agent generic `Agent<object, ToolSet>` causes `never` type in `streamText` → Use `as any` cast
- Thread listing: Use `components.agent.threads.listThreadsByUserId` (not `listThreadsByUser`)
- Circular type inference: `createTool` handlers calling `ctx.runQuery(internal....)` need explicit return type annotations

### Service Worker
- Files in `worker/` compiled via `@ducanh2912/next-pwa`
- Use `@ts-nocheck` for SW files (TS DOM types don't cover SW APIs)
- SW can't play audio → Use `postMessage` to client for notification sounds

### HTTP Actions
- HTTP actions bypass authentication → Validate with API keys
- Use `crypto.subtle.digest` for SHA-256 hashing (available in Convex runtime)
- Return HTTP 200 even for errors (JSON-RPC error in body)

### Web Push
- `webpush-webcrypto` works in Convex V8 runtime (uses `crypto.subtle`)
- Push subscription keys (`p256dh`, `auth`) are ArrayBuffer → convert to base64url
- Use `ctx.scheduler.runAfter(0, ...)` for fire-and-forget push from mutations
- Auto-cleanup stale subscriptions on 404/410 from push services

## CLI Commands

The `hq` CLI provides complete control:

```bash
hq setup          # One-command global install
hq start          # Start daemon
hq stop           # Stop daemon
hq status         # Check status
hq logs [-f]      # View logs
hq install        # Install system service
hq uninstall      # Remove system service
```

## File Paths

**State directory**: `~/.islas/`
**Agent files**:
- `.islas-worker-id` — Unique worker identifier
- `islas-context.md` — Local memory file
- `.islas-sessions/` — Session recovery data

**Service logs**:
- macOS: `~/Library/Logs/islas-agent.log`
- Linux: `~/.local/share/islas/agent.log`
