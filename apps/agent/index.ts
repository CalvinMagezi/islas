// Suppress Convex debug logging before any imports
process.env.CONVEX_LOG_LEVEL = "error";

import {
    createAgentSession,
    createCodingTools,
    createBashTool,
    type AgentSessionEvent,
    SettingsManager
} from "@mariozechner/pi-coding-agent";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { ConvexClient } from "convex/browser";
import { api } from "@repo/convex/agent";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import WebSocket from "ws";
import { ToolGuardian, SecurityProfile, DEFAULT_POLICIES, PROFILE_TOOL_NAMES, createSecuritySpawnHook, type ApprovalCallback } from "./governance.js";
import { LoadSkillTool, ListSkillsTool, SkillLoader } from "./skills.js";
// lib/retry.ts kept for non-Pi-SDK retries (Convex calls, HTTP requests)
// Pi SDK handles LLM retry internally via SettingsManager.retry config
import { shouldFlushMemory, executeMemoryFlush, createFlushState, DEFAULT_FLUSH_OPTIONS } from "./lib/memoryFlush.js";
import { logger } from "./lib/logger.js";
import { ChatSessionManager } from "./lib/chatSession.js";
import { AgentWsServer } from "./lib/wsServer.js";
import { PtyManager } from "./lib/ptyManager.js";
import { Orchestrator } from "./lib/orchestrator.js";
import { createDispatchParallelTasksTool } from "./lib/orchestrationTools.js";

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
let currentJobId: string | null = null;
let lastProcessedJobId: string | null = null;
let lastJobStatus: string | null = null;
let lastJobUpdatedAt: number | null = null;
let rpcResult: any = null; // For RPC mode
let heartbeatInterval: NodeJS.Timeout | null = null;
let chatSession: ChatSessionManager | null = null;
let ptyManager: PtyManager | null = null;
let wsServer: AgentWsServer | null = null;
let orchestrator: Orchestrator | null = null;

// Exponential backoff state
let consecutiveFailures = 0;
const BACKOFF_SCHEDULE = [0, 30_000, 60_000, 300_000, 900_000, 3_600_000];
let backoffUntil = 0;

// Helper to cast 'any' for excessive type instantiation issues
const cast = <T>(value: any): T => value as T;


// --- Custom Tools Definitions ---

const LocalContextSchema = Type.Object({
    action: Type.Union([Type.Literal("read"), Type.Literal("write")]),
    content: Type.Optional(Type.String())
});

const LocalContextTool: AgentTool<typeof LocalContextSchema> = {
    name: "local_context",
    description: "Read or write to the local persistent memory file (islas-context.md). Use this to remember things across sessions.",
    parameters: LocalContextSchema,
    label: "Local Context",
    execute: async (toolCallId, args) => {
        if (args.action === "read") {
            if (!fs.existsSync(CONTEXT_FILE)) return { content: [{ type: "text", text: "No local context found." }], details: {} };
            return { content: [{ type: "text", text: fs.readFileSync(CONTEXT_FILE, "utf-8") }], details: {} };
        } else {
            fs.writeFileSync(CONTEXT_FILE, args.content || "");
            return { content: [{ type: "text", text: "Context updated." }], details: {} };
        }
    }
};

const HeartbeatSchema = Type.Object({
    action: Type.Union([Type.Literal("read"), Type.Literal("write"), Type.Literal("append")]),
    content: Type.Optional(Type.String({ description: "New content for 'write', or text to append for 'append'" }))
});

const HeartbeatTool: AgentTool<typeof HeartbeatSchema> = {
    name: "heartbeat",
    description: "Read, write, or append to the HQ Heartbeat note. This note is processed by a server-side cron every 2 minutes — any actionable content will be dispatched as a background job to an available worker. Use 'write' to replace the entire content, 'append' to add a task, or 'read' to check current content.",
    parameters: HeartbeatSchema,
    label: "Heartbeat",
    execute: async (toolCallId, args) => {
        try {
            if (args.action === "read") {
                const context = await client.query(api.functions.system.getAgentContext, {});
                const hb = context.find((n: any) => n.title === "Heartbeat");
                return { content: [{ type: "text", text: hb ? hb.content : "No heartbeat note found." }], details: {} };
            } else if (args.action === "write") {
                await client.mutation(api.functions.system.updateSystemNote, {
                    title: "Heartbeat",
                    content: args.content || ""
                });
                return { content: [{ type: "text", text: "Heartbeat note updated." }], details: {} };
            } else {
                await client.mutation(api.functions.system.appendToSystemNote, {
                    title: "Heartbeat",
                    content: args.content || ""
                });
                return { content: [{ type: "text", text: "Appended to heartbeat note." }], details: {} };
            }
        } catch (error: any) {
            return { content: [{ type: "text", text: `Heartbeat error: ${error.message}` }], details: { error } };
        }
    }
};

const MCPBridgeSchema = Type.Object({
    toolName: Type.String(),
    arguments: Type.Any()
});

const MCPBridgeTool: AgentTool<typeof MCPBridgeSchema> = {
    name: "mcp_bridge",
    description: "Call cloud-hosted MCP servers (Knowledge Graphs, Browser Tools) via the Convex MCP gateway.",
    parameters: MCPBridgeSchema,
    label: "MCP Bridge",
    execute: async (toolCallId, args) => {
        const mcpGatewayUrl = process.env.MCP_GATEWAY_URL || (CONVEX_URL ? CONVEX_URL.replace(".cloud", ".site") + "/mcp" : "");
        const mcpGatewayToken = process.env.MCP_GATEWAY_TOKEN;
        if (!mcpGatewayUrl || !mcpGatewayToken) {
            return { content: [{ type: "text", text: "MCP Bridge not configured: set MCP_GATEWAY_URL and MCP_GATEWAY_TOKEN env vars." }], details: {} };
        }
        const mcpUrl = mcpGatewayUrl;
        const authHeader = `Bearer ${mcpGatewayToken}`;

        try {
            const response = await fetch(mcpUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": authHeader,
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    id: 1,
                    method: "tools/call",
                    params: {
                        name: args.toolName,
                        arguments: args.arguments,
                    },
                }),
            });
            const data: any = await response.json();
            const resultText = JSON.stringify(data.result || data.error || data);
            return { content: [{ type: "text", text: resultText }], details: { data } };
        } catch (error: any) {
            return { content: [{ type: "text", text: `MCP Error: ${error.message}` }], details: { error } };
        }
    }
};

const SubmitResultSchema = Type.Object({
    result: Type.Any()
});

const SubmitResultTool: AgentTool<typeof SubmitResultSchema> = {
    name: "submit_result",
    description: "Submit the final result of an RPC job. Use this ONLY when the user asks for a direct return value (RPC mode).",
    parameters: SubmitResultSchema,
    label: "Submit Result",
    execute: async (toolCallId, args) => {
        if (currentJobId) {
            rpcResult = args.result;
            return { content: [{ type: "text", text: "Result submitted. You may now stop." }], details: {} };
        }
        return { content: [{ type: "text", text: "Error: No active job." }], details: {} };
    }
};

// --- Interactive Chat Tool ---

const ChatWithUserSchema = Type.Object({
    message: Type.String({ description: "The message or question to ask the user" }),
    waitForResponse: Type.Optional(Type.Boolean({ description: "Whether to wait for the user to respond before continuing" }))
});

let pendingUserResponse: string | null = null;

const ChatWithUserTool: AgentTool<typeof ChatWithUserSchema> = {
    name: "chat_with_user",
    description: "Send a message to the user and optionally wait for a response. Use this to ask clarifying questions, confirm actions, or provide updates during long-running tasks. For interactive jobs, set waitForResponse=true to pause execution until the user replies.",
    parameters: ChatWithUserSchema,
    label: "Chat with User",
    execute: async (toolCallId, args) => {
        // Log the message
        console.log(`[Agent -> User]: ${args.message}`);
        
        // If we're in an interactive job and need to wait for a response
        if (args.waitForResponse && currentJobId) {
            // Update job status to waiting
            await client.mutation(api.agent.updateJobStatus, cast({
                jobId: currentJobId,
                status: "waiting_for_user",
                apiKey: API_KEY,
                conversationHistory: [] // Will be populated with this message
            }));
            
            // Add to job logs
            await client.mutation(api.agent.addJobLog, cast({
                jobId: currentJobId,
                type: "info",
                content: `Agent: ${args.message}`,
                apiKey: API_KEY
            }));
            
            // Wait for user response with polling
            pendingUserResponse = null;
            const startTime = Date.now();
            const timeout = 30 * 60 * 1000; // 30 minute timeout
            
            while (Date.now() - startTime < timeout) {
                // Check for user response
                const job = await client.query(api.agent.getJob, { jobId: currentJobId as any });
                
                if (job && job.status === "running" && job.pendingUserMessage) {
                    pendingUserResponse = job.pendingUserMessage;
                    // Clear the pending message
                    await client.mutation(api.agent.updateJobStatus, cast({
                        jobId: currentJobId,
                        status: "running",
                        apiKey: API_KEY,
                        conversationHistory: job.conversationHistory
                    }));
                    break;
                }
                
                // Wait 500ms before checking again
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            if (pendingUserResponse) {
                return { 
                    content: [{ type: "text", text: pendingUserResponse }], 
                    details: { received: true, message: pendingUserResponse }
                };
            } else {
                return { 
                    content: [{ type: "text", text: "No response received within timeout period." }], 
                    details: { timeout: true }
                };
            }
        }
        
        // Non-blocking message
        return { 
            content: [{ type: "text", text: `Message sent to user: "${args.message}"` }], 
            details: { acknowledged: true }
        };
    }
};

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

    // 4. Initialize PtyManager for terminal orchestration
    ptyManager = new PtyManager(
        // onOutput: broadcast PTY data to WebSocket clients
        (sessionId, data) => {
            if (wsServer) {
                wsServer.broadcastBinary(sessionId, data);
            }
        },
        // onExit: update terminal status in Convex
        async (sessionId, exitCode) => {
            try {
                await client.mutation(api.agent.updateTerminalStatus, cast({
                    sessionId,
                    status: "exited",
                    exitCode,
                    apiKey: API_KEY,
                }));
                if (wsServer) {
                    wsServer.broadcast({
                        type: "event",
                        event: "terminal.exit",
                        payload: { sessionId, exitCode },
                    });
                }
            } catch (err: any) {
                logger.error("Failed to update terminal exit status", {
                    sessionId,
                    exitCode,
                    error: err.message,
                });
            }
        }
    );
    console.log("🖥️  PTY Manager initialized");

    // 5b. Initialize Orchestrator for task DAG execution
    orchestrator = new Orchestrator(ptyManager, client, WORKER_ID);
    console.log("🎯 Orchestrator initialized");

    // 6. Start WebSocket server for web UI
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
            ptyManager,
            convexMutate: async (name, args) => {
                // Helper to call Convex mutations from WebSocket handlers
                const [ns, fn] = name.split(":");
                return await client.mutation((api as any)[ns][fn], cast(args));
            },
            convexQuery: async (name, args) => {
                // Helper to call Convex queries from WebSocket handlers
                const [ns, fn] = name.split(":");
                return await client.query((api as any)[ns][fn], cast(args));
            },
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
    currentJobId = job._id;

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
            currentJobId = null;
            return;
        }

        console.log(`\n💬 New task received: "${job.instruction}"\n`);
        logger.info("Job started", { jobId: job._id, type: job.type, instruction: job.instruction.substring(0, 100) });

        // Check if this is a terminal-only job (no Pi SDK processing needed)
        // Terminal jobs are marked with orchestrationType: "single" or instruction starts with [TERMINAL]
        const isTerminalOnly = job.orchestrationType === "single" || job.instruction.startsWith("[TERMINAL]");

        if (isTerminalOnly) {
            console.log("🖥️  Terminal-only job detected. Waiting for WebSocket terminal connection...");
            console.log("   (This job will be handled by PTY terminal, not Pi SDK)");

            // Keep job running so terminal can connect, but don't process with Pi SDK
            // The terminal will handle all execution via PTY
            // Job will be marked as done when terminal exits
            isBusy = false;
            currentJobId = null;
            return;
        }

        console.log("Assistant: ");

        // Setup Governance & Tools — use per-job profile if specified, default GUARDED
        const profileMap: Record<string, SecurityProfile> = {
            minimal: SecurityProfile.MINIMAL,
            standard: SecurityProfile.STANDARD,
            guarded: SecurityProfile.GUARDED,
            admin: SecurityProfile.ADMIN,
        };
        const securityProfile = profileMap[job.securityProfile || ""] || SecurityProfile.GUARDED;

        const APPROVALS_BASE_URL = CONVEX_URL!.replace(".cloud", ".site");

        const onApprovalRequired: ApprovalCallback = async (toolName, args, riskLevel) => {
            const argsPreview = typeof args === "string"
                ? args.substring(0, 200)
                : JSON.stringify(args ?? {}).substring(0, 200);

            console.log(`\n🛡️ Approval required for '${toolName}' (${riskLevel} risk)`);

            try {
                // 1. Create approval + start durable workflow via HTTP endpoint
                const createRes = await fetch(`${APPROVALS_BASE_URL}/api/approvals/create`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-API-Key": API_KEY,
                    },
                    body: JSON.stringify({
                        title: `${toolName}: ${argsPreview}`,
                        description: `The agent wants to execute '${toolName}' with args: ${argsPreview}`,
                        toolName,
                        toolArgs: args,
                        riskLevel,
                        jobId: job._id,
                        timeoutMinutes: 10,
                    }),
                });

                const createData = await createRes.json() as { ok: boolean; approvalId: string; workflowId: string };
                if (!createData.ok) {
                    console.error("Failed to create approval request");
                    return { approved: false, reason: "Failed to create approval" };
                }

                console.log(`⏳ Waiting for approval (ID: ${createData.approvalId})...`);

                // 2. Poll for decision
                const POLL_INTERVAL = 2000;
                const TIMEOUT = 10 * 60 * 1000; // 10 minutes
                const startTime = Date.now();

                while (Date.now() - startTime < TIMEOUT) {
                    const statusRes = await fetch(`${APPROVALS_BASE_URL}/api/approvals/status`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            "X-API-Key": API_KEY,
                        },
                        body: JSON.stringify({ approvalId: createData.approvalId }),
                    });

                    const statusData = await statusRes.json() as {
                        ok: boolean;
                        status: string;
                        approved: boolean;
                        rejectionReason?: string;
                    };

                    if (statusData.status !== "pending") {
                        if (statusData.approved) {
                            console.log(`✅ Approved!`);
                        } else {
                            console.log(`❌ Rejected: ${statusData.rejectionReason || "No reason"}`);
                        }
                        return {
                            approved: statusData.approved,
                            reason: statusData.rejectionReason,
                        };
                    }

                    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
                }

                console.log(`⏰ Approval timed out`);
                return { approved: false, reason: "Approval request timed out" };
            } catch (err: any) {
                console.error(`Approval error: ${err.message}`);
                return { approved: false, reason: `Approval error: ${err.message}` };
            }
        };

        const guardian = new ToolGuardian(securityProfile, DEFAULT_POLICIES, onApprovalRequired);

        // Create bash tool with security spawn hook (intercepts commands BEFORE execution)
        const spawnHook = createSecuritySpawnHook(securityProfile, (msg) => logger.info(msg));
        const secureBashTool = createBashTool(TARGET_DIR, { spawnHook });

        // Use secure bash tool + all other coding tools (read, edit, write, find, grep, ls)
        const codingToolsWithoutBash = createCodingTools(TARGET_DIR).filter((t: any) => t.name !== "bash");

        // Create dispatch_parallel_tasks tool with orchestrator callback
        const dispatchParallelTasksTool = createDispatchParallelTasksTool(
            async (taskPlan, jobId) => {
                // Store task plan in Convex
                await client.mutation(api.agent.updateTaskPlan, cast({
                    jobId: job._id,
                    taskPlan,
                    apiKey: API_KEY,
                }));

                // Execute the plan via orchestrator
                if (!orchestrator) {
                    throw new Error("Orchestrator not initialized");
                }
                await orchestrator.executePlan(
                    job._id,
                    job.userId,
                    taskPlan,
                    TARGET_DIR
                );
            }
        );

        const rawTools: AgentTool<any>[] = [
            LocalContextTool,
            HeartbeatTool,
            MCPBridgeTool,
            LoadSkillTool,
            ListSkillsTool,
            ChatWithUserTool,
            dispatchParallelTasksTool,
            secureBashTool,
            ...codingToolsWithoutBash
        ];

        if (job.type === "rpc") {
            rawTools.push(SubmitResultTool);
        }

        const governedTools = rawTools.map(tool => guardian.govern(tool));

        const settingsManager = SettingsManager.inMemory({
            compaction: {
                enabled: true,
                reserveTokens: 4000,
                keepRecentTokens: 20000
            },
            retry: {
                enabled: true,
                maxRetries: 3,
                baseDelayMs: 500,
                maxDelayMs: 30_000
            }
        });

        // Determine Model — per-job override takes priority, then env default
        const effectiveModelId = job.modelOverride || MODEL_ID;
        let model: any = effectiveModelId;

        // Scan folder for project context to provide better grounding
        let folderContent = "";
        try {
            const files = fs.readdirSync(TARGET_DIR);
            folderContent = files.slice(0, 20).join(", ");
            if (files.length > 20) folderContent += "...";
        } catch (_e) {
            // Ignore folder read errors - not critical
        }

        if (typeof effectiveModelId === 'string' && effectiveModelId.startsWith("moonshotai/")) {
            model = {
                id: effectiveModelId,
                name: "Kimi k2.5",
                provider: "openrouter",
                api: "openai-completions",
                baseUrl: "https://openrouter.ai/api/v1",
                reasoning: false,
                input: ["text"],
                cost: { input: 0.3, output: 0.3, cacheRead: 0.075, cacheWrite: 0.3 },
                contextWindow: 200000,
                maxTokens: 8192
            };
        } else if (typeof effectiveModelId === 'string' && effectiveModelId !== MODEL_ID) {
            // Build an OpenRouter model config for overridden model IDs
            model = {
                id: effectiveModelId,
                name: effectiveModelId.split("/").pop() || effectiveModelId,
                provider: "openrouter",
                api: "openai-completions",
                baseUrl: "https://openrouter.ai/api/v1",
                reasoning: effectiveModelId.includes("thinking") || effectiveModelId.includes("reasoning"),
                input: ["text"],
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 200000,
                maxTokens: 8192
            };
            logger.info("Using model override", { modelId: effectiveModelId });
        }

        if (job.modelOverride) {
            logger.info("Job model override", { jobId: job._id, model: job.modelOverride });
        }

        // Create Session — pass per-job thinkingLevel if specified
        const sessionOptions: any = {
            tools: cast(governedTools),
            model: model,
            settingsManager: settingsManager
        };
        if (job.thinkingLevel) {
            sessionOptions.thinkingLevel = job.thinkingLevel;
            logger.info("Job thinking level", { jobId: job._id, thinkingLevel: job.thinkingLevel });
        }
        const { session } = await createAgentSession(sessionOptions);

        currentSession = session;

        // Dynamic tool activation based on security profile
        const profileToolNames = PROFILE_TOOL_NAMES[securityProfile];
        if (profileToolNames !== "*") {
            try {
                session.setActiveToolsByName(profileToolNames);
                logger.info("Tools restricted by profile", { profile: securityProfile, tools: profileToolNames });
            } catch (e) {
                // setActiveToolsByName may not be available on all Pi SDK versions
                logger.warn("Dynamic tool activation not supported", { error: (e as Error).message });
            }
        }

        // Strictly sequential logging for terminal and streaming text for web
        let currentAgentText = "";
        let lastUpdateTime = 0;
        let toolCallCount = 0;
        const MAX_TOOL_CALLS = 20; // Safety breaker
        const UPDATE_THROTTLE_MS = 200;

        const syncStreamingText = async (force = false) => {
            const now = Date.now();
            if (!force && now - lastUpdateTime < UPDATE_THROTTLE_MS) return;
            lastUpdateTime = now;
            
            try {
                await client.mutation(api.agent.updateJobStreamingText, cast({
                    jobId: job._id,
                    text: currentAgentText,
                    apiKey: API_KEY
                }));
            } catch (_e) {
                // Ignore streaming text update errors
            }
        };

        const logQueue: any[] = [];
        let isFlushing = false;
        const processLogQueue = async () => {
            if (isFlushing || logQueue.length === 0) return;
            isFlushing = true;
            while (logQueue.length > 0) {
                const event = logQueue.shift();
                try {
                    await client.mutation(api.agent.addJobLog, cast({
                        jobId: job._id,
                        type: event.type,
                        content: JSON.stringify(event),
                        apiKey: API_KEY
                    }));
                } catch (_e) {
                    // Ignore log queue flush errors
                }
            }
            isFlushing = false;
        };

        // --- Event Listeners ---
        session.subscribe(async (event: AgentSessionEvent) => {
            const eventType = event.type as string;
            
            // 1. Stream to Console and accumulate for web
            if (eventType === "message_update") {
                const updateEvent = event as any;
                if (updateEvent.assistantMessageEvent?.type === "text_delta") {
                    const delta = updateEvent.assistantMessageEvent.delta;
                    process.stdout.write(delta);
                    currentAgentText += delta;
                    void syncStreamingText();
                }
            } else if (eventType === "message_stop") {
                process.stdout.write("\n\n");
                // Commit to history
                await syncStreamingText(true);
                await client.mutation(api.agent.commitStreamingText, cast({
                    jobId: job._id,
                    apiKey: API_KEY
                }));
                currentAgentText = "";

                // Log context usage for observability
                try {
                    const usage = session.getContextUsage?.();
                    if (usage && usage.percent != null) {
                        void client.mutation(api.agent.addJobLog, cast({
                            jobId: job._id,
                            type: "context_usage",
                            content: `Context: ${usage.tokens}/${usage.contextWindow} tokens (${Math.round(usage.percent)}%)`,
                            metadata: { tokens: usage.tokens, contextWindow: usage.contextWindow, percent: usage.percent },
                            apiKey: API_KEY
                        }));

                        if (usage.percent > 70) {
                            console.log(`⚠️  Context usage: ${Math.round(usage.percent)}%`);
                            void client.mutation(api.agent.addJobLog, cast({
                                jobId: job._id,
                                type: "warning",
                                content: `High context usage: ${Math.round(usage.percent)}% — compaction may trigger soon`,
                                apiKey: API_KEY
                            }));
                        }
                    }
                } catch (e) {
                    // Context usage is best-effort
                }
            } else if (eventType === "tool_execution_start") {
                const toolEvent = event as any;
                const toolName = toolEvent.toolCall?.tool?.name || toolEvent.toolCall?.name || "tool";
                const toolArgs = JSON.stringify(toolEvent.toolCall?.arguments || {});
                console.log(`\n[🛠️ Tool Call]: ${toolName} -> ${toolArgs.substring(0, 100)}${toolArgs.length > 100 ? "..." : ""}`);
                
                toolCallCount++;
                if (toolCallCount > MAX_TOOL_CALLS) {
                    console.error("\n🛑 SAFETY BREAKER: Too many tool calls. Aborting to save tokens.");
                    await session.abort();
                    throw new Error("Safety breaker: Maximum tool call limit reached.");
                }
            } else if (eventType === "tool_execution_end") {
                const toolEvent = event as any;
                if (toolEvent.toolResult?.error) {
                    console.log(`[❌ Tool Error]: ${toolEvent.toolResult.error}`);
                } else {
                    console.log(`[✅ Tool Complete]`);
                }

                // Check for cancellation or steering on every tool completion
                try {
                    const latestJob = await client.query(api.agent.getJob, { jobId: job._id as any });
                    if (latestJob) {
                        // Job cancellation
                        if (latestJob.status === "cancelled") {
                            console.log("\n❌ Job cancelled by user");
                            logger.info("Job cancelled by user", { jobId: job._id });
                            await session.abort();
                            throw new Error("Job cancelled by user");
                        }
                        // Mid-job steering
                        if (latestJob.steeringMessage) {
                            console.log(`\n🎯 Steering: ${latestJob.steeringMessage}`);
                            logger.info("Job steered", { jobId: job._id, message: latestJob.steeringMessage });
                            await session.steer(latestJob.steeringMessage);
                            // Clear steering message
                            await client.mutation(api.agent.clearSteeringMessage, cast({
                                jobId: job._id,
                                apiKey: API_KEY
                            }));
                        }
                        // Mid-job thinking level change
                        if (latestJob.thinkingLevel && typeof session.setThinkingLevel === "function") {
                            const currentLevel = session.thinkingLevel;
                            if (currentLevel !== latestJob.thinkingLevel) {
                                console.log(`\n🧠 Thinking level: ${currentLevel} → ${latestJob.thinkingLevel}`);
                                logger.info("Thinking level changed mid-job", { jobId: job._id, from: currentLevel, to: latestJob.thinkingLevel });
                                session.setThinkingLevel(latestJob.thinkingLevel);
                            }
                        }
                    }
                } catch (e: any) {
                    if (e.message === "Job cancelled by user") throw e;
                    // Non-fatal: cancellation/steer/thinking check failed, continue execution
                }
            } else if (eventType === "auto_retry_start") {
                const retryEvent = event as any;
                const msg = `Retry ${retryEvent.attempt}/${retryEvent.maxAttempts} after ${retryEvent.delayMs}ms: ${retryEvent.errorMessage}`;
                console.log(`\n⚠️  ${msg}`);
                logger.warn(msg, { jobId: job._id, attempt: retryEvent.attempt });
            } else if (eventType === "auto_retry_end") {
                const retryEvent = event as any;
                if (retryEvent.success) {
                    console.log(`✅ Retry succeeded on attempt ${retryEvent.attempt}`);
                } else {
                    console.log(`❌ All retries exhausted: ${retryEvent.finalError || "unknown error"}`);
                    logger.error("All retries exhausted", { jobId: job._id, finalError: retryEvent.finalError });
                }
            }

            // Queue other events for Terminal View
            if (eventType !== "message_update") {
                logQueue.push(event);
                void processLogQueue();
            }
            
            // Periodic State Sync (Throttled)
            if (eventType === "message_stop" || eventType === "tool_execution_end") {
                await syncSessionState(session, job._id);
            }
        });

        // Build prompt
        const preloadedSkills = SkillLoader.loadAllSkills();
        let promptText = job.pendingUserMessage || job.instruction;
        
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

        if (job.type === "interactive" && job.conversationHistory && job.conversationHistory.length > 0) {
            // Filter history to ONLY show previous turns, not the current one
            const history = job.pendingUserMessage ? job.conversationHistory.slice(0, -1) : job.conversationHistory.slice(0, -1);
            
            const historyText = history.length > 0 
                ? history.map((msg: any) => `${msg.role === "user" ? "User" : "Agent"}: ${msg.content}`).join("\n")
                : "No previous conversation.";

            promptText = `SYSTEM INFO:
Working Directory: ${TARGET_DIR}
Contents: ${folderContent}

# CORE OPERATING RULES
1. **Never Hallucinate Actions**: If you say you are creating a file or running a command, you MUST call the tool to do it. Never just describe the outcome.
2. **Mandatory Verification**: After creating a file or running a command, you MUST verify it (e.g., list the directory or read the file) before telling the user it is done.
3. **Be Surgical**: When editing files, find the exact string and replace it. Do not rewrite entire files unless necessary.
4. **Load Skills First**: If a task matches an available skill, call 'load_skill' BEFORE taking any other action.

${pinnedContext}

${preloadedSkills}

# CONVERSATION HISTORY
${historyText}

# CURRENT TASK
${promptText}

IMPORTANT: Focus ONLY on the CURRENT TASK. Verify your work with tools before responding.`;
        } else {
            promptText = `SYSTEM INFO:
Working Directory: ${TARGET_DIR}
Contents: ${folderContent}

# CORE OPERATING RULES
1. **Never Hallucinate Actions**: If you say you are creating a file or running a command, you MUST call the tool to do it. Never just describe the outcome.
2. **Mandatory Verification**: After creating a file or running a command, you MUST verify it (e.g., list the directory or read the file) before telling the user it is done.
3. **Be Surgical**: When editing files, find the exact string and replace it. Do not rewrite entire files unless necessary.
4. **Load Skills First**: If a task matches an available skill, call 'load_skill' BEFORE taking any other action.

${pinnedContext}

${preloadedSkills}

# USER INSTRUCTION
${promptText}

IMPORTANT: Verify your work with tools before responding.`;
        }

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
        if (job.type === "interactive" && !currentAgentText.toLowerCase().includes("completed")) {
            const completionMsg = "\n\n✓ Task completed. Let me know if you need anything else!";
            process.stdout.write(completionMsg);
            currentAgentText += completionMsg;
        }

        // AUTO-MEMORY: Store a brief summary of the work in the Memory note
        try {
            const workSummary = `- [${new Date().toLocaleTimeString()}] Task: ${job.instruction.substring(0, 50)}${job.instruction.length > 50 ? "..." : ""} Status: ${currentAgentText.includes("✓") ? "Success" : "Finished"}`;
            await client.mutation(api.functions.system.appendToSystemNote, {
                title: "Memory",
                content: workSummary
            });
        } catch (e) {
            // Memory note might not exist yet, ignore
        }

        await syncStreamingText(true);
        await client.mutation(api.agent.commitStreamingText, cast({
            jobId: job._id,
            apiKey: API_KEY
        }));
        currentAgentText = "";

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
            result: rpcResult,
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
        currentJobId = null;
        currentSession = null;
        rpcResult = null;
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

    // Stop PTY Manager
    if (ptyManager) {
        ptyManager.shutdown();
    }

    // Stop WebSocket server
    if (wsServer) {
        wsServer.stop();
    }

    if (isBusy && currentJobId && currentSession) {
        console.log(`💾 Saving state for active job...`);
        await syncSessionState(currentSession, currentJobId);
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
