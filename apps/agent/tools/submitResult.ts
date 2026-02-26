import { Type } from "@sinclair/typebox";
import type { AgentTool } from "@mariozechner/pi-agent-core";

const SubmitResultSchema = Type.Object({
    result: Type.Any(),
});

export interface RpcResultRef {
    value: any;
}

export function createSubmitResultTool(
    jobIdRef: { value: string | null },
    rpcResultRef: RpcResultRef,
): AgentTool<typeof SubmitResultSchema> {
    return {
        name: "submit_result",
        description: "Submit the final result of an RPC job. Use this ONLY when the user asks for a direct return value (RPC mode).",
        parameters: SubmitResultSchema,
        label: "Submit Result",
        execute: async (_toolCallId, args) => {
            if (jobIdRef.value) {
                rpcResultRef.value = args.result;
                return { content: [{ type: "text", text: "Result submitted. You may now stop." }], details: {} };
            }
            return { content: [{ type: "text", text: "Error: No active job." }], details: {} };
        },
    };
}
