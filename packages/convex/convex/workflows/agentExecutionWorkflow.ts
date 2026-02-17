/**
 * Agent Execution Workflow - Durable pause/resume for orchestration tasks
 *
 * Purpose: Wrap agent task execution in a Convex workflow to enable:
 * - Durable state (survives agent crashes)
 * - Pause/resume at arbitrary points
 * - Approval gates that truly pause (not just block)
 * - Better error recovery
 */

import { WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// Initialize workflow manager with the workflow component
const workflows = new WorkflowManager(components.workflow);

// ── Workflow Input ─────────────────────────────────────────────────

export interface AgentExecutionInput {
    jobId: Id<"agentJobs">;
    taskId: string;
    command: string;
    cwd: string;
    securityProfile: "minimal" | "standard" | "guarded" | "admin";
}

// ── Workflow State ─────────────────────────────────────────────────

export interface AgentExecutionState {
    status: "initializing" | "running" | "paused" | "completed" | "failed";
    pauseReason?: "approval_required" | "error" | "manual" | "rate_limit";
    currentStep?: string;
    approvalRequestId?: Id<"approvalRequests">;
    error?: string;
    resumeCount: number;
    startedAt: number;
    lastActivityAt: number;
}

// ── Workflow Definition ────────────────────────────────────────────

export const agentExecutionWorkflow = workflows.define({
    args: {
        jobId: v.id("agentJobs"),
        taskId: v.string(),
        command: v.string(),
        cwd: v.string(),
        securityProfile: v.union(
            v.literal("minimal"),
            v.literal("standard"),
            v.literal("guarded"),
            v.literal("admin")
        ),
        approvalId: v.optional(v.id("approvalRequests")), // Pre-created approval ID (if needed)
    },

    handler: async (step, args): Promise<{ success: boolean; output?: string; error?: string }> => {
        const now = Date.now();

        // Step 1: Initialize workflow state
        await step.runMutation(internal.workflows.agentExecutionWorkflow.initializeState, {
            jobId: args.jobId,
            taskId: args.taskId,
        });

        // Step 2: Check if approval required (approval already created if needed)
        if (args.approvalId) {
            // Log approval wait
            await step.runMutation(internal.workflows.agentExecutionWorkflow.logApprovalWait, {
                jobId: args.jobId,
                approvalId: args.approvalId,
            });

            // Pause workflow until approval resolved
            // Note: Approval expiration is handled by the approval system itself
            await step.awaitEvent({
                name: "approval_resolved",
            });

            // Check approval status
            const approvalStatus = await step.runQuery(
                internal.workflows.agentExecutionWorkflow.getApprovalStatus,
                {
                    approvalId: args.approvalId,
                }
            );

            if (!approvalStatus.approved) {
                // Approval rejected or expired
                await step.runMutation(internal.workflows.agentExecutionWorkflow.markFailed, {
                    jobId: args.jobId,
                    taskId: args.taskId,
                    error: approvalStatus.rejectionReason || "Approval denied",
                });

                return {
                    success: false,
                    error: "Command execution rejected by user",
                };
            }
        }

        // Step 4: Execute command (delegated to agent)
        const executionResult = await step.runAction(
            internal.workflows.agentExecutionWorkflow.executeCommand,
            {
                jobId: args.jobId,
                taskId: args.taskId,
                command: args.command,
                cwd: args.cwd,
                securityProfile: args.securityProfile,
            }
        );

        // Step 5: Mark task as completed or failed
        if (executionResult.success) {
            await step.runMutation(internal.workflows.agentExecutionWorkflow.markCompleted, {
                jobId: args.jobId,
                taskId: args.taskId,
                output: executionResult.output,
            });

            return { success: true, output: executionResult.output };
        } else {
            await step.runMutation(internal.workflows.agentExecutionWorkflow.markFailed, {
                jobId: args.jobId,
                taskId: args.taskId,
                error: executionResult.error || "Unknown error",
            });

            return { success: false, error: executionResult.error };
        }
    },
});

// ── Workflow Helper Functions ──────────────────────────────────────

/**
 * Signal a workflow to resume after approval
 */
import type { MutationCtx } from "../_generated/server";

export async function resumeWorkflowAfterApproval(
    ctx: MutationCtx,
    workflowId: string,
    approved: boolean,
    rejectionReason?: string
): Promise<void> {
    await ctx.scheduler.runAfter(0, internal.workflows.agentExecutionWorkflow.sendApprovalSignal, {
        workflowId,
        approved,
        rejectionReason,
    });
}

// ── Workflow Helper Functions (Internal) ───────────────────────────

import { internalMutation, internalQuery, internalAction } from "../_generated/server";

/**
 * Initialize workflow state
 */
export const initializeState = internalMutation({
    args: {
        jobId: v.id("agentJobs"),
        taskId: v.string(),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        // Update task status to "running"
        const job = await ctx.db.get(args.jobId);
        if (!job || !job.taskPlan) return;

        const tasks = job.taskPlan.tasks;
        const taskIndex = tasks.findIndex((t) => t.id === args.taskId);
        if (taskIndex !== -1) {
            tasks[taskIndex].status = "running";
            await ctx.db.patch(args.jobId, {
                taskPlan: { tasks, verificationChecks: job.taskPlan.verificationChecks },
                updatedAt: now,
            });
        }
    },
});

/**
 * Analyze command risk (uses existing spawn hook patterns for now)
 */
export const analyzeCommandRisk = internalAction({
    args: {
        command: v.string(),
        cwd: v.string(),
        securityProfile: v.union(
            v.literal("minimal"),
            v.literal("standard"),
            v.literal("guarded"),
            v.literal("admin")
        ),
    },
    handler: async (ctx, args): Promise<{
        requiresApproval: boolean;
        riskLevel: "low" | "medium" | "high" | "critical";
        reasoning: string;
    }> => {
        // Import dangerous patterns
        const dangerousPatterns = [
            { pattern: /\brm\s+(-[a-zA-Z]*r[a-zA-Z]*f|--recursive|--force)\b/i, level: "critical" as const, reason: "Recursive forced deletion" },
            { pattern: /\bsudo\b/i, level: "high" as const, reason: "Privilege escalation" },
            { pattern: /\bgit\s+push\s+--force\b/i, level: "high" as const, reason: "Force push to remote" },
            { pattern: /\bdrop\s+table\b/i, level: "critical" as const, reason: "Database table deletion" },
            { pattern: /\bchmod\s+777\b/, level: "medium" as const, reason: "Insecure permissions" },
        ];

        // Check for dangerous patterns
        for (const { pattern, level, reason } of dangerousPatterns) {
            if (pattern.test(args.command)) {
                // GUARDED profile requires approval for dangerous commands
                const requiresApproval = args.securityProfile === "guarded";
                return {
                    requiresApproval,
                    riskLevel: level,
                    reasoning: reason,
                };
            }
        }

        // Safe command
        return {
            requiresApproval: false,
            riskLevel: "low",
            reasoning: "No dangerous patterns detected",
        };
    },
});

/**
 * Create approval request for dangerous command (with workflow linking)
 */
export const createApprovalRequest = internalMutation({
    args: {
        jobId: v.id("agentJobs"),
        taskId: v.string(),
        command: v.string(),
        riskLevel: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
        reasoning: v.string(),
        workflowId: v.optional(v.string()), // Link to workflow for signal delivery
    },
    handler: async (ctx, args) => {
        const now = Date.now();
        const expiresAt = now + 30 * 60 * 1000; // 30 minutes

        const approvalId = await ctx.db.insert("approvalRequests", {
            userId: "local-user",
            source: "orchestrator",
            status: "pending",
            title: `Dangerous Command: ${args.taskId}`,
            description: args.reasoning,
            toolName: "bash",
            toolArgs: { command: args.command },
            riskLevel: args.riskLevel,
            jobId: args.jobId,
            workflowId: args.workflowId, // Store workflow ID for signal delivery
            expiresAt,
            createdAt: now,
            updatedAt: now,
        });

        return { approvalId };
    },
});

/**
 * Get approval status
 */
export const getApprovalStatus = internalQuery({
    args: {
        approvalId: v.id("approvalRequests"),
    },
    handler: async (ctx, args) => {
        const approval = await ctx.db.get(args.approvalId);
        if (!approval) {
            return { approved: false, rejectionReason: "Approval not found" };
        }

        if (approval.status === "approved") {
            return { approved: true };
        } else if (approval.status === "rejected") {
            return { approved: false, rejectionReason: approval.rejectionReason || "Rejected by user" };
        } else if (approval.status === "expired") {
            return { approved: false, rejectionReason: "Approval expired" };
        } else {
            // Still pending
            return { approved: false, rejectionReason: "Approval pending" };
        }
    },
});

/**
 * Execute command (signals agent to execute via task status update)
 */
export const executeCommand = internalAction({
    args: {
        jobId: v.id("agentJobs"),
        taskId: v.string(),
        command: v.string(),
        cwd: v.string(),
        securityProfile: v.union(
            v.literal("minimal"),
            v.literal("standard"),
            v.literal("guarded"),
            v.literal("admin")
        ),
    },
    handler: async (ctx, args): Promise<{ success: boolean; output?: string; error?: string }> => {
        // Signal the agent to execute this task by creating an execution request
        // The orchestrator workflow model: Workflow approves → Agent executes → Workflow waits for completion

        // 1. Mark task as "approved_for_execution" so agent knows to spawn PTY
        await ctx.runMutation(internal.workflows.agentExecutionWorkflow.markTaskReadyForExecution, {
            jobId: args.jobId,
            taskId: args.taskId,
        });

        // 2. Wait for agent to complete execution (poll task status)
        const maxWaitTime = 600_000; // 10 minutes
        const startTime = Date.now();
        const pollInterval = 2000; // 2 seconds

        while (Date.now() - startTime < maxWaitTime) {
            const taskPlan = await ctx.runQuery(internal.workflows.agentExecutionWorkflow.getTaskStatus, {
                jobId: args.jobId,
                taskId: args.taskId,
            });

            if (!taskPlan) {
                return {
                    success: false,
                    error: "Task plan not found",
                };
            }

            if (taskPlan.status === "completed") {
                return {
                    success: true,
                    output: "Command executed successfully",
                };
            } else if (taskPlan.status === "failed") {
                return {
                    success: false,
                    error: "Command execution failed",
                };
            }

            // Wait before polling again
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }

        return {
            success: false,
            error: "Command execution timeout after 10 minutes",
        };
    },
});

/**
 * Mark task as completed
 */
export const markCompleted = internalMutation({
    args: {
        jobId: v.id("agentJobs"),
        taskId: v.string(),
        output: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const job = await ctx.db.get(args.jobId);
        if (!job || !job.taskPlan) return;

        const tasks = job.taskPlan.tasks;
        const taskIndex = tasks.findIndex((t) => t.id === args.taskId);
        if (taskIndex !== -1) {
            tasks[taskIndex].status = "completed";
            await ctx.db.patch(args.jobId, {
                taskPlan: { tasks, verificationChecks: job.taskPlan.verificationChecks },
                updatedAt: Date.now(),
            });
        }
    },
});

/**
 * Mark task as failed
 */
export const markFailed = internalMutation({
    args: {
        jobId: v.id("agentJobs"),
        taskId: v.string(),
        error: v.string(),
    },
    handler: async (ctx, args) => {
        const job = await ctx.db.get(args.jobId);
        if (!job || !job.taskPlan) return;

        const tasks = job.taskPlan.tasks;
        const taskIndex = tasks.findIndex((t) => t.id === args.taskId);
        if (taskIndex !== -1) {
            tasks[taskIndex].status = "failed";
            await ctx.db.patch(args.jobId, {
                taskPlan: { tasks, verificationChecks: job.taskPlan.verificationChecks },
                updatedAt: Date.now(),
            });
        }

        // Also log the error
        await ctx.db.insert("jobLogs", {
            jobId: args.jobId,
            type: "error",
            content: `Task ${args.taskId} failed: ${args.error}`,
            timestamp: Date.now(),
        });
    },
});

/**
 * Mark task as ready for execution (signals agent to spawn PTY)
 */
export const markTaskReadyForExecution = internalMutation({
    args: {
        jobId: v.id("agentJobs"),
        taskId: v.string(),
    },
    handler: async (ctx, args) => {
        const job = await ctx.db.get(args.jobId);
        if (!job || !job.taskPlan) return;

        const tasks = job.taskPlan.tasks;
        const taskIndex = tasks.findIndex((t) => t.id === args.taskId);
        if (taskIndex !== -1) {
            // Mark as running so agent picks it up
            tasks[taskIndex].status = "running";
            await ctx.db.patch(args.jobId, {
                taskPlan: { tasks, verificationChecks: job.taskPlan.verificationChecks },
                updatedAt: Date.now(),
            });
        }
    },
});

/**
 * Get task status for polling
 */
export const getTaskStatus = internalQuery({
    args: {
        jobId: v.id("agentJobs"),
        taskId: v.string(),
    },
    handler: async (ctx, args) => {
        const job = await ctx.db.get(args.jobId);
        if (!job || !job.taskPlan) return null;

        const task = job.taskPlan.tasks.find((t) => t.id === args.taskId);
        if (!task) return null;

        return {
            status: task.status,
            terminalId: task.terminalId,
        };
    },
});

/**
 * Link workflow ID back to approval (called after workflow starts)
 */
export const linkWorkflowToApproval = internalMutation({
    args: {
        approvalId: v.id("approvalRequests"),
        workflowId: v.string(),
    },
    handler: async (ctx, args) => {
        await ctx.db.patch(args.approvalId, {
            workflowId: args.workflowId,
            updatedAt: Date.now(),
        });
    },
});

/**
 * Log that workflow is waiting for approval
 */
export const logApprovalWait = internalMutation({
    args: {
        jobId: v.id("agentJobs"),
        approvalId: v.id("approvalRequests"),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("jobLogs", {
            jobId: args.jobId,
            type: "info",
            content: `⏸️ Workflow paused - awaiting user approval (ID: ${args.approvalId})`,
            timestamp: Date.now(),
        });
    },
});

/**
 * Send approval signal to workflow
 */
export const sendApprovalSignal = internalMutation({
    args: {
        workflowId: v.string(),
        approved: v.boolean(),
        rejectionReason: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        // Import workflow manager to send signal
        const { WorkflowManager } = await import("@convex-dev/workflow");
        const workflow = new WorkflowManager(components.workflow);

        // Send "approval_resolved" event to workflow
        try {
            await workflow.sendEvent(ctx, {
                workflowId: args.workflowId as any,
                name: "approval_resolved",
                value: {
                    approved: args.approved,
                    rejectionReason: args.rejectionReason,
                },
            });

            console.log(`Workflow ${args.workflowId}: Approval ${args.approved ? "granted" : "denied"}`);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            console.error(`Failed to send approval event to workflow ${args.workflowId}:`, errorMessage);
            throw error;
        }
    },
});

// ── Public Action: Trigger Task Execution Workflow ───────────────

import { action } from "../_generated/server";

/**
 * Trigger a task execution workflow (called by orchestrator).
 * Creates approval first if needed, then starts workflow with approval link.
 */
export const triggerTaskExecution = action({
    args: {
        jobId: v.id("agentJobs"),
        taskId: v.string(),
        command: v.string(),
        cwd: v.string(),
        securityProfile: v.union(
            v.literal("minimal"),
            v.literal("standard"),
            v.literal("guarded"),
            v.literal("admin")
        ),
    },
    handler: async (ctx, args): Promise<{ success: boolean; error?: string; workflowId?: string }> => {
        try {
            // Pre-check if approval needed (avoids creating workflow if not needed)
            let approvalId: string | undefined;

            if (args.securityProfile === "guarded") {
                // Analyze risk before starting workflow
                const riskAnalysis = await ctx.runAction(
                    internal.workflows.agentExecutionWorkflow.analyzeCommandRisk,
                    {
                        command: args.command,
                        cwd: args.cwd,
                        securityProfile: args.securityProfile,
                    }
                );

                if (riskAnalysis.requiresApproval) {
                    // Create approval BEFORE starting workflow
                    const result = await ctx.runMutation(
                        internal.workflows.agentExecutionWorkflow.createApprovalRequest,
                        {
                            jobId: args.jobId,
                            taskId: args.taskId,
                            command: args.command,
                            riskLevel: riskAnalysis.riskLevel,
                            reasoning: riskAnalysis.reasoning,
                        }
                    );
                    approvalId = result.approvalId as unknown as string;
                }
            }

            // Start the workflow (with optional approvalId)
            const workflow = new WorkflowManager(components.workflow);
            const workflowId = await workflow.start(ctx, agentExecutionWorkflow as any, {
                args: {
                    jobId: args.jobId,
                    taskId: args.taskId,
                    command: args.command,
                    cwd: args.cwd,
                    securityProfile: args.securityProfile,
                    approvalId: approvalId as any, // Pass pre-created approval ID
                },
            });

            // Link workflow back to approval if one was created
            if (approvalId) {
                await ctx.runMutation(
                    internal.workflows.agentExecutionWorkflow.linkWorkflowToApproval,
                    {
                        approvalId: approvalId as any,
                        workflowId: workflowId as unknown as string,
                    }
                );
            }

            return {
                success: true,
                workflowId: workflowId as unknown as string,
            };
        } catch (error: any) {
            console.error("Failed to trigger task execution workflow:", error);
            return {
                success: false,
                error: error.message || "Unknown error",
            };
        }
    },
});
