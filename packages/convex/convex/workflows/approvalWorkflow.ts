import { WorkflowManager, defineEvent } from "@convex-dev/workflow";
import { v } from "convex/values";
import { api, components } from "../_generated/api";

export const workflow = new WorkflowManager(components.workflow);

export const approvalDecision = defineEvent({
  name: "approval_decision",
  validator: v.object({
    approved: v.boolean(),
    reason: v.optional(v.string()),
  }),
});

export const agentApproval = workflow.define({
  args: {
    approvalId: v.id("approvalRequests"),
    jobId: v.optional(v.id("agentJobs")),
  },
  handler: async (step, args) => {
    // Log to the agent job if present
    if (args.jobId) {
      await step.runMutation(api.agent.addJobLog, {
        jobId: args.jobId,
        type: "info" as const,
        content: "Awaiting user approval...",
        apiKey: "workflow-internal",
      });
    }

    // DURABLE PAUSE — survives crashes and restarts
    const decision = await step.awaitEvent(approvalDecision);

    return decision;
  },
});
