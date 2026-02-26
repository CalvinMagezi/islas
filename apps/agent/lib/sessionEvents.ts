import type { ConvexClient } from "convex/browser";
import type { AgentSessionEvent } from "@mariozechner/pi-coding-agent";
import { api } from "@repo/convex/agent";
import { logger } from "./logger.js";

const cast = <T>(value: any): T => value as T;

export interface JobEventState {
    currentText: string;
}

export interface SubscribeParams {
    session: any;
    client: ConvexClient;
    jobId: string;
    apiKey: string;
    onSyncSessionState?: (session: any, jobId: string) => Promise<void>;
    maxToolCalls?: number;
}

export function subscribeToJobEvents(
    params: SubscribeParams,
): JobEventState & { flushText: () => Promise<void> } {
    const { session, client, jobId, apiKey, onSyncSessionState, maxToolCalls = 20 } = params;

    const result: JobEventState & { flushText: () => Promise<void> } = {
        currentText: "",
        flushText: () => syncStreamingText(true),
    };

    let lastUpdateTime = 0;
    let toolCallCount = 0;
    const UPDATE_THROTTLE_MS = 200;

    const syncStreamingText = async (force = false) => {
        const now = Date.now();
        if (!force && now - lastUpdateTime < UPDATE_THROTTLE_MS) return;
        lastUpdateTime = now;

        try {
            await client.mutation(api.agent.updateJobStreamingText, cast({
                jobId,
                text: result.currentText,
                apiKey,
            }));
        } catch (_e) {
            // Ignore streaming text update errors
        }
    };

    const logQueue: any[] = [];
    let isFlushing = false;
    const processLogQueue = async () => {
        if (isFlushing || logQueue.length === 0) return;
        isFlushing = true;
        while (logQueue.length > 0) {
            const event = logQueue.shift();
            try {
                await client.mutation(api.agent.addJobLog, cast({
                    jobId,
                    type: event.type,
                    content: JSON.stringify(event),
                    apiKey,
                }));
            } catch (_e) {
                // Ignore log queue flush errors
            }
        }
        isFlushing = false;
    };

    session.subscribe(async (event: AgentSessionEvent) => {
        const eventType = event.type as string;

        // 1. Stream to Console and accumulate for web
        if (eventType === "message_update") {
            const updateEvent = event as any;
            if (updateEvent.assistantMessageEvent?.type === "text_delta") {
                const delta = updateEvent.assistantMessageEvent.delta;
                process.stdout.write(delta);
                result.currentText += delta;
                void syncStreamingText();
            }
        } else if (eventType === "message_stop") {
            process.stdout.write("\n\n");
            // Commit to history
            await syncStreamingText(true);
            await client.mutation(api.agent.commitStreamingText, cast({
                jobId,
                apiKey,
            }));
            result.currentText = "";

            // Log context usage for observability
            try {
                const usage = session.getContextUsage?.();
                if (usage && usage.percent != null) {
                    void client.mutation(api.agent.addJobLog, cast({
                        jobId,
                        type: "context_usage",
                        content: `Context: ${usage.tokens}/${usage.contextWindow} tokens (${Math.round(usage.percent)}%)`,
                        metadata: { tokens: usage.tokens, contextWindow: usage.contextWindow, percent: usage.percent },
                        apiKey,
                    }));

                    if (usage.percent > 70) {
                        console.log(`⚠️  Context usage: ${Math.round(usage.percent)}%`);
                        void client.mutation(api.agent.addJobLog, cast({
                            jobId,
                            type: "warning",
                            content: `High context usage: ${Math.round(usage.percent)}% — compaction may trigger soon`,
                            apiKey,
                        }));
                    }
                }
            } catch (e) {
                // Context usage is best-effort
            }
        } else if (eventType === "tool_execution_start") {
            const toolEvent = event as any;
            const toolName = toolEvent.toolCall?.tool?.name || toolEvent.toolCall?.name || "tool";
            const toolArgs = JSON.stringify(toolEvent.toolCall?.arguments || {});
            console.log(`\n[🛠️ Tool Call]: ${toolName} -> ${toolArgs.substring(0, 100)}${toolArgs.length > 100 ? "..." : ""}`);

            toolCallCount++;
            if (toolCallCount > maxToolCalls) {
                console.error("\n🛑 SAFETY BREAKER: Too many tool calls. Aborting to save tokens.");
                await session.abort();
                throw new Error("Safety breaker: Maximum tool call limit reached.");
            }
        } else if (eventType === "tool_execution_end") {
            const toolEvent = event as any;
            if (toolEvent.toolResult?.error) {
                console.log(`[❌ Tool Error]: ${toolEvent.toolResult.error}`);
            } else {
                console.log(`[✅ Tool Complete]`);
            }

            // Check for cancellation or steering on every tool completion
            try {
                const latestJob = await client.query(api.agent.getJob, { jobId: jobId as any });
                if (latestJob) {
                    // Job cancellation
                    if (latestJob.status === "cancelled") {
                        console.log("\n❌ Job cancelled by user");
                        logger.info("Job cancelled by user", { jobId });
                        await session.abort();
                        throw new Error("Job cancelled by user");
                    }
                    // Mid-job steering
                    if (latestJob.steeringMessage) {
                        console.log(`\n🎯 Steering: ${latestJob.steeringMessage}`);
                        logger.info("Job steered", { jobId, message: latestJob.steeringMessage });
                        await session.steer(latestJob.steeringMessage);
                        // Clear steering message
                        await client.mutation(api.agent.clearSteeringMessage, cast({
                            jobId,
                            apiKey,
                        }));
                    }
                    // Mid-job thinking level change
                    if (latestJob.thinkingLevel && typeof session.setThinkingLevel === "function") {
                        const currentLevel = session.thinkingLevel;
                        if (currentLevel !== latestJob.thinkingLevel) {
                            console.log(`\n🧠 Thinking level: ${currentLevel} → ${latestJob.thinkingLevel}`);
                            logger.info("Thinking level changed mid-job", { jobId, from: currentLevel, to: latestJob.thinkingLevel });
                            session.setThinkingLevel(latestJob.thinkingLevel);
                        }
                    }
                }
            } catch (e: any) {
                if (e.message === "Job cancelled by user") throw e;
                // Non-fatal: cancellation/steer/thinking check failed, continue execution
            }
        } else if (eventType === "auto_retry_start") {
            const retryEvent = event as any;
            const msg = `Retry ${retryEvent.attempt}/${retryEvent.maxAttempts} after ${retryEvent.delayMs}ms: ${retryEvent.errorMessage}`;
            console.log(`\n⚠️  ${msg}`);
            logger.warn(msg, { jobId, attempt: retryEvent.attempt });
        } else if (eventType === "auto_retry_end") {
            const retryEvent = event as any;
            if (retryEvent.success) {
                console.log(`✅ Retry succeeded on attempt ${retryEvent.attempt}`);
            } else {
                console.log(`❌ All retries exhausted: ${retryEvent.finalError || "unknown error"}`);
                logger.error("All retries exhausted", { jobId, finalError: retryEvent.finalError });
            }
        }

        // Queue other events for Terminal View
        if (eventType !== "message_update") {
            logQueue.push(event);
            void processLogQueue();
        }

        // Periodic State Sync (Throttled)
        if (eventType === "message_stop" || eventType === "tool_execution_end") {
            if (onSyncSessionState) {
                await onSyncSessionState(session, jobId);
            }
        }
    });

    return result;
}
