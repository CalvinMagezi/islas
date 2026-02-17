import { v } from "convex/values";
import {
  query,
  mutation,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { getAuthUserId } from "../lib/auth";

// ── Internal: Create a pending approval request ───────────────────────

export const createApproval = internalMutation({
  args: {
    userId: v.string(),
    source: v.union(v.literal("orchestrator"), v.literal("agent")),
    title: v.string(),
    description: v.string(),
    toolName: v.string(),
    toolArgs: v.optional(v.any()),
    riskLevel: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical"),
    ),
    threadId: v.optional(v.string()),
    jobId: v.optional(v.id("agentJobs")),
    workflowId: v.optional(v.string()),
    timeoutMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const timeoutMs = (args.timeoutMinutes ?? 30) * 60 * 1000;

    const approvalId = await ctx.db.insert("approvalRequests", {
      userId: args.userId,
      source: args.source,
      status: "pending",
      title: args.title,
      description: args.description,
      toolName: args.toolName,
      toolArgs: args.toolArgs,
      riskLevel: args.riskLevel,
      threadId: args.threadId,
      jobId: args.jobId,
      workflowId: args.workflowId,
      expiresAt: now + timeoutMs,
      createdAt: now,
      updatedAt: now,
    });

    // Insert a notification so the web UI badge updates
    await ctx.runMutation(internal.functions.notifications.insertNotification, {
      userId: args.userId,
      type: "permission_prompt",
      message: `Approval needed: ${args.title}`,
      title: `${args.riskLevel.toUpperCase()} risk — ${args.toolName}`,
    });

    return { approvalId };
  },
});

// ── Public: Resolve (approve/reject) — Single-user authenticated ───────────

export const resolveApproval = mutation({
  args: {
    approvalId: v.id("approvalRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    const approval = await ctx.db.get(args.approvalId);
    if (!approval) throw new Error("Approval request not found");
    if (approval.userId !== userId) throw new Error("Not authorized");
    if (approval.status !== "pending") {
      throw new Error(`Approval already ${approval.status}`);
    }
    if (approval.expiresAt < Date.now()) {
      await ctx.db.patch(args.approvalId, {
        status: "expired",
        updatedAt: Date.now(),
      });
      throw new Error("Approval request has expired");
    }

    const now = Date.now();
    await ctx.db.patch(args.approvalId, {
      status: args.decision,
      resolvedAt: now,
      resolvedBy: userId,
      rejectionReason: args.rejectionReason,
      updatedAt: now,
    });

    // If this is a workflow-backed approval, send the event
    if (approval.workflowId) {
      if (approval.source === "agent") {
        // Agent workflow (existing approval workflow)
        await ctx.runMutation(
          internal.functions.approvals.sendApprovalEvent,
          {
            workflowId: approval.workflowId,
            approved: args.decision === "approved",
            reason: args.rejectionReason,
          },
        );
      } else if (approval.source === "orchestrator") {
        // Orchestrator workflow (task execution workflow)
        await ctx.runMutation(
          internal.workflows.agentExecutionWorkflow.sendApprovalSignal,
          {
            workflowId: approval.workflowId,
            approved: args.decision === "approved",
            rejectionReason: args.rejectionReason,
          },
        );
      }
    }

    return { status: args.decision };
  },
});

// ── Internal: Send workflow event (called by resolveApproval) ─────────

export const sendApprovalEvent = internalMutation({
  args: {
    workflowId: v.string(),
    approved: v.boolean(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Import the workflow manager and event here to send the event
    const { workflow, approvalDecision } = await import(
      "../workflows/approvalWorkflow"
    );
    await workflow.sendEvent(ctx, {
      workflowId: args.workflowId as any,
      ...approvalDecision,
      value: { approved: args.approved, reason: args.reason },
    });
  },
});

// ── Public queries ────────────────────────────────────────────────────

export const getApproval = query({
  args: { approvalId: v.id("approvalRequests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.approvalId);
  },
});

export const getApprovalInternal = internalQuery({
  args: { approvalId: v.id("approvalRequests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.approvalId);
  },
});

export const listPendingApprovals = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return await ctx.db
      .query("approvalRequests")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "pending"),
      )
      .order("desc")
      .collect();
  },
});

export const pendingApprovalCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const pending = await ctx.db
      .query("approvalRequests")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", "pending"),
      )
      .collect();
    return pending.length;
  },
});

// ── Internal: Resolve approval (for Discord/HTTP — no frontend auth) ────

export const resolveApprovalInternal = internalMutation({
  args: {
    approvalId: v.id("approvalRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    resolvedBy: v.string(),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const approval = await ctx.db.get(args.approvalId);
    if (!approval) throw new Error("Approval request not found");
    if (approval.status !== "pending") return { status: approval.status };

    const now = Date.now();
    await ctx.db.patch(args.approvalId, {
      status: args.decision,
      resolvedAt: now,
      resolvedBy: args.resolvedBy,
      rejectionReason: args.rejectionReason,
      updatedAt: now,
    });

    // If workflow-backed, send the event
    if (approval.workflowId) {
      if (approval.source === "agent") {
        // Agent workflow (existing approval workflow)
        await ctx.runMutation(
          internal.functions.approvals.sendApprovalEvent,
          {
            workflowId: approval.workflowId,
            approved: args.decision === "approved",
            reason: args.rejectionReason,
          },
        );
      } else if (approval.source === "orchestrator") {
        // Orchestrator workflow (task execution workflow)
        await ctx.runMutation(
          internal.workflows.agentExecutionWorkflow.sendApprovalSignal,
          {
            workflowId: approval.workflowId,
            approved: args.decision === "approved",
            rejectionReason: args.rejectionReason,
          },
        );
      }
    }

    return { status: args.decision };
  },
});

// ── Internal: List pending approvals by userId (for Discord bot) ──────

export const listPendingInternal = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    return await ctx.db
      .query("approvalRequests")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", args.userId).eq("status", "pending"),
      )
      .order("desc")
      .take(limit);
  },
});

// ── Cron: Expire stale approvals ──────────────────────────────────────

export const expirePendingApprovals = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.db
      .query("approvalRequests")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .collect();

    let expired = 0;
    for (const approval of pending) {
      if (approval.expiresAt < now) {
        await ctx.db.patch(approval._id, {
          status: "expired",
          updatedAt: now,
        });
        expired++;

        // If workflow-backed, send an error event to unblock it
        if (approval.workflowId) {
          try {
            await ctx.runMutation(
              internal.functions.approvals.sendApprovalExpiredEvent,
              { workflowId: approval.workflowId },
            );
          } catch (err: any) {
            // Expected if workflow already completed or was canceled
            console.warn(
              `Failed to send expiry event for workflow ${approval.workflowId}:`,
              err.message,
            );
          }
        }
      }
    }
    return { expired };
  },
});

export const sendApprovalExpiredEvent = internalMutation({
  args: { workflowId: v.string() },
  handler: async (ctx, args) => {
    const { workflow, approvalDecision } = await import(
      "../workflows/approvalWorkflow"
    );
    await workflow.sendEvent(ctx, {
      workflowId: args.workflowId as any,
      ...approvalDecision,
      value: { approved: false, reason: "Approval request expired" },
    });
  },
});

// ── Public mutation for agent (API-key auth via HTTP) ─────────────────

export const createApprovalFromAgent = internalMutation({
  args: {
    userId: v.string(),
    title: v.string(),
    description: v.string(),
    toolName: v.string(),
    toolArgs: v.optional(v.any()),
    riskLevel: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical"),
    ),
    jobId: v.optional(v.id("agentJobs")),
    timeoutMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{ approvalId: string; workflowId: string }> => {
    // 1. Create the approval row (explicit cast to break circular inference)
    const result = await ctx.runMutation(
      internal.functions.approvals.createApproval as any,
      {
        ...args,
        source: "agent" as const,
      },
    ) as { approvalId: string };

    // 2. Start the durable workflow (as any cast — documented Convex component gotcha)
    const { workflow, agentApproval } = await import("../workflows/approvalWorkflow");
    const workflowId = await workflow.start(ctx, agentApproval as any, {
      args: { approvalId: result.approvalId, jobId: args.jobId },
    });

    // 3. Link workflow ID back to approval
    await ctx.db.patch(result.approvalId as any, {
      workflowId: workflowId as unknown as string,
      updatedAt: Date.now(),
    });

    return { approvalId: result.approvalId, workflowId: workflowId as unknown as string };
  },
});

// ── Query: Get approvals by job ID ───────────────────────────────────

export const getByJob = query({
  args: { jobId: v.id("agentJobs") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db
      .query("approvalRequests")
      .withIndex("by_job", (q) => q.eq("jobId", args.jobId))
      .order("desc")
      .collect();
  },
});
