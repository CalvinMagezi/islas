import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery, internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { getAuthUserId } from "../lib/auth";

// Internal function - userId passed explicitly (no auth check needed)
export const insertNotification = internalMutation({
  args: {
    userId: v.string(),
    sessionId: v.optional(v.string()),
    type: v.union(
      v.literal("permission_prompt"),
      v.literal("idle_prompt"),
      v.literal("auth_success"),
      v.literal("task_complete"),
      v.literal("stop"),
      v.literal("info"),
    ),
    message: v.string(),
    title: v.optional(v.string()),
    project: v.optional(v.string()),
    host: v.optional(v.string()),
    cwd: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("notifications", {
      ...args,
      read: false,
    });

    // Fire-and-forget: relay to Discord webhook if configured
    if (args.type === "permission_prompt" || args.type === "task_complete") {
      await ctx.scheduler.runAfter(
        0,
        internal.functions.notifications.relayToDiscordWebhook,
        {
          userId: args.userId,
          title: args.title || args.type,
          message: args.message,
          type: args.type,
        },
      );
    }

    return id;
  },
});

// Internal function - userId passed explicitly (no auth check needed)
export const listInternal = internalQuery({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    return ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
  },
});

export const unreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", userId).eq("read", false),
      )
      .collect();
    return unread.length;
  },
});

export const list = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const limit = args.limit ?? 50;
    return ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit);
  },
});

export const markAsRead = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const notification = await ctx.db.get(args.id);
    if (!notification || notification.userId !== userId) {
      throw new Error("Notification not found");
    }
    await ctx.db.patch(args.id, { read: true });
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) =>
        q.eq("userId", userId).eq("read", false),
      )
      .collect();
    for (const n of unread) {
      await ctx.db.patch(n._id, { read: true });
    }
    return { marked: unread.length };
  },
});

export const dismiss = mutation({
  args: { id: v.id("notifications") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const notification = await ctx.db.get(args.id);
    if (!notification || notification.userId !== userId) {
      throw new Error("Notification not found");
    }
    await ctx.db.delete(args.id);
  },
});

export const clearAll = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    for (const n of notifications) {
      await ctx.db.delete(n._id);
    }

    return { deleted: notifications.length };
  },
});

// ── Discord Webhook Relay (fire-and-forget from insertNotification) ──

export const relayToDiscordWebhook = internalAction({
  args: {
    userId: v.string(),
    title: v.string(),
    message: v.string(),
    type: v.string(),
  },
  handler: async (ctx, args) => {
    // Look up user's Discord webhook URL from settings
    const setting = await ctx.runQuery(
      internal.functions.settings.getByUserKey,
      { userId: args.userId, key: "discord_webhook_url" },
    );

    if (!setting?.value) return;

    const color = args.type === "permission_prompt" ? 0xf59e0b : 0x22c55e;
    const emoji = args.type === "permission_prompt" ? "🛡️" : "✅";

    try {
      await fetch(setting.value, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [{
            title: `${emoji} ${args.title}`,
            description: args.message.substring(0, 500),
            color,
            timestamp: new Date().toISOString(),
          }],
        }),
      });
    } catch {
      // Webhook failures are non-critical
    }
  },
});

