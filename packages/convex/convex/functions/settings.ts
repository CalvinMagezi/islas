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

// Discord-specific helpers
export const getDiscordSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    const keys = [
      "discord_bot_token",
      "discord_user_id",
      "discord_channel_id",
      "discord_webhook_url",
      "discord_enable_presence",
      "discord_presence_type",
    ];

    const settings: Record<string, string | undefined> = {};

    for (const key of keys) {
      const setting = await ctx.db
        .query("settings")
        .withIndex("by_user_key", (q) =>
          q.eq("userId", userId).eq("key", key),
        )
        .unique();
      if (setting) {
        settings[key] = setting.value;
      }
    }

    return {
      botToken: settings.discord_bot_token,
      userId: settings.discord_user_id,
      channelId: settings.discord_channel_id,
      webhookUrl: settings.discord_webhook_url,
      enablePresence: settings.discord_enable_presence === "true",
      presenceType: (settings.discord_presence_type as "activity" | "custom-status") || "activity",
    };
  },
});

export const updateDiscordPresence = mutation({
  args: {
    enablePresence: v.boolean(),
    presenceType: v.optional(v.union(v.literal("activity"), v.literal("custom-status"))),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Update enable_presence setting
    const existingEnable = await ctx.db
      .query("settings")
      .withIndex("by_user_key", (q) =>
        q.eq("userId", userId).eq("key", "discord_enable_presence"),
      )
      .unique();

    if (existingEnable) {
      await ctx.db.patch(existingEnable._id, {
        value: args.enablePresence.toString(),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("settings", {
        userId,
        key: "discord_enable_presence",
        value: args.enablePresence.toString(),
        updatedAt: Date.now(),
      });
    }

    // Update presence_type if provided
    if (args.presenceType) {
      const existingType = await ctx.db
        .query("settings")
        .withIndex("by_user_key", (q) =>
          q.eq("userId", userId).eq("key", "discord_presence_type"),
        )
        .unique();

      if (existingType) {
        await ctx.db.patch(existingType._id, {
          value: args.presenceType,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert("settings", {
          userId,
          key: "discord_presence_type",
          value: args.presenceType,
          updatedAt: Date.now(),
        });
      }
    }

    return { success: true };
  },
});

// Test Discord connection
export const testDiscordConnection = action({
  args: {
    botToken: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const response = await fetch("https://discord.com/api/v10/users/@me", {
        headers: {
          Authorization: `Bot ${args.botToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = "Invalid bot token";

        if (response.status === 401) {
          errorMessage = "Invalid bot token or unauthorized";
        } else if (response.status === 429) {
          errorMessage = "Rate limited. Please try again in a moment";
        } else if (response.status >= 500) {
          errorMessage = "Discord service unavailable. Try again later";
        }

        return {
          success: false,
          error: errorMessage,
          statusCode: response.status,
        };
      }

      const botUser = await response.json();

      return {
        success: true,
        botUser: {
          id: botUser.id,
          username: botUser.username,
          discriminator: botUser.discriminator,
          avatar: botUser.avatar,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to connect to Discord",
      };
    }
  },
});
