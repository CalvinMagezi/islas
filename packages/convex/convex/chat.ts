import { v } from "convex/values";
import { query, mutation, internalAction, internalMutation } from "./_generated/server";
import { internal, components } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import {
  listUIMessages,
  syncStreams,
  vStreamArgs,
} from "@convex-dev/agent";
import { generateText } from "ai";
import { orchestrator } from "./agents/orchestrator";
import { getAuthUserId } from "./lib/auth";
import { getLanguageModel } from "./lib/models";
import { calculateCost } from "./lib/pricing";

// ─── Send Message ────────────────────────────────────────────

export const sendMessage = mutation({
  args: { threadId: v.string(), prompt: v.string() },
  returns: v.string(),
  handler: async (ctx, args): Promise<string> => {
    const userId = await getAuthUserId(ctx);

    const { messageId } = await orchestrator.saveMessage(ctx, {
      threadId: args.threadId,
      userId,
      prompt: args.prompt,
      skipEmbeddings: true,
    });

    // Schedule agent response
    await ctx.scheduler.runAfter(0, internal.chat.streamResponse, {
      threadId: args.threadId,
      promptMessageId: messageId,
    });

    // Check if we need to generate a title for this thread
    const metadata = await ctx.db
      .query("threadMetadata")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (metadata && !metadata.titleGenerated) {
      // Mark as title generation in-progress to avoid duplicate scheduling
      await ctx.db.patch(metadata._id, { titleGenerated: true });
      await ctx.scheduler.runAfter(0, internal.chat.generateTitle, {
        threadId: args.threadId,
        userId,
        firstMessage: args.prompt,
      });
    }

    return messageId;
  },
});

// ─── Stream Response ─────────────────────────────────────────

export const streamResponse = internalAction({
  args: { threadId: v.string(), promptMessageId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const result = await orchestrator.streamText(
      ctx,
      { threadId: args.threadId },
      { promptMessageId: args.promptMessageId } as any,
      {
        saveStreamDeltas: {
          chunking: "word",
          throttleMs: 100,
        },
      },
    );
    await result.consumeStream();
  },
});

// ─── Title Generation ────────────────────────────────────────

export const generateTitle = internalAction({
  args: { threadId: v.string(), userId: v.string(), firstMessage: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const model = getLanguageModel();
    const modelName = process.env.DEFAULT_MODEL || "unknown";

    const result = await generateText({
      model,
      system:
        "Generate a very short title (3-6 words max) for a chat conversation based on the user's first message. Return ONLY the title text, no quotes, no punctuation at the end, no explanation.",
      prompt: args.firstMessage,
    });

    // Log usage for this title generation call
    const usage = result.usage as { promptTokens?: number; inputTokens?: number; completionTokens?: number; outputTokens?: number };
    const promptTokens = usage?.promptTokens ?? usage?.inputTokens ?? 0;
    const completionTokens = usage?.completionTokens ?? usage?.outputTokens ?? 0;
    const totalTokens = promptTokens + completionTokens;
    const cost = calculateCost(modelName, promptTokens, completionTokens);

    await ctx.runMutation(internal.functions.internal.logUsage, {
      userId: args.userId,
      threadId: args.threadId,
      model: modelName,
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
    });

    const title = result.text.trim().replace(/^["']|["']$/g, "");

    if (title) {
      await ctx.runMutation(internal.chat.updateThreadTitle, {
        threadId: args.threadId,
        title,
      });
    }
  },
});

export const updateThreadTitle = internalMutation({
  args: { threadId: v.string(), title: v.string() },
  handler: async (ctx, args): Promise<void> => {
    await ctx.runMutation(components.agent.threads.updateThread, {
      threadId: args.threadId,
      patch: { title: args.title },
    });
  },
});

// ─── List Messages ───────────────────────────────────────────

export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: vStreamArgs,
  },
  handler: async (ctx, args) => {
    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });

    const streams = await syncStreams(ctx, components.agent, {
      threadId: args.threadId,
      streamArgs: args.streamArgs,
    });

    return { ...paginated, streams };
  },
});

// ─── Thread CRUD ─────────────────────────────────────────────

export const createThread = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx): Promise<string> => {
    const userId = await getAuthUserId(ctx);
    const { threadId } = await orchestrator.createThread(ctx, { userId });

    // Create metadata entry for the new thread
    await ctx.db.insert("threadMetadata", {
      threadId,
      userId,
      status: "active",
      titleGenerated: false,
    });

    return threadId;
  },
});

export const listThreads = query({
  args: {
    status: v.optional(
      v.union(v.literal("active"), v.literal("archived")),
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const filterStatus = args.status ?? "active";

    // Get all threads from the agent component
    const result = await ctx.runQuery(
      components.agent.threads.listThreadsByUserId,
      {
        userId,
        order: "desc",
        paginationOpts: { numItems: 100, cursor: null },
      },
    );

    // Get metadata for filtering
    const metadataList = await ctx.db
      .query("threadMetadata")
      .withIndex("by_user_status", (q) =>
        q.eq("userId", userId).eq("status", filterStatus),
      )
      .collect();

    const metadataThreadIds = new Set(metadataList.map((m) => m.threadId));

    // Filter threads: include those matching the status filter,
    // or those without metadata (legacy threads, treat as active)
    const allMetadata = await ctx.db
      .query("threadMetadata")
      .withIndex("by_user_status", (q) => q.eq("userId", userId))
      .collect();
    const allMetadataThreadIds = new Set(allMetadata.map((m) => m.threadId));

    return result.page.filter((thread) => {
      // If thread has metadata, check if it matches the filter
      if (allMetadataThreadIds.has(thread._id)) {
        return metadataThreadIds.has(thread._id);
      }
      // Legacy threads without metadata — show only in "active" filter
      return filterStatus === "active";
    });
  },
});

// ─── Thread Status Management ────────────────────────────────

export const archiveThread = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    const metadata = await ctx.db
      .query("threadMetadata")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (metadata) {
      await ctx.db.patch(metadata._id, { status: "archived" });
    } else {
      await ctx.db.insert("threadMetadata", {
        threadId: args.threadId,
        userId,
        status: "archived",
        titleGenerated: true,
      });
    }
  },
});

export const softDeleteThread = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    const metadata = await ctx.db
      .query("threadMetadata")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (metadata) {
      await ctx.db.patch(metadata._id, { status: "deleted" });
    } else {
      await ctx.db.insert("threadMetadata", {
        threadId: args.threadId,
        userId,
        status: "deleted",
        titleGenerated: true,
      });
    }
  },
});

export const restoreThread = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    const metadata = await ctx.db
      .query("threadMetadata")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (metadata) {
      await ctx.db.patch(metadata._id, { status: "active" });
    } else {
      await ctx.db.insert("threadMetadata", {
        threadId: args.threadId,
        userId,
        status: "active",
        titleGenerated: true,
      });
    }
  },
});

export const permanentlyDeleteThread = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args): Promise<void> => {
    await getAuthUserId(ctx);

    // Delete metadata — thread data stays in agent component
    // (agent component doesn't expose a deleteThread mutation)
    const metadata = await ctx.db
      .query("threadMetadata")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .unique();

    if (metadata) {
      await ctx.db.delete(metadata._id);
    }
  },
});
