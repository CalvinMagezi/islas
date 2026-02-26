import type { ApprovalCallback } from "../governance.js";

/**
 * Creates an approval callback that polls a Convex HTTP endpoint for user decisions.
 *
 * @param baseUrl - Convex site URL (*.convex.site)
 * @param apiKey  - API key for the Convex HTTP actions
 * @param jobId   - The current job ID (for correlating approvals)
 */
export function createApprovalCallback(
    baseUrl: string,
    apiKey: string,
    jobId: string,
): ApprovalCallback {
    return async (toolName, args, riskLevel) => {
        const argsPreview = typeof args === "string"
            ? args.substring(0, 200)
            : JSON.stringify(args ?? {}).substring(0, 200);

        console.log(`\n🛡️ Approval required for '${toolName}' (${riskLevel} risk)`);

        try {
            // 1. Create approval + start durable workflow via HTTP endpoint
            const createRes = await fetch(`${baseUrl}/api/approvals/create`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-API-Key": apiKey,
                },
                body: JSON.stringify({
                    title: `${toolName}: ${argsPreview}`,
                    description: `The agent wants to execute '${toolName}' with args: ${argsPreview}`,
                    toolName,
                    toolArgs: args,
                    riskLevel,
                    jobId,
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
                const statusRes = await fetch(`${baseUrl}/api/approvals/status`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-API-Key": apiKey,
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
}
