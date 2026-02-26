/**
 * Intent classifier for WebSocket chat messages.
 * Provides instant regex-based responses for common queries,
 * falling through to the LLM for everything else.
 */

export interface ClassifierContext {
    targetDir: string;
    workerId: string;
    isBusy: boolean;
}

export interface ClassificationResult {
    tier: "instant" | "llm";
    instantResponse?: string;
    reason: string;
}

interface InstantRule {
    pattern: RegExp;
    response: (ctx: ClassifierContext) => string;
    reason: string;
}

const INSTANT_RULES: InstantRule[] = [
    {
        pattern: /^(hi|hello|hey|howdy|greetings)[!?.]*$/i,
        response: (ctx) => `Hello! I'm your local Islas agent (${ctx.workerId}). How can I help you?`,
        reason: "greeting",
    },
    {
        pattern: /^(status|what'?s? your status|are you (online|up|running|alive|there))[?!.]*$/i,
        response: (ctx) =>
            ctx.isBusy
                ? `I'm currently busy working on a task. I'll be available shortly.`
                : `I'm online and ready. Working directory: ${ctx.targetDir}`,
        reason: "status_query",
    },
    {
        pattern: /^are you busy[?!.]*$/i,
        response: (ctx) =>
            ctx.isBusy
                ? `Yes, I'm currently processing a job. I'll let you know when I'm done.`
                : `Nope, I'm free! What would you like me to do?`,
        reason: "busy_query",
    },
    {
        pattern: /^(what is your|what'?s? your) worker id[?!.]*$/i,
        response: (ctx) => `My worker ID is: \`${ctx.workerId}\``,
        reason: "worker_id_query",
    },
    {
        pattern: /^(what is|what'?s?) (the )?current (directory|dir|cwd|working directory)[?!.]*$/i,
        response: (ctx) => `Current working directory: \`${ctx.targetDir}\``,
        reason: "cwd_query",
    },
    {
        pattern: /^(ping)[!?.]*$/i,
        response: () => "pong",
        reason: "ping",
    },
    {
        pattern: /^(help|what can you do|what are your capabilities)[?!.]*$/i,
        response: () =>
            `I can help you with:\n- Running shell commands (bash, git, npm, etc.)\n- Dispatching background jobs for complex tasks\n- Reading and writing files\n- Answering questions about your project\n\nJust ask naturally!`,
        reason: "help_query",
    },
];

/**
 * Classify a chat message.
 * Returns an instant response for common patterns,
 * or tier "llm" to proceed to the LLM.
 */
export function classifyIntent(text: string, ctx: ClassifierContext): ClassificationResult {
    const trimmed = text.trim();

    for (const rule of INSTANT_RULES) {
        if (rule.pattern.test(trimmed)) {
            return {
                tier: "instant",
                instantResponse: rule.response(ctx),
                reason: rule.reason,
            };
        }
    }

    return { tier: "llm", reason: "no_instant_match" };
}
