import { v } from "convex/values";
import { query, mutation, internalQuery, action } from "../_generated/server";
import { getAuthUserId } from "../lib/auth";

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const setting = await ctx.db
      .query("settings")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", userId).eq("key", args.key),
      )
      .unique();
    return setting;
  },
});

export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return ctx.db
      .query("settings")
      .withIndex("by_user_key", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const set = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", userId).eq("key", args.key),
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return ctx.db.insert("settings", {
      userId,
      key: args.key,
      value: args.value,
      updatedAt: Date.now(),
    });
  },
});

// Internal getter for server-side use (no auth required)
export const getByUserKey = internalQuery({
  args: { userId: v.string(), key: v.string() },
  handler: async (ctx, args) => {
    return ctx.db
      .query("settings")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", args.userId).eq("key", args.key),
      )
      .unique();
  },
});

export const remove = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", userId).eq("key", args.key),
      )
      .unique();
    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
