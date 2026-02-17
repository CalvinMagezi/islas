import { v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getAuthUserId } from "../lib/auth";

export const log = mutation({
  args: {
    threadId: v.optional(v.string()),
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    cost: v.float64(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    return ctx.db.insert("usageLog", {
      userId,
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const getStats = query({
  args: {
    threadId: v.optional(v.string()),
    periodMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const since = args.periodMs ? Date.now() - args.periodMs : 0;

    let logs;
    if (args.threadId) {
      logs = await ctx.db
        .query("usageLog")
        .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
        .collect();
    } else {
      logs = await ctx.db
        .query("usageLog")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
    }

    const filtered = logs.filter((l) => l.timestamp >= since);

    const totals = filtered.reduce(
      (acc, l) => ({
        promptTokens: acc.promptTokens + l.promptTokens,
        completionTokens: acc.completionTokens + l.completionTokens,
        totalTokens: acc.totalTokens + l.totalTokens,
        cost: acc.cost + l.cost,
      }),
      { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 },
    );

    const byModel = filtered.reduce(
      (acc, l) => {
        if (!acc[l.model]) acc[l.model] = { tokens: 0, cost: 0 };
        acc[l.model].tokens += l.totalTokens;
        acc[l.model].cost += l.cost;
        return acc;
      },
      {} as Record<string, { tokens: number; cost: number }>,
    );

    return {
      ...totals,
      requestCount: filtered.length,
      breakdown: Object.entries(byModel).map(([model, data]) => ({
        model,
        tokens: data.tokens,
        cost: data.cost,
      })),
    };
  },
});
