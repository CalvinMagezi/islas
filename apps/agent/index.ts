// Suppress Convex debug logging before any imports
process.env.CONVEX_LOG_LEVEL = "error";

import { ConvexClient } from "convex/browser";
import { api } from "@repo/convex/agent";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import WebSocket from "ws";
import { SkillLoader } from "./skills.js";
// lib/retry.ts kept for non-Pi-SDK retries (Convex calls, HTTP requests)
// Pi SDK handles LLM retry internally via SettingsManager.retry config
import { shouldFlushMemory, executeMemoryFlush, createFlushState, DEFAULT_FLUSH_OPTIONS } from "./lib/memoryFlush.js";
import { logger } from "./lib/logger.js";
import { ChatSessionManager } from "./lib/chatSession.js";
import { AgentWsServer } from "./lib/wsServer.js";
import { type RpcResultRef } from "./tools/index.js";
import { subscribeToJobEvents } from "./lib/sessionEvents.js";
import { buildJobPrompt } from "./lib/promptBuilder.js";
import { createJobTools } from "./lib/jobTools.js";
import { createJobSession } from "./lib/sessionFactory.js";

// Polyfill WebSocket for Node.js environment
global.WebSocket = WebSocket as any;

dotenv.config({ path: ".env.local" });

// Load environment variables
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const TARGET_DIR = process.env.TARGET_DIR || process.cwd();

if (!CONVEX_URL) {
    console.error("Error: NEXT_PUBLIC_CONVEX_URL is not set.");
    process.exit(1);
}

const API_KEY = process.env.ISLAS_API_KEY || "local-master-key"; // Default for local use

const WORKER_SECRET = process.env.WORKER_SECRET;
if (!WORKER_SECRET) {
    console.error("❌ WORKER_SECRET not set in .env.local");
    console.error("   Generate one with: openssl rand -hex 32");
    console.error("   Add it to both apps/agent/.env.local and Convex dashboard");
    process.exit(1);
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
    console.warn("Warning: OPENROUTER_API_KEY is not set. OpenRouter models will fail.");
}

const MODEL_ID = process.env.DEFAULT_MODEL || "moonshotai/kimi-k2.5";
const WORKER_ID_FILE = ".islas-worker-id";
const CONTEXT_FILE = "islas-context.md";
const SESSIONS_DIR = ".islas-sessions";

// Ensure sessions directory exists
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// Get or generate Worker ID
let WORKER_ID = "";
if (fs.existsSync(WORKER_ID_FILE)) {
    WORKER_ID = fs.readFileSync(WORKER_ID_FILE, "utf-8").trim();
} else {
    WORKER_ID = `worker-${Math.random().toString(36).substring(2, 11)}`;
    fs.writeFileSync(WORKER_ID_FILE, WORKER_ID);
}

console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║              🤖 Islas Agent                            ║
║                                                        ║
║  Worker ID: ${WORKER_ID.padEnd(44)} ║
║  Status: Online and waiting for jobs                   ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
`);

logger.info("Islas Agent starting", { workerId: WORKER_ID, targetDir: TARGET_DIR, model: MODEL_ID });

// Initialize Convex Client
const client = new ConvexClient(CONVEX_URL);

// Agent State
let isBusy = false;
let currentSession: any = null;
const jobIdRef: { value: string | null } = { value: null };
const rpcResultRef: RpcResultRef = { value: null };
let lastProcessedJobId: string | null = null;
let lastJobStatus: string | null = null;
let lastJobUpdatedAt: number | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;
let chatSession: ChatSessionManager | null = null;
let wsServer: AgentWsServer | null = null;

// Exponential backoff state
let consecutiveFailures = 0;
const BACKOFF_SCHEDULE = [0, 30_000, 60_000, 300_000, 900_000, 3_600_000];
let backoffUntil = 0;

// Helper to cast 'any' for excessive type instantiation issues
const cast = <T>(value: any): T => value as T;

async function setupAgent() {
    // 1. Initialize System Identity in Convex
    try {
        console.log("🧠 Initializing system identity in Convex...");
        await client.mutation(api.functions.system.ensureSystemIdentity, {});
    } catch (err: any) {
        console.warn("⚠️ Failed to initialize system identity:", err.message);
    }

    // 2. Initial Heartbeat & Skill Sync
    try {
        const availableSkills = SkillLoader.listSkills();
        console.log(`📡 Registering worker in: ${TARGET_DIR}`);
        console.log(`🧩 Available skills: ${availableSkills.join(", ") || "None found"}`);

        await client.mutation(api.agent.workerHeartbeat, cast({
            workerId: WORKER_ID,
            status: "online",
            apiKey: API_KEY,
            metadata: { cwd: TARGET_DIR, folderName: path.basename(TARGET_DIR) }
        }));

        // Sync skills to Convex on startup (not every heartbeat)
        const skillEntries = availableSkills.map(name => {
            const skill = SkillLoader.getSkill(name);
            return { name, description: skill?.description };
        });
        await client.mutation(api.agent.syncSkills, cast({
            workerId: WORKER_ID,
            skills: skillEntries,
            apiKey: API_KEY,
        }));
    } catch (err: any) {
        console.error("❌ Initial heartbeat failed:", err.message);
    }

    // 2. Start Heartbeat Loop
    heartbeatInterval = setInterval(async () => {
        try {
            const status = isBusy ? "busy" : "online";
            await client.mutation(api.agent.workerHeartbeat, cast({
                workerId: WORKER_ID,
                status,
                apiKey: API_KEY,
                metadata: { cwd: TARGET_DIR, folderName: path.basename(TARGET_DIR) }
            }));
        } catch (err: any) {
            console.error("Heartbeat failed:", err);
            logger.warn("Heartbeat failed", { error: err.message });
        }
    }, 10000); // 10 seconds

    // 3. Initialize Chat Session (shared brain for WebSocket clients)
    if (OPENROUTER_API_KEY) {
        const convexBaseUrl = CONVEX_URL!.replace(".cloud", ".site");
        chatSession = new ChatSessionManager({
            targetDir: TARGET_DIR,
            workerId: WORKER_ID,
            modelId: MODEL_ID,
            openrouterApiKey: OPENROUTER_API_KEY,
            convexBaseUrl,
            apiKey: API_KEY,
            contextFile: CONTEXT_FILE,
        });
        console.log("💬 Chat session initialized");

        // Verify dispatch endpoint connectivity (non-blocking)
        fetch(`${convexBaseUrl}/api/jobs/status`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-API-Key": API_KEY },
            body: JSON.stringify({ jobId: "startup-check" }),
            signal: AbortSignal.timeout(10000),
        }).then(res => {
            if (res.status === 401) {
                console.error("❌ dispatch_job API key INVALID — check ISLAS_API_KEY is registered in Convex apiKeys table");
            } else {
                console.log(`✅ Convex HTTP endpoint reachable (${convexBaseUrl}, status: ${res.status})`);
            }
        }).catch(err => {
            console.error(`❌ Cannot reach Convex HTTP endpoint (${convexBaseUrl}): ${err.message}`);
        });
    } else {
        console.log("⚠️  Chat session disabled (no OPENROUTER_API_KEY)");
    }

    // 4. Start WebSocket server for web UI
    if (chatSession) {
        const wsPort = parseInt(process.env.WS_PORT || "5678", 10);
        wsServer = new AgentWsServer({
            port: wsPort,
            chatSession,
            agentContext: () => ({
                targetDir: TARGET_DIR,
                workerId: WORKER_ID,
                isBusy,
            }),
        });
        wsServer.start();
        console.log(`🌐 WebSocket server on ws://127.0.0.1:${wsPort}`);
    }

    // 6. Subscribe to Jobs
    console.log("📡 Listening for tasks...\n");

    const unsubscribe = client.onUpdate(
        api.agent.getPendingJob,
        cast({ workerId: WORKER_ID, apiKey: API_KEY, workerSecret: WORKER_SECRET }),
        async (job) => {
            if (isBusy) return;
            if (Date.now() < backoffUntil) {
                const remainingS = Math.ceil((backoffUntil - Date.now()) / 1000);
                console.log(`⏳ Skipping job during backoff (${remainingS}s remaining)`);
                return;
            }
            if (job) {
                // Only pick up new jobs or jobs waiting for user.
                // We no longer try to "resume" running jobs locally,
                // as that leads to race conditions and loops.
                const isNewJob = job._id !== lastProcessedJobId;
                const isWaiting = job.status === "waiting_for_user";

                if (isNewJob || isWaiting) {
                    lastProcessedJobId = job._id;
                    lastJobStatus = job.status;
                    lastJobUpdatedAt = job.updatedAt;
                    await handleJob(job);
                }
            }
        }
    );

    // 7. Startup Catchup — check for pending jobs from offline period
    try {
        const pendingJob = await client.query(api.agent.getPendingJob, cast({
            workerId: WORKER_ID,
            apiKey: API_KEY,
            workerSecret: WORKER_SECRET,
        }));
        if (pendingJob && pendingJob.status === "pending") {
            console.log("📋 Found pending job from offline period, processing...");
            await handleJob(pendingJob);
        }
    } catch (err: any) {
        console.warn("⚠️ Startup catchup check failed:", err.message);
    }

    return unsubscribe;
}

// --- Handover Classification ---

/**
 * Determines if a job failure is recoverable by creating a follow-up job
 * with a fresh session. Only specific failure types qualify.
 */
function isHandoverableFailure(error: Error): boolean {
    const msg = error.message.toLowerCase();

    // Compaction failures — fresh session may fix
    if (msg.includes("compaction") && msg.includes("fail")) return true;

    // Context overflow — fresh session starts clean
    if (msg.includes("context") && (msg.includes("too large") || msg.includes("exceeded"))) return true;

    // Role ordering conflicts — fresh transcript avoids
    if (msg.includes("role") && msg.includes("order")) return true;

    // Do NOT handover: auth errors, permission errors, safety breaker
    if (msg.includes("invalid") && msg.includes("key")) return false;
    if (msg.includes("security error")) return false;
    if (msg.includes("safety breaker")) return false;

    return false;
}

// --- Job Handling & Recovery ---

async function handleJob(job: any) {
    if (isBusy) return;
    isBusy = true;
    jobIdRef.value = job._id;

    try {
        // Try to claim the job - this will fail if another worker grabbed it
        try {
            await client.mutation(api.agent.updateJobStatus, cast({
                jobId: job._id,
                status: "running",
                workerId: WORKER_ID,
                apiKey: API_KEY
            }));
        } catch (claimError: any) {
            // Claim failures (another worker grabbed it) should not trigger backoff
            console.log(`⚡ Job already claimed by another worker, skipping.`);
            isBusy = false;
            jobIdRef.value = null;
            return;
        }

        console.log(`\n💬 New task received: "${job.instruction}"\n`);
        logger.info("Job started", { jobId: job._id, type: job.type, instruction: job.instruction.substring(0, 100) });

        console.log("Assistant: ");

        const { governedTools, securityProfile } = createJobTools({
            job,
            convexUrl: CONVEX_URL!,
            apiKey: API_KEY,
            targetDir: TARGET_DIR,
            contextFile: CONTEXT_FILE,
            client,
            jobIdRef,
            rpcResultRef,
        });

        const { session, folderContent } = await createJobSession({
            job,
            governedTools,
            securityProfile,
            defaultModelId: MODEL_ID,
            targetDir: TARGET_DIR,
        });
        currentSession = session;

        // --- Event Listeners ---
        const jobEvents = subscribeToJobEvents({
            session,
            client,
            jobId: job._id,
            apiKey: API_KEY,
            onSyncSessionState: syncSessionState,
            maxToolCalls: 20,
        });

        // Build prompt
        const preloadedSkills = SkillLoader.loadAllSkills();

        // Fetch Pinned Context from Convex
        let pinnedContext = "";
        try {
            const contextData = await client.query(api.functions.system.getAgentContext, {});
            if (contextData && contextData.length > 0) {
                pinnedContext = "# PERSISTENT CONTEXT\n\n" +
                    contextData.map((c: any) => `## ${c.title}\n${c.content}`).join("\n\n");
            }
        } catch (e) {
            console.warn("⚠️ Failed to load pinned context");
        }

        const promptText = buildJobPrompt({
            targetDir: TARGET_DIR,
            folderContent,
            pinnedContext,
            preloadedSkills,
            jobType: job.type,
            instruction: job.pendingUserMessage || job.instruction,
            conversationHistory: job.conversationHistory,
            pendingUserMessage: job.pendingUserMessage,
        });

        // Pre-compaction: uses session.compact() with context-aware instructions
        const memoryFlushState = createFlushState();
        if (shouldFlushMemory(session, memoryFlushState, DEFAULT_FLUSH_OPTIONS)) {
            await executeMemoryFlush(session, memoryFlushState, (msg) => {
                console.log(msg);
                logger.info(msg);
            }, job.type || "background", job.instruction);
        }

        // Run the Agent — Pi SDK handles retry internally via SettingsManager.retry config
        // auto_retry_start/auto_retry_end events are emitted and logged via the event handler
        await session.prompt(promptText);
        
        // Final completion message for interactive mode
        if (job.type === "interactive" && !jobEvents.currentText.toLowerCase().includes("completed")) {
            const completionMsg = "\n\n✓ Task completed. Let me know if you need anything else!";
            process.stdout.write(completionMsg);
            jobEvents.currentText += completionMsg;
        }

        // AUTO-MEMORY: Store a brief summary of the work in the Memory note
        try {
            const workSummary = `- [${new Date().toLocaleTimeString()}] Task: ${job.instruction.substring(0, 50)}${job.instruction.length > 50 ? "..." : ""} Status: ${jobEvents.currentText.includes("✓") ? "Success" : "Finished"}`;
            await client.mutation(api.functions.system.appendToSystemNote, {
                title: "Memory",
                content: workSummary
            });
        } catch (e) {
            // Memory note might not exist yet, ignore
        }

        await jobEvents.flushText();
        await client.mutation(api.agent.commitStreamingText, cast({
            jobId: job._id,
            apiKey: API_KEY
        }));

        // Capture Pi SDK session stats for observability
        let jobStats: any = undefined;
        try {
            const piStats = session.getSessionStats?.();
            if (piStats) {
                jobStats = {
                    tokens: {
                        input: piStats.tokens?.input ?? 0,
                        output: piStats.tokens?.output ?? 0,
                        cacheRead: piStats.tokens?.cacheRead ?? 0,
                        total: piStats.tokens?.total ?? 0,
                    },
                    cost: piStats.cost ?? 0,
                    toolCalls: piStats.toolCalls ?? 0,
                    messages: piStats.totalMessages ?? 0,
                };
                logger.info("Job stats", { jobId: job._id, ...jobStats });
            }
        } catch (e) {
            // Stats are best-effort
        }

        // Finalize job status
        await client.mutation(api.agent.updateJobStatus, cast({
            jobId: job._id,
            status: "done" as const,
            result: rpcResultRef.value,
            stats: jobStats,
            apiKey: API_KEY
        }));

        lastJobStatus = "done";
        lastJobUpdatedAt = Date.now();
        consecutiveFailures = 0;
        backoffUntil = 0;

        if (job.type !== "interactive") console.log("\n✓ Task completed");
        logger.info("Job completed", { jobId: job._id, type: job.type, stats: jobStats });
    } catch (error: any) {
        const errorMsg = error.message || String(error);
        const isCancellation = errorMsg.includes("cancelled by user");

        if (isCancellation) {
            // Cancelled jobs: don't backoff, don't handover, just mark as cancelled
            console.log("\n🚫 Job cancelled");
            logger.info("Job cancelled", { jobId: job._id });
            lastJobStatus = "cancelled";
            lastJobUpdatedAt = Date.now();
            // Status already set to "cancelled" by the cancelJob mutation
            await client.mutation(api.agent.addJobLog, cast({ jobId: job._id, type: "info", content: "Job cancelled by user", apiKey: API_KEY }));
        } else {
            console.error("\n❌ Error:", errorMsg);
            logger.error("Job failed", { jobId: job._id, error: errorMsg });
            lastJobStatus = "failed";
            lastJobUpdatedAt = Date.now();

            consecutiveFailures++;
            const backoffMs = BACKOFF_SCHEDULE[Math.min(consecutiveFailures, BACKOFF_SCHEDULE.length - 1)];
            backoffUntil = Date.now() + backoffMs;
            if (backoffMs > 0) {
                console.log(`⏳ Backing off ${backoffMs / 1000}s after ${consecutiveFailures} consecutive failure(s)`);
                logger.info(`Backing off ${backoffMs / 1000}s`, { consecutiveFailures });
            }

            await client.mutation(api.agent.updateJobStatus, cast({ jobId: job._id, status: "failed", apiKey: API_KEY }));
            await client.mutation(api.agent.addJobLog, cast({ jobId: job._id, type: "error", content: errorMsg, apiKey: API_KEY }));
        }

        // Task handover: only for recoverable failures, NOT cancellations
        if (!isCancellation && isHandoverableFailure(error)) {
            try {
                const newJobId = await client.mutation(api.agent.createFollowUpJob, cast({
                    originalJobId: job._id,
                    reason: errorMsg,
                    apiKey: API_KEY,
                }));
                console.log(`🔄 Created follow-up job: ${newJobId}`);
                logger.info("Created follow-up job", { originalJobId: job._id, newJobId, reason: errorMsg });
            } catch (handoverErr: any) {
                console.warn("⚠️  Failed to create follow-up job:", handoverErr.message);
                logger.warn("Follow-up job creation failed", { error: handoverErr.message });
            }
        }
    } finally {
        isBusy = false;
        jobIdRef.value = null;
        currentSession = null;
        rpcResultRef.value = null;
    }
}

// --- Helper Functions ---

async function syncSessionState(session: any, jobId: string) {
    try {
        const sessionFile = session.sessionFile;
        if (typeof sessionFile === 'string' && fs.existsSync(sessionFile)) {
            const serializedState = fs.readFileSync(sessionFile, "utf-8");
            await client.mutation(api.agent.workerHeartbeat, cast({
                workerId: WORKER_ID,
                status: "busy",
                serializedState: serializedState,
                apiKey: API_KEY
            }));
            await client.mutation(api.agent.updateJobStatus, cast({
                jobId: jobId,
                status: "running",
                workerId: WORKER_ID,
                recoveryPoint: { sessionFile: sessionFile, timestamp: Date.now() },
                apiKey: API_KEY
            }));
        }
    } catch (err) {
        console.warn("Failed to sync session state:", err);
    }
}

// --- Signal Handlers ---
let shutdownAttempted = false;
async function shutdown() {
    if (shutdownAttempted) {
        console.log("\n🛑 Force exiting...");
        process.exit(1);
    }
    shutdownAttempted = true;
    
    console.log("\n👋 Shutting down...");
    logger.info("Agent shutting down", { workerId: WORKER_ID });
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    // Stop WebSocket server
    if (wsServer) {
        wsServer.stop();
    }

    if (isBusy && jobIdRef.value && currentSession) {
        console.log(`💾 Saving state for active job...`);
        await syncSessionState(currentSession, jobIdRef.value);
    }

    try {
        await client.mutation(api.agent.workerHeartbeat, cast({
            workerId: WORKER_ID,
            status: "offline",
            apiKey: API_KEY
        }));
    } catch (_e) {
        // Ignore offline heartbeat errors during shutdown
    }

    process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// --- Entry Point ---
setupAgent().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
