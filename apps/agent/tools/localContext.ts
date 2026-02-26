import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";
import * as fs from "fs";

const LocalContextSchema = Type.Object({
    action: Type.Union([Type.Literal("read"), Type.Literal("write")]),
    content: Type.Optional(Type.String()),
});

export function createLocalContextTool(contextFile: string): AgentTool<typeof LocalContextSchema> {
    return {
        name: "local_context",
        description: "Read or write to the local persistent memory file (islas-context.md). Use this to remember things across sessions.",
        parameters: LocalContextSchema,
        label: "Local Context",
        execute: async (_toolCallId, args) => {
            if (args.action === "read") {
                if (!fs.existsSync(contextFile)) {
                    return { content: [{ type: "text", text: "No local context found." }], details: {} };
                }
                return { content: [{ type: "text", text: fs.readFileSync(contextFile, "utf-8") }], details: {} };
            } else {
                fs.writeFileSync(contextFile, args.content || "");
                return { content: [{ type: "text", text: "Context updated." }], details: {} };
            }
        },
    };
}
