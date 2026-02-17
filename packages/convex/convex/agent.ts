import { v } from "convex/values";
import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { hashApiKey } from "./lib/cors";

// ==========================================
// WORKER MANAGEMENT
// ==========================================

export const workerHeartbeat = mutation({
    args: {
        workerId: v.string(),
        status: v.union(v.literal("online"), v.literal("offline"), v.literal("busy")),
        apiKey: v.optional(v.string()),
        serializedState: v.optional(v.string()),
        metadata: v.optional(v.any())
    },
    handler: async (ctx, args) => {
        const userId = "local-user";

        const now = Date.now();
        const existing = await ctx.db
            .query("agentSessions")
            .withIndex("by_worker", (q) => q.eq("workerId", args.workerId))
            .unique();

        const patch: any = {
            userId,
            status: args.status,
            lastHeartbeat: now,
        };
        if (args.serializedState !== undefined) patch.serializedState = args.serializedState;
        if (args.metadata !== undefined) patch.metadata = args.metadata;

        if (existing) {
            await ctx.db.patch(existing._id, patch);
        } else {
            await ctx.db.insert("agentSessions", {
                userId: userId,
                workerId: args.workerId,
                status: args.status,
                lastHeartbeat: now,
                serializedState: args.serializedState,
                metadata: args.metadata
            });
        }

        // Schedule a cleanup check if this is an "online" heartbeat
        if (args.status !== "offline") {
            // @ts-ignore — TS2589: deep type instantiation in Convex component system
            await ctx.scheduler.runAfter(30000, internal.agent.checkWorkerTimeout, {
                workerId: args.workerId,
                lastHeartbeat: now
            });
        }
    },
});

/**
 * Internal helper to mark workers as offline if they haven't checked in
 */
export const checkWorkerTimeout = internalMutation({
    args: { workerId: v.string(), lastHeartbeat: v.number() },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("agentSessions")
            .withIndex("by_worker", (q) => q.eq("workerId", args.workerId))
            .unique();
            
        if (session && session.status !== "offline" && session.lastHeartbeat === args.lastHeartbeat) {
            // No new heartbeat has arrived since this check was scheduled
            console.log(`Worker timeout: marking ${args.workerId} as offline`);
            await ctx.db.patch(session._id, { status: "offline" });
        }
    },
});

export const getWorkerStats = query({
    args: { workerId: v.string() },
    handler: async (ctx, args) => {
        const jobs = await ctx.db
            .query("agentJobs")
            .withIndex("by_worker", (q) => q.eq("workerId", args.workerId))
            .collect();

        let totalJobs = jobs.length;
        let completedJobs = 0;
        let failedJobs = 0;
        let cancelledJobs = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        let totalCost = 0;
        let totalToolCalls = 0;

        for (const job of jobs) {
            if (job.status === "done") completedJobs++;
            else if (job.status === "failed") failedJobs++;
            else if (job.status === "cancelled") cancelledJobs++;

            if (job.stats) {
                totalInputTokens += job.stats.tokens.input;
                totalOutputTokens += job.stats.tokens.output;
                totalCost += job.stats.cost;
                totalToolCalls += job.stats.toolCalls;
            }
        }

        return {
            workerId: args.workerId,
            totalJobs,
            completedJobs,
            failedJobs,
            cancelledJobs,
            successRate: totalJobs > 0 ? completedJobs / totalJobs : 0,
            tokens: {
                input: totalInputTokens,
                output: totalOutputTokens,
                total: totalInputTokens + totalOutputTokens,
            },
            totalCost,
            totalToolCalls,
        };
    },
});

// ==========================================
// SKILL REGISTRY
// ==========================================

export const syncSkills = mutation({
    args: {
        workerId: v.string(),
        skills: v.array(v.object({
            name: v.string(),
            description: v.optional(v.string()),
        })),
        apiKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        // Get existing skills for this worker
        const existing = await ctx.db
            .query("skills")
            .withIndex("by_worker", (q) => q.eq("workerId", args.workerId))
            .collect();

        const existingByName = new Map(existing.map(s => [s.name, s]));
        const incomingNames = new Set(args.skills.map(s => s.name));

        // Upsert incoming skills
        for (const skill of args.skills) {
            const prev = existingByName.get(skill.name);
            if (prev) {
                await ctx.db.patch(prev._id, {
                    description: skill.description,
                    lastSeen: now,
                });
            } else {
                await ctx.db.insert("skills", {
                    workerId: args.workerId,
                    name: skill.name,
                    description: skill.description,
                    lastSeen: now,
                });
            }
        }

        // Remove skills no longer present
        for (const prev of existing) {
            if (!incomingNames.has(prev.name)) {
                await ctx.db.delete(prev._id);
            }
        }
    },
});

export const getSkills = query({
    args: { workerId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        if (args.workerId) {
            return await ctx.db
                .query("skills")
                .withIndex("by_worker", (q) => q.eq("workerId", args.workerId!))
                .collect();
        }
        // Return all skills across all workers
        return await ctx.db.query("skills").collect();
    },
});

// ==========================================
// JOB QUEUE
// ==========================================

export const getPendingJob = query({
    args: {
        workerId: v.string(),
        apiKey: v.optional(v.string()),
        workerSecret: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Validate worker secret if configured
        const expectedSecret = process.env.WORKER_SECRET;
        if (expectedSecret && args.workerSecret !== expectedSecret) {
            throw new Error("Invalid worker secret - unauthorized agent");
        }

        // Bypass identity check for local use
        const userId = "local-user";

        // Check if worker already has a job
        const session = await ctx.db
            .query("agentSessions")
            .withIndex("by_worker", (q) => q.eq("workerId", args.workerId))
            .unique();

        if (session?.currentJobId) {
            const job = await ctx.db.get(session.currentJobId);
            if (job && (job.status === "pending" || job.status === "running" || job.status === "waiting_for_user")) {
                return job;
            }
        }

        // Pick up jobs for the local user, sorted by priority (higher first)
        const candidates = await ctx.db
            .query("agentJobs")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .filter((q) =>
                q.or(
                    // Any worker can pick up a brand new job
                    q.eq(q.field("status"), "pending"),
                    // But for running/waiting jobs, ONLY the assigned worker can see/resume it
                    q.and(
                        q.or(
                            q.eq(q.field("status"), "running"),
                            q.eq(q.field("status"), "waiting_for_user")
                        ),
                        q.eq(q.field("workerId"), args.workerId)
                    )
                )
            )
            .collect();

        if (candidates.length === 0) return null;

        // Sort: running/waiting first (resume), then by priority DESC, then createdAt ASC
        candidates.sort((a, b) => {
            // Running/waiting jobs for this worker always take precedence
            const aActive = a.status === "running" || a.status === "waiting_for_user" ? 1 : 0;
            const bActive = b.status === "running" || b.status === "waiting_for_user" ? 1 : 0;
            if (aActive !== bActive) return bActive - aActive;
            // Higher priority first
            const aPri = a.priority ?? 50;
            const bPri = b.priority ?? 50;
            if (aPri !== bPri) return bPri - aPri;
            // Oldest first (FIFO within same priority)
            return a.createdAt - b.createdAt;
        });

        return candidates[0];
    },
});

export const updateJobStatus = mutation({
    args: {
        jobId: v.id("agentJobs"),
        status: v.union(v.literal("pending"), v.literal("running"), v.literal("waiting_for_user"), v.literal("done"), v.literal("failed"), v.literal("cancelled")),
        workerId: v.optional(v.string()),
        apiKey: v.optional(v.string()),
        recoveryPoint: v.optional(v.any()),
        result: v.optional(v.any()),
        conversationHistory: v.optional(v.array(v.object({
            role: v.union(v.literal("user"), v.literal("agent")),
            content: v.string(),
            timestamp: v.number(),
        }))),
        stats: v.optional(v.object({
            tokens: v.object({
                input: v.number(),
                output: v.number(),
                cacheRead: v.number(),
                total: v.number(),
            }),
            cost: v.number(),
            toolCalls: v.number(),
            messages: v.number(),
        })),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const job = await ctx.db.get(args.jobId);
        if (!job) throw new Error("Job not found");

        // RACE CONDITION PROTECTION:
        // If moving to 'running', ensure nobody else claimed it while we were polling
        if (args.status === "running" && job.status === "running" && job.workerId !== args.workerId) {
            console.warn(`Blocked concurrent job claim: ${args.jobId} is already being handled by ${job.workerId}`);
            throw new Error("Job already claimed by another worker");
        }

        const patch: any = { status: args.status, updatedAt: now };
        if (args.workerId) patch.workerId = args.workerId;
        if (args.recoveryPoint) patch.recoveryPoint = args.recoveryPoint;
        if (args.result !== undefined) patch.result = args.result;
        if (args.conversationHistory !== undefined) patch.conversationHistory = args.conversationHistory;
        if (args.stats !== undefined) patch.stats = args.stats;

        await ctx.db.patch(args.jobId, patch);

        // Update worker session
        if (args.workerId) {
            const session = await ctx.db
                .query("agentSessions")
                .withIndex("by_worker", (q) => q.eq("workerId", args.workerId!))
                .unique();

            if (session) {
                await ctx.db.patch(session._id, {
                    currentJobId: args.status === "done" || args.status === "failed" || args.status === "cancelled" ? undefined : args.jobId,
                    status: args.status === "running" ? "busy" : "online",
                });
            }
        }
    },
});

export const cancelJob = mutation({
    args: {
        jobId: v.id("agentJobs"),
        apiKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const job = await ctx.db.get(args.jobId);
        if (!job) throw new Error("Job not found");

        if (job.status === "running" || job.status === "waiting_for_user" || job.status === "pending") {
            await ctx.db.patch(args.jobId, {
                status: "cancelled",
                updatedAt: Date.now(),
            });
            return { ok: true, previousStatus: job.status };
        }

        return { ok: false, reason: `Job is already ${job.status}` };
    },
});

export const steerJob = mutation({
    args: {
        jobId: v.id("agentJobs"),
        message: v.string(),
        apiKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const job = await ctx.db.get(args.jobId);
        if (!job) throw new Error("Job not found");

        if (job.status !== "running") {
            return { ok: false, reason: `Job is not running (status: ${job.status})` };
        }

        await ctx.db.patch(args.jobId, {
            steeringMessage: args.message,
            updatedAt: Date.now(),
        });
        return { ok: true };
    },
});

export const addJobLog = mutation({
    args: {
        jobId: v.id("agentJobs"),
        type: v.union(
            v.literal("thought"),
            v.literal("tool_call"),
            v.literal("tool_result"),
            v.literal("error"),
            v.literal("info"),
            v.literal("message_start"),
            v.literal("message_delta"),
            v.literal("message_stop"),
            v.literal("message_update"),
            v.literal("message_end"),
            v.literal("turn_start"),
            v.literal("turn_end"),
            v.literal("tool_execution_start"),
            v.literal("tool_execution_end"),
            v.literal("tool_execution_update"),
            v.literal("agent_start"),
            v.literal("agent_stop"),
            v.literal("agent_end"), // Added
            v.literal("auto_compaction_start"),
            v.literal("auto_compaction_end"),
            v.literal("auto_retry_start"),
            v.literal("auto_retry_end"),
            v.literal("context_usage"),
            v.literal("warning")
        ),
        content: v.string(),
        metadata: v.optional(v.any()),
        apiKey: v.optional(v.string())
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("jobLogs", {
            jobId: args.jobId,
            type: args.type,
            content: args.content,
            metadata: args.metadata,
            timestamp: Date.now(),
        });
    },
});

export const createJob = mutation({
    args: {
        instruction: v.string(),
        threadId: v.optional(v.string()),
        type: v.optional(v.union(v.literal("background"), v.literal("rpc"), v.literal("interactive"))),
        apiKey: v.optional(v.string()),
        priority: v.optional(v.number()),
        securityProfile: v.optional(v.union(v.literal("minimal"), v.literal("standard"), v.literal("guarded"), v.literal("admin"))),
        modelOverride: v.optional(v.string()),
        thinkingLevel: v.optional(v.union(v.literal("off"), v.literal("minimal"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("xhigh"))),
        initialHistory: v.optional(v.array(v.object({
            role: v.union(v.literal("user"), v.literal("agent")),
            content: v.string(),
            timestamp: v.number(),
        })))
    },
    handler: async (ctx, args) => {
        const userId = "local-user";
        const now = Date.now();

        // Use provided history or start fresh
        const conversationHistory = args.initialHistory || [];

        // Add the NEW user instruction to the history
        conversationHistory.push({
            role: "user" as const,
            content: args.instruction,
            timestamp: now,
        });

        return await ctx.db.insert("agentJobs", {
            userId: userId,
            instruction: args.instruction,
            type: args.type || "background",
            status: "pending",
            priority: args.priority,
            threadId: args.threadId,
            securityProfile: args.securityProfile,
            modelOverride: args.modelOverride,
            thinkingLevel: args.thinkingLevel,
            conversationHistory,
            createdAt: now,
            updatedAt: now,
        });
    },
});

/**
 * Internal job creation for HTTP action endpoints (CLI, webhooks).
 * Same logic as createJob but callable from httpAction via internal.agent.createJobInternal.
 */
export const createJobInternal = internalMutation({
    args: {
        userId: v.string(),
        instruction: v.string(),
        threadId: v.optional(v.string()),
        type: v.optional(v.union(v.literal("background"), v.literal("rpc"), v.literal("interactive"))),
        priority: v.optional(v.number()),
        securityProfile: v.optional(v.union(v.literal("minimal"), v.literal("standard"), v.literal("guarded"), v.literal("admin"))),
        modelOverride: v.optional(v.string()),
        thinkingLevel: v.optional(v.union(v.literal("off"), v.literal("minimal"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("xhigh"))),
        discordChannelId: v.optional(v.string()),
        discordIsDM: v.optional(v.boolean()),
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const conversationHistory = [{
            role: "user" as const,
            content: args.instruction,
            timestamp: now,
        }];

        return await ctx.db.insert("agentJobs", {
            userId: args.userId,
            instruction: args.instruction,
            type: args.type || "background",
            status: "pending",
            priority: args.priority,
            threadId: args.threadId,
            securityProfile: args.securityProfile,
            modelOverride: args.modelOverride,
            thinkingLevel: args.thinkingLevel,
            discordChannelId: args.discordChannelId,
            discordIsDM: args.discordIsDM,
            conversationHistory,
            createdAt: now,
            updatedAt: now,
        });
    },
});

/**
 * Create a follow-up job after a recoverable failure.
 * Preserves userId, type, threadId, and the last 5 conversation history entries.
 * Prepends a [RECOVERY] prefix to the instruction with the failure reason.
 */
export const createFollowUpJob = mutation({
    args: {
        originalJobId: v.id("agentJobs"),
        reason: v.string(),
        apiKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const original = await ctx.db.get(args.originalJobId);
        if (!original) throw new Error("Original job not found");

        const now = Date.now();

        // Keep only last 5 conversation history entries to avoid bloat
        const history = (original.conversationHistory ?? []).slice(-5);

        const instruction = `[RECOVERY] Previous attempt failed: ${args.reason}\n\nOriginal task:\n${original.instruction}`;

        const newJobId = await ctx.db.insert("agentJobs", {
            userId: original.userId,
            instruction,
            type: original.type,
            status: "pending",
            threadId: original.threadId,
            conversationHistory: history,
            createdAt: now,
            updatedAt: now,
        });

        // Log handover on original job
        await ctx.db.insert("jobLogs", {
            jobId: args.originalJobId,
            type: "info",
            content: `Created follow-up job ${newJobId} due to: ${args.reason}`,
            timestamp: now,
        });

        return newJobId;
    },
});

/**
 * Agent-only: Update the real-time streaming text for a job
 */
export const updateJobStreamingText = mutation({
    args: {
        jobId: v.id("agentJobs"),
        text: v.string(),
        apiKey: v.optional(v.string()), // Made optional
    },
    handler: async (ctx, args) => {
        // Bypass auth for local use
        await ctx.db.patch(args.jobId, {
            streamingText: args.text,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Agent-only: Commit streaming text to conversation history and clear it
 */
export const commitStreamingText = mutation({
    args: {
        jobId: v.id("agentJobs"),
        apiKey: v.optional(v.string()), // Made optional
    },
    handler: async (ctx, args) => {
        // Bypass auth for local use
        const job = await ctx.db.get(args.jobId);
        if (!job || !job.streamingText) return;

        const conversationHistory = job.conversationHistory || [];
        conversationHistory.push({
            role: "agent" as const,
            content: job.streamingText,
            timestamp: Date.now(),
        });

        await ctx.db.patch(args.jobId, {
            conversationHistory,
            streamingText: undefined,
            updatedAt: Date.now(),
        });
    },
});

export const getJob = query({
    args: { jobId: v.optional(v.id("agentJobs")) },
    handler: async (ctx, args) => {
        if (!args.jobId) return null;
        return await ctx.db.get(args.jobId);
    },
});

/** Internal job lookup for HTTP action endpoints. */
export const getJobInternal = internalQuery({
    args: { jobId: v.id("agentJobs") },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.jobId);
    },
});

export const getCompletedDiscordJobs = internalQuery({
    args: { userId: v.string() },
    handler: async (ctx, args) => {
        // Get jobs that are done/failed, have Discord context, and haven't been notified yet
        const jobs = await ctx.db
            .query("agentJobs")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .filter((q) =>
                q.and(
                    q.or(
                        q.eq(q.field("status"), "done"),
                        q.eq(q.field("status"), "failed")
                    ),
                    q.neq(q.field("discordChannelId"), undefined),
                    q.neq(q.field("discordNotified"), true)
                )
            )
            .order("desc")
            .take(20);

        return jobs.map((job) => {
            // Extract last agent response from conversationHistory if streamingText is empty
            let responseText = job.streamingText;
            if (!responseText && job.conversationHistory) {
                const lastAgentMessage = job.conversationHistory
                    .filter((msg: any) => msg.role === "agent")
                    .pop();
                if (lastAgentMessage) {
                    responseText = lastAgentMessage.content;
                }
            }

            return {
                jobId: job._id,
                status: job.status,
                instruction: job.instruction,
                result: job.result,
                streamingText: responseText,
                discordChannelId: job.discordChannelId,
                discordIsDM: job.discordIsDM,
                createdAt: job.createdAt,
                updatedAt: job.updatedAt,
            };
        });
    },
});

/** Mark a Discord job as notified so it won't be re-sent on restart. */
export const markDiscordNotified = internalMutation({
    args: { jobId: v.id("agentJobs") },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.jobId, { discordNotified: true });
    },
});

export const cancelJobInternal = internalMutation({
    args: { jobId: v.id("agentJobs") },
    handler: async (ctx, args) => {
        const job = await ctx.db.get(args.jobId);
        if (!job) return { ok: false, reason: "Job not found" };

        if (job.status === "running" || job.status === "waiting_for_user" || job.status === "pending") {
            await ctx.db.patch(args.jobId, {
                status: "cancelled",
                updatedAt: Date.now(),
            });
            return { ok: true, previousStatus: job.status };
        }

        return { ok: false, reason: `Job is already ${job.status}` };
    },
});

export const steerJobInternal = internalMutation({
    args: { jobId: v.id("agentJobs"), message: v.string() },
    handler: async (ctx, args) => {
        const job = await ctx.db.get(args.jobId);
        if (!job) return { ok: false, reason: "Job not found" };

        if (job.status !== "running") {
            return { ok: false, reason: `Job is not running (status: ${job.status})` };
        }

        await ctx.db.patch(args.jobId, {
            steeringMessage: args.message,
            updatedAt: Date.now(),
        });
        return { ok: true };
    },
});

export const clearSteeringMessage = mutation({
    args: { jobId: v.id("agentJobs"), apiKey: v.optional(v.string()) },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.jobId, {
            steeringMessage: undefined,
            updatedAt: Date.now(),
        });
    },
});

export const updateJobThinkingLevel = mutation({
    args: {
        jobId: v.id("agentJobs"),
        thinkingLevel: v.union(v.literal("off"), v.literal("minimal"), v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("xhigh")),
        apiKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const job = await ctx.db.get(args.jobId);
        if (!job) throw new Error("Job not found");
        await ctx.db.patch(args.jobId, {
            thinkingLevel: args.thinkingLevel,
            updatedAt: Date.now(),
        });
    },
});

export const getJobLogs = query({
    args: { jobId: v.optional(v.id("agentJobs")) },
    handler: async (ctx, args) => {
        if (!args.jobId) return [];
        const logs = await ctx.db
            .query("jobLogs")
            .withIndex("by_job", (q) => q.eq("jobId", args.jobId!))
            .order("asc")
            .collect();
        return logs;
    },
});

export const getActiveJobForThread = query({
    args: { threadId: v.optional(v.string()) },
    handler: async (ctx, args) => {
        if (!args.threadId) return null;
        const userId = "local-user";

        return await ctx.db
            .query("agentJobs")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .filter((q) =>
                q.and(
                    q.eq(q.field("threadId"), args.threadId),
                    q.or(
                        q.eq(q.field("status"), "pending"),
                        q.eq(q.field("status"), "running"),
                        q.eq(q.field("status"), "waiting_for_user")
                    )
                )
            )
            .order("desc") // newest first
            .first();
    },
});

// Get current worker session for the user
export const getWorkerStatus = query({
    args: {},
    handler: async (ctx) => {
        const userId = "local-user";

        // Try to find a worker for this user first
        let session = await ctx.db
            .query("agentSessions")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc")
            .first();

        // If not found, fall back to "system" worker (common for local dev)
        if (!session) {
            session = await ctx.db
                .query("agentSessions")
                .withIndex("by_user", (q) => q.eq("userId", "system"))
                .order("desc")
                .first();
        }

        if (!session) return { status: "offline" };

        return { 
            status: session.status, 
            lastHeartbeat: session.lastHeartbeat,
            workerId: session.workerId,
            metadata: session.metadata
        };
    },
});

// Send a message to an interactive job that's waiting for user input
export const sendMessageToJob = mutation({
    args: {
        jobId: v.id("agentJobs"),
        message: v.string(),
    },
    handler: async (ctx, args) => {
        const userId = "local-user";

        const job = await ctx.db.get(args.jobId);
        if (!job) throw new Error("Job not found");
        if (job.userId !== userId) throw new Error("Not authorized for this job");
        
        const validStatuses = ["waiting_for_user", "done", "failed"];
        if (!validStatuses.includes(job.status)) {
            throw new Error(`Cannot send message to job in status: ${job.status}`);
        }

        const now = Date.now();
        
        // Get existing conversation history or create new
        const conversationHistory = job.conversationHistory || [];
        
        // Add user message to conversation
        conversationHistory.push({
            role: "user",
            content: args.message,
            timestamp: now,
        });

        // Update job with the message and change status back to running
        await ctx.db.patch(args.jobId, {
            status: "running",
            pendingUserMessage: args.message,
            conversationHistory,
            updatedAt: now,
        });

        // Also add to job logs for visibility
        await ctx.db.insert("jobLogs", {
            jobId: args.jobId,
            type: "info",
            content: `User: ${args.message}`,
            timestamp: now,
        });

        return { success: true };
    },
});

// Get conversation history for a job
export const getJobConversation = query({
    args: { jobId: v.id("agentJobs") },
    handler: async (ctx, args) => {
        const userId = "local-user";

        const job = await ctx.db.get(args.jobId);
        if (!job) throw new Error("Job not found");
        if (job.userId !== userId) throw new Error("Not authorized for this job");

        return job.conversationHistory || [];
    },
});

// List all jobs for current user (for conversation history UI)
export const listUserJobs = query({
    args: {
        limit: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const userId = "local-user";

        const jobs = await ctx.db
            .query("agentJobs")
            .withIndex("by_user", (q) => q.eq("userId", userId))
            .order("desc") // Newest first
            .take(args.limit || 50);

        return jobs;
    },
});

// ==========================================
// TERMINAL SESSIONS (Orchestration)
// ==========================================

/**
 * Create a new terminal session record in the database.
 * Called by the agent when spawning a PTY.
 */
export const createTerminalSession = mutation({
    args: {
        jobId: v.id("agentJobs"),
        sessionId: v.string(),
        workerId: v.string(),
        shellType: v.union(v.literal("bash"), v.literal("zsh"), v.literal("sh")),
        cwd: v.string(),
        securityProfile: v.union(
            v.literal("minimal"),
            v.literal("standard"),
            v.literal("guarded"),
            v.literal("admin")
        ),
        rows: v.number(),
        cols: v.number(),
        pid: v.optional(v.number()),
        apiKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = "local-user";
        const now = Date.now();

        return await ctx.db.insert("terminalSessions", {
            jobId: args.jobId,
            userId,
            workerId: args.workerId,
            sessionId: args.sessionId,
            shellType: args.shellType,
            cwd: args.cwd,
            status: "starting",
            pid: args.pid,
            rows: args.rows,
            cols: args.cols,
            commandCount: 0,
            lastActivity: now,
            createdAt: now,
            securityProfile: args.securityProfile,
        });
    },
});

/**
 * Update terminal session status.
 */
export const updateTerminalStatus = mutation({
    args: {
        sessionId: v.string(),
        status: v.union(
            v.literal("starting"),
            v.literal("running"),
            v.literal("exited"),
            v.literal("error")
        ),
        exitCode: v.optional(v.number()),
        commandCount: v.optional(v.number()),
        apiKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const session = await ctx.db
            .query("terminalSessions")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .unique();

        if (!session) {
            throw new Error(`Terminal session not found: ${args.sessionId}`);
        }

        const patch: any = {
            status: args.status,
            lastActivity: Date.now(),
        };

        if (args.exitCode !== undefined) patch.exitCode = args.exitCode;
        if (args.commandCount !== undefined) patch.commandCount = args.commandCount;

        await ctx.db.patch(session._id, patch);
    },
});

/**
 * Get all terminal sessions for a job.
 */
export const getTerminalSessions = query({
    args: { jobId: v.id("agentJobs") },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("terminalSessions")
            .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
            .collect();
    },
});

/**
 * Get a single terminal session by sessionId.
 */
export const getTerminalSession = query({
    args: { sessionId: v.string() },
    handler: async (ctx, args) => {
        return await ctx.db
            .query("terminalSessions")
            .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
            .unique();
    },
});

/**
 * Create a one-time token for WebSocket terminal authentication.
 * Token is valid for 60 seconds and can only be used once.
 */
export const createTerminalToken = mutation({
    args: { jobId: v.id("agentJobs") },
    handler: async (ctx, args) => {
        const userId = "local-user";
        const now = Date.now();
        const expiresAt = now + 60 * 1000; // 60 seconds

        // Generate a random token (32 bytes = 64 hex chars)
        const token = Array.from({ length: 32 }, () =>
            Math.floor(Math.random() * 16).toString(16)
        ).join("");

        await ctx.db.insert("terminalTokens", {
            token,
            jobId: args.jobId,
            userId,
            expiresAt,
            used: false,
        });

        return { token };
    },
});

/**
 * Validate a terminal token (called by agent WebSocket server).
 */
export const validateTerminalToken = query({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const record = await ctx.db
            .query("terminalTokens")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();

        if (!record) {
            return { valid: false, reason: "Token not found" };
        }

        if (record.used) {
            return { valid: false, reason: "Token already used" };
        }

        if (Date.now() > record.expiresAt) {
            return { valid: false, reason: "Token expired" };
        }

        return {
            valid: true,
            jobId: record.jobId,
            userId: record.userId,
        };
    },
});

/**
 * Consume a terminal token (mark as used).
 */
export const consumeTerminalToken = mutation({
    args: { token: v.string() },
    handler: async (ctx, args) => {
        const record = await ctx.db
            .query("terminalTokens")
            .withIndex("by_token", (q) => q.eq("token", args.token))
            .unique();

        if (!record) {
            throw new Error("Token not found");
        }

        await ctx.db.patch(record._id, { used: true });
    },
});

/**
 * Cleanup idle terminal sessions (called by cron).
 */
export const cleanupIdleTerminals = internalMutation({
    args: { maxIdleMs: v.number() },
    handler: async (ctx, args) => {
        const now = Date.now();
        const cutoff = now - args.maxIdleMs;

        // Find idle sessions
        const idleSessions = await ctx.db
            .query("terminalSessions")
            .withIndex("by_status", (q) => q.eq("status", "running"))
            .filter((q) => q.lt(q.field("lastActivity"), cutoff))
            .collect();

        // Mark them as exited with timeout code
        for (const session of idleSessions) {
            await ctx.db.patch(session._id, {
                status: "exited",
                exitCode: 124, // Standard timeout exit code
            });
        }

        return { cleaned: idleSessions.length };
    },
});

/**
 * Cleanup expired terminal tokens (called by cron).
 */
export const cleanupExpiredTokens = internalMutation({
    args: {},
    handler: async (ctx) => {
        const now = Date.now();
        const expired = await ctx.db
            .query("terminalTokens")
            .withIndex("by_expiry", (q) => q.lt("expiresAt", now))
            .collect();

        for (const token of expired) {
            await ctx.db.delete(token._id);
        }

        return { cleaned: expired.length };
    },
});

// ==========================================
// ORCHESTRATION: Task Plans & DAG Execution
// ==========================================

/**
 * Update task plan for a job (used by orchestrator).
 */
export const updateTaskPlan = mutation({
    args: {
        jobId: v.id("agentJobs"),
        taskPlan: v.object({
            tasks: v.array(v.object({
                id: v.string(),
                description: v.string(),
                command: v.string(),
                cwd: v.optional(v.string()),
                dependencies: v.array(v.string()),
                terminalId: v.optional(v.string()),
                status: v.union(
                    v.literal("pending"),
                    v.literal("running"),
                    v.literal("completed"),
                    v.literal("failed")
                ),
            })),
            verificationChecks: v.optional(v.array(v.object({
                type: v.union(
                    v.literal("file_exists"),
                    v.literal("command_output"),
                    v.literal("port_listening")
                ),
                args: v.any(),
                expected: v.any(),
            }))),
        }),
        apiKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.jobId, {
            taskPlan: args.taskPlan,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Update a specific task within a job's task plan.
 */
export const updateTask = mutation({
    args: {
        jobId: v.id("agentJobs"),
        taskId: v.string(),
        status: v.optional(v.union(
            v.literal("pending"),
            v.literal("running"),
            v.literal("completed"),
            v.literal("failed")
        )),
        terminalId: v.optional(v.string()),
        apiKey: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const job = await ctx.db.get(args.jobId);
        if (!job || !job.taskPlan) {
            throw new Error("Job or task plan not found");
        }

        const tasks = job.taskPlan.tasks;
        const taskIndex = tasks.findIndex((t) => t.id === args.taskId);

        if (taskIndex === -1) {
            throw new Error(`Task not found: ${args.taskId}`);
        }

        // Update the task
        if (args.status !== undefined) {
            tasks[taskIndex].status = args.status;
        }
        if (args.terminalId !== undefined) {
            tasks[taskIndex].terminalId = args.terminalId;
        }

        // Save updated plan
        await ctx.db.patch(args.jobId, {
            taskPlan: {
                tasks,
                verificationChecks: job.taskPlan.verificationChecks,
            },
            updatedAt: Date.now(),
        });
    },
});

/**
 * Get task plan for a job.
 */
export const getTaskPlan = query({
    args: { jobId: v.id("agentJobs") },
    handler: async (ctx, args) => {
        const job = await ctx.db.get(args.jobId);
        if (!job) {
            throw new Error("Job not found");
        }
        return job.taskPlan || null;
    },
});
