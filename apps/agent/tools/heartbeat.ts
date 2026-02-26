import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import type { ConvexClient } from "convex/browser";
import { api } from "@repo/convex/agent";

const HeartbeatSchema = Type.Object({
    action: Type.Union([Type.Literal("read"), Type.Literal("write"), Type.Literal("append")]),
    content: Type.Optional(Type.String({ description: "New content for 'write', or text to append for 'append'" })),
});

export function createHeartbeatTool(client: ConvexClient): AgentTool<typeof HeartbeatSchema> {
    return {
        name: "heartbeat",
        description: "Read, write, or append to the HQ Heartbeat note. This note is processed by a server-side cron every 2 minutes — any actionable content will be dispatched as a background job to an available worker. Use 'write' to replace the entire content, 'append' to add a task, or 'read' to check current content.",
        parameters: HeartbeatSchema,
        label: "Heartbeat",
        execute: async (_toolCallId, args) => {
            try {
                if (args.action === "read") {
                    const context = await client.query(api.functions.system.getAgentContext, {});
                    const hb = context.find((n: any) => n.title === "Heartbeat");
                    return { content: [{ type: "text", text: hb ? hb.content : "No heartbeat note found." }], details: {} };
                } else if (args.action === "write") {
                    await client.mutation(api.functions.system.updateSystemNote, {
                        title: "Heartbeat",
                        content: args.content || "",
                    });
                    return { content: [{ type: "text", text: "Heartbeat note updated." }], details: {} };
                } else {
                    await client.mutation(api.functions.system.appendToSystemNote, {
                        title: "Heartbeat",
                        content: args.content || "",
                    });
                    return { content: [{ type: "text", text: "Appended to heartbeat note." }], details: {} };
                }
            } catch (error: any) {
                return { content: [{ type: "text", text: `Heartbeat error: ${error.message}` }], details: { error } };
            }
        },
    };
}
