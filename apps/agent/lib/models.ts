/**
 * Shared OpenRouter model config builder.
 * Eliminates duplication between index.ts and chatSession.ts.
 */

/**
 * Build a Pi SDK model config object for a given model ID.
 * - "moonshotai/*" → Kimi k2.5 hardcoded config (known pricing)
 * - Any other string → generic OpenRouter config
 * - Non-string → returned as-is (passthrough for pre-built configs)
 */
export function resolveOpenRouterModel(modelId: unknown): any {
    if (typeof modelId !== "string") {
        return modelId;
    }

    if (modelId.startsWith("moonshotai/")) {
        return {
            id: modelId,
            name: "Kimi k2.5",
            provider: "openrouter",
            api: "openai-completions",
            baseUrl: "https://openrouter.ai/api/v1",
            reasoning: false,
            input: ["text"],
            cost: { input: 0.3, output: 0.3, cacheRead: 0.075, cacheWrite: 0.3 },
            contextWindow: 200000,
            maxTokens: 8192,
        };
    }

    return {
        id: modelId,
        name: modelId.split("/").pop() || modelId,
        provider: "openrouter",
        api: "openai-completions",
        baseUrl: "https://openrouter.ai/api/v1",
        reasoning: modelId.includes("thinking") || modelId.includes("reasoning"),
        input: ["text"],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 8192,
    };
}
