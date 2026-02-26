import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { ConvexClient } from "convex/browser";
import { api } from "@repo/convex/agent";

const ChatWithUserSchema = Type.Object({
    message: Type.String({ description: "The message or question to ask the user" }),
    waitForResponse: Type.Optional(Type.Boolean({ description: "Whether to wait for the user to respond before continuing" })),
});

export function createChatWithUserTool(
    client: ConvexClient,
    jobIdRef: { value: string | null },
    apiKey: string,
): AgentTool<typeof ChatWithUserSchema> {
    return {
        name: "chat_with_user",
        description: "Send a message to the user and optionally wait for a response. Use this to ask clarifying questions, confirm actions, or provide updates during long-running tasks. For interactive jobs, set waitForResponse=true to pause execution until the user replies.",
        parameters: ChatWithUserSchema,
        label: "Chat with User",
        execute: async (_toolCallId, args) => {
            console.log(`[Agent -> User]: ${args.message}`);

            if (args.waitForResponse && jobIdRef.value) {
                const cast = <T>(v: any): T => v as T;

                await client.mutation(api.agent.updateJobStatus, cast({
                    jobId: jobIdRef.value,
                    status: "waiting_for_user",
                    apiKey,
                    conversationHistory: [],
                }));

                await client.mutation(api.agent.addJobLog, cast({
                    jobId: jobIdRef.value,
                    type: "info",
                    content: `Agent: ${args.message}`,
                    apiKey,
                }));

                const startTime = Date.now();
                const timeout = 30 * 60 * 1000; // 30 minutes

                while (Date.now() - startTime < timeout) {
                    const job = await client.query(api.agent.getJob, { jobId: jobIdRef.value as any });

                    if (job && job.status === "running" && job.pendingUserMessage) {
                        const response = job.pendingUserMessage;
                        await client.mutation(api.agent.updateJobStatus, cast({
                            jobId: jobIdRef.value,
                            status: "running",
                            apiKey,
                            conversationHistory: job.conversationHistory,
                        }));
                        return {
                            content: [{ type: "text", text: response }],
                            details: { received: true, message: response },
                        };
                    }

                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                return {
                    content: [{ type: "text", text: "No response received within timeout period." }],
                    details: { timeout: true },
                };
            }

            return {
                content: [{ type: "text", text: `Message sent to user: "${args.message}"` }],
                details: { acknowledged: true },
            };
        },
    };
}
