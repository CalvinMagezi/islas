import { v } from "convex/values";
import { query, mutation, internalQuery, internalMutation } from "../_generated/server";
import { getAuthUserId } from "../lib/auth";

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 120; // per window

// Valid scopes for MCP API access
export const VALID_SCOPES = [
  // Notebook operations
  "notebooks:read",
  "notebooks:write",
  "notebooks:delete",
  "notebooks:export",
  // Note operations
  "notes:read",
  "notes:write",
  "notes:delete",
  "notes:export",
  // Search operations
  "search:text",
  "search:semantic",
  "search:advanced",
  // Memory operations
  "memory:read",
  "memory:write",
  // Project operations
  "projects:read",
  "projects:write",
  // Other operations
  "notifications:send",
  "settings:read",
  "settings:write",
] as const;

// Scope presets for ease of key creation
export const SCOPE_PRESETS = {
  // Read-only access (safe default)
  read_only: [
    "notebooks:read",
    "notes:read",
    "search:text",
    "search:semantic",
    "memory:read",
  ],
  // Claude Code (recommended)
  claude_code: [
    "notebooks:read",
    "notebooks:write",
    "notes:read",
    "notes:write",
    "search:text",
    "search:semantic",
    "search:advanced",
    "memory:read",
    "memory:write",
    "notebooks:export",
    "notes:export",
  ],
  // Full access (migration default)
  full_access: [...VALID_SCOPES],
} as const;

// Validate that all provided scopes are valid
function validateScopes(scopes: string[]): boolean {
  return scopes.every((scope) => VALID_SCOPES.includes(scope as any));
}

// Called by HTTP actions to validate an API key (no frontend auth)
export const validateKey = internalQuery({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const keyDoc = await ctx.db
      .query("apiKeys")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", args.keyHash))
      .unique();
    if (!keyDoc) return null;

    // Check expiration
    if (keyDoc.expiresAt && keyDoc.expiresAt < Date.now()) {
      return null; // Expired key treated as nonexistent
    }

    return keyDoc;
  },
});

// Fire-and-forget mutation to track last usage time
export const updateLastUsed = internalMutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const key = await ctx.db.get(args.id);
    if (key) {
      await ctx.db.patch(args.id, { lastUsedAt: Date.now() });
    }
  },
});

// Rate limiting: increment counter and check if over limit.
// Returns { allowed: true } or { allowed: false, retryAfterMs }.
export const checkAndIncrementRateLimit = internalMutation({
  args: { keyHash: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    // Quantize to the start of the current 1-minute window
    const windowStart =
      Math.floor(now / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS;

    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_key_window", (q) =>
        q.eq("keyHash", args.keyHash).eq("windowStart", windowStart),
      )
      .unique();

    if (existing) {
      if (existing.requestCount >= RATE_LIMIT_MAX_REQUESTS) {
        const retryAfterMs = windowStart + RATE_LIMIT_WINDOW_MS - now;
        return { allowed: false, retryAfterMs };
      }
      await ctx.db.patch(existing._id, {
        requestCount: existing.requestCount + 1,
      });
    } else {
      await ctx.db.insert("rateLimits", {
        keyHash: args.keyHash,
        windowStart,
        requestCount: 1,
      });

      // Clean up old windows (> 5 minutes old) to prevent table bloat
      const staleThreshold = now - 5 * 60 * 1000;
      const staleRecords = await ctx.db
        .query("rateLimits")
        .withIndex("by_key_window", (q) =>
          q.eq("keyHash", args.keyHash).lt("windowStart", staleThreshold),
        )
        .collect();
      for (const r of staleRecords) {
        await ctx.db.delete(r._id);
      }
    }

    return { allowed: true, retryAfterMs: 0 };
  },
});

// Client sends the hash and prefix — plaintext never reaches the server
export const create = mutation({
  args: {
    name: v.string(),
    keyHash: v.string(),
    prefix: v.string(),
    scopes: v.optional(v.array(v.string())),
    preset: v.optional(v.union(
      v.literal("read_only"),
      v.literal("claude_code"),
      v.literal("full_access")
    )),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);

    // Determine scopes: preset > explicit scopes > read_only default
    let scopes: string[];
    if (args.preset) {
      scopes = [...SCOPE_PRESETS[args.preset]];
    } else if (args.scopes && args.scopes.length > 0) {
      scopes = args.scopes;
    } else {
      scopes = [...SCOPE_PRESETS.read_only];
    }

    // Validate all scopes are valid
    if (!validateScopes(scopes)) {
      const invalidScopes = scopes.filter((s) => !VALID_SCOPES.includes(s as any));
      throw new Error(
        `Invalid scopes: ${invalidScopes.join(", ")}. Valid scopes are: ${VALID_SCOPES.join(", ")}`
      );
    }

    // Default expiration: 90 days
    const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;

    return ctx.db.insert("apiKeys", {
      userId,
      name: args.name,
      keyHash: args.keyHash,
      prefix: args.prefix,
      scopes,
      createdAt: Date.now(),
      expiresAt,
    });
  },
});

export const revoke = mutation({
  args: { id: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const key = await ctx.db.get(args.id);
    if (!key || key.userId !== userId) {
      throw new Error("API key not found");
    }
    await ctx.db.delete(args.id);
  },
});

export const listKeys = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});
