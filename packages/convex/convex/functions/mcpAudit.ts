import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Log an MCP API request to the audit trail
 * Called by the Next.js gateway after each request
 */
export const logRequest = internalMutation({
  args: {
    userId: v.string(),
    keyId: v.id("apiKeys"),
    method: v.string(),
    toolName: v.optional(v.string()),
    success: v.boolean(),
    errorCode: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    requestDurationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("mcpAuditLog", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

/**
 * Get audit log entries for a user
 * Returns paginated results ordered by timestamp descending
 */
export const getAuditLog = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 100;
    const offset = args.offset ?? 0;

    const entries = await ctx.db
      .query("mcpAuditLog")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit + offset);

    return {
      entries: entries.slice(offset, offset + limit),
      hasMore: entries.length > offset + limit,
      total: entries.length,
    };
  },
});

/**
 * Get aggregated metrics from the audit log
 * Used for monitoring and alerting
 */
export const getMetrics = internalQuery({
  args: {
    userId: v.optional(v.string()),
    keyId: v.optional(v.id("apiKeys")),
    toolName: v.optional(v.string()),
    startTime: v.optional(v.number()),
    endTime: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const startTime = args.startTime ?? Date.now() - 24 * 60 * 60 * 1000; // Last 24h
    const endTime = args.endTime ?? Date.now();

    // Query audit log based on provided filters
    let entries;

    if (args.userId) {
      const userId = args.userId;
      entries = await ctx.db
        .query("mcpAuditLog")
        .withIndex("by_user", (q) =>
          q.eq("userId", userId).gte("timestamp", startTime).lte("timestamp", endTime)
        )
        .collect();
    } else if (args.keyId) {
      const keyId = args.keyId;
      entries = await ctx.db
        .query("mcpAuditLog")
        .withIndex("by_key", (q) =>
          q.eq("keyId", keyId).gte("timestamp", startTime).lte("timestamp", endTime)
        )
        .collect();
    } else if (args.toolName) {
      const toolName = args.toolName;
      entries = await ctx.db
        .query("mcpAuditLog")
        .withIndex("by_tool", (q) =>
          q.eq("toolName", toolName).gte("timestamp", startTime).lte("timestamp", endTime)
        )
        .collect();
    } else {
      entries = await ctx.db
        .query("mcpAuditLog")
        .withIndex("by_timestamp", (q) =>
          q.gte("timestamp", startTime).lte("timestamp", endTime)
        )
        .collect();
    }

    // Calculate metrics
    const totalRequests = entries.length;
    const successfulRequests = entries.filter((e) => e.success).length;
    const failedRequests = totalRequests - successfulRequests;
    const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;

    // Tool usage breakdown
    const toolUsage: Record<string, number> = {};
    for (const entry of entries) {
      if (entry.toolName) {
        toolUsage[entry.toolName] = (toolUsage[entry.toolName] ?? 0) + 1;
      }
    }

    // Error breakdown
    const errors: Record<string, number> = {};
    for (const entry of entries.filter((e) => !e.success)) {
      const errorKey = entry.errorCode
        ? `${entry.errorCode}: ${entry.errorMessage || "Unknown"}`
        : entry.errorMessage || "Unknown error";
      errors[errorKey] = (errors[errorKey] ?? 0) + 1;
    }

    // Average request duration
    const durations = entries
      .map((e) => e.requestDurationMs)
      .filter((d): d is number => d !== undefined);
    const avgDuration = durations.length > 0
      ? durations.reduce((a, b) => a + b, 0) / durations.length
      : 0;

    // Request rate (requests per minute)
    const timeRangeMinutes = (endTime - startTime) / (60 * 1000);
    const requestRate = timeRangeMinutes > 0 ? totalRequests / timeRangeMinutes : 0;

    return {
      totalRequests,
      successfulRequests,
      failedRequests,
      errorRate,
      requestRate,
      avgDurationMs: avgDuration,
      toolUsage,
      errors,
      timeRange: {
        start: startTime,
        end: endTime,
      },
    };
  },
});
