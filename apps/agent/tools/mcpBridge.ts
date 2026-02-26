import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";

const MCPBridgeSchema = Type.Object({
    toolName: Type.String(),
    arguments: Type.Any(),
});

export function createMCPBridgeTool(convexUrl: string): AgentTool<typeof MCPBridgeSchema> {
    return {
        name: "mcp_bridge",
        description: "Call cloud-hosted MCP servers (Knowledge Graphs, Browser Tools) via the Convex MCP gateway.",
        parameters: MCPBridgeSchema,
        label: "MCP Bridge",
        execute: async (_toolCallId, args) => {
            const mcpGatewayUrl = process.env.MCP_GATEWAY_URL || convexUrl.replace(".cloud", ".site") + "/mcp";
            const mcpGatewayToken = process.env.MCP_GATEWAY_TOKEN;
            if (!mcpGatewayUrl || !mcpGatewayToken) {
                return {
                    content: [{ type: "text", text: "MCP Bridge not configured: set MCP_GATEWAY_URL and MCP_GATEWAY_TOKEN env vars." }],
                    details: {},
                };
            }

            try {
                const response = await fetch(mcpGatewayUrl, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${mcpGatewayToken}`,
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
        },
    };
}
