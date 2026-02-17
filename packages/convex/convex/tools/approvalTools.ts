import { createTool, type ToolCtx } from "@convex-dev/agent";
import { z } from "zod";
import { createApprovalRef, getApprovalInternalRef } from "./approvalHelpers";

type ApprovalRequestResult = {
  approvalId: string;
  status: "pending";
  title: string;
  description: string;
  riskLevel: string;
  expiresAt: number;
};

type ApprovalCheckResult = {
  status: string;
  approved: boolean;
  rejectionReason?: string;
};

export const requestApproval = createTool({
  description:
    "Request user approval before performing a destructive or sensitive action. " +
    "Call this BEFORE deleting notes, memories, projects, performing bulk modifications, " +
    "or any action that cannot be easily undone. The user will see an approval card " +
    "in the chat and can approve or reject the action.",
  args: z.object({
    title: z
      .string()
      .describe("Short title for the approval request, e.g. 'Delete 5 notes'"),
    description: z
      .string()
      .describe(
        "Detailed description of what will happen if approved, including what data will be affected",
      ),
    toolName: z
      .string()
      .describe("Name of the tool that requires approval, e.g. 'deleteMemory'"),
    toolArgs: z
      .any()
      .optional()
      .describe("The arguments that will be passed to the tool if approved"),
    riskLevel: z
      .enum(["low", "medium", "high", "critical"])
      .describe(
        "Risk level: low (minor change), medium (data modification), high (deletion), critical (bulk/irreversible)",
      ),
  }),
  handler: async (
    ctx: ToolCtx,
    args: {
      title: string;
      description: string;
      toolName: string;
      toolArgs?: unknown;
      riskLevel: "low" | "medium" | "high" | "critical";
    },
  ): Promise<ApprovalRequestResult> => {
    const userId = ctx.userId!;
    const threadId = ctx.threadId;

    const result = (await ctx.runMutation(createApprovalRef, {
      userId,
      source: "orchestrator" as const,
      title: args.title,
      description: args.description,
      toolName: args.toolName,
      toolArgs: args.toolArgs,
      riskLevel: args.riskLevel,
      threadId,
      timeoutMinutes: 30,
    })) as { approvalId: string };

    const now = Date.now();
    return {
      approvalId: result.approvalId,
      status: "pending",
      title: args.title,
      description: args.description,
      riskLevel: args.riskLevel,
      expiresAt: now + 30 * 60 * 1000,
    };
  },
});

export const checkApproval = createTool({
  description:
    "Check the status of a pending approval request. Call this after the user " +
    "has responded to an approval card to verify their decision before proceeding.",
  args: z.object({
    approvalId: z.string().describe("The approval request ID to check"),
  }),
  handler: async (
    ctx: ToolCtx,
    args: { approvalId: string },
  ): Promise<ApprovalCheckResult> => {
    const approval = (await ctx.runQuery(getApprovalInternalRef, {
      approvalId: args.approvalId as any,
    })) as {
      status: string;
      rejectionReason?: string;
    } | null;

    if (!approval) {
      return {
        status: "not_found",
        approved: false,
        rejectionReason: "Approval request not found",
      };
    }

    return {
      status: approval.status,
      approved: approval.status === "approved",
      rejectionReason: approval.rejectionReason,
    };
  },
});
