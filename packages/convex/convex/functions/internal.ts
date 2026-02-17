import { v } from "convex/values";
import { internalQuery, internalMutation } from "../_generated/server";

// --- Memories ---

export const listMemories = internalQuery({
  args: {
    userId: v.string(),
    category: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // Return notes from "Memories" notebook or with memory tags
    // For this migration, we'll assume the agent will manage categories as tags.
    // But to find "Memories" helper, we might need to look up the "Memories" notebook first.

    const notebook = await ctx.db
      .query("notebooks")
      .filter(q => q.eq(q.field("name"), "Memories"))
      .first();

    if (!notebook) return [];

    let notes = await ctx.db
      .query("notes")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebook._id))
      .collect();

    if (args.category) {
      notes = notes.filter(n => n.tags.includes(args.category!));
    }

    return notes;
  },
});

export const searchMemories = internalQuery({
  args: { userId: v.string(), query: v.string() },
  handler: async (ctx, args) => {
    // Search all notes for now, or restrict to Memories notebook if strictly needed.
    // The user wants "consolidation", so searching all notes is actually better.
    return ctx.db
      .query("notes")
      .withSearchIndex("search_content", (q) =>
        q.search("content", args.query),
      )
      .take(20);
  },
});

export const countMemories = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const notebook = await ctx.db
      .query("notebooks")
      .filter(q => q.eq(q.field("name"), "Memories"))
      .first();

    if (!notebook) return 0;

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebook._id))
      .collect();

    return notes.length;
  },
});

export const storeMemory = internalMutation({
  args: {
    userId: v.string(),
    content: v.string(),
    category: v.union(
      v.literal("learning"),
      v.literal("preference"),
      v.literal("fact"),
      v.literal("project_context"),
      v.literal("decision"),
    ),
    tags: v.array(v.string()),
    source: v.string(),
    importance: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    // Find or create "Memories" notebook
    let notebook = await ctx.db
      .query("notebooks")
      .filter(q => q.eq(q.field("name"), "Memories"))
      .first();

    if (!notebook) {
      notebook = await ctx.db.get(
        await ctx.db.insert("notebooks", {
          userId: args.userId,
          name: "Memories",
          description: "System notebook for agent memories",
          tags: ["system", "memory"],
          type: "system",
          status: "active",
          color: "#6366f1",
          icon: "🧠",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        })
      );
    }

    const now = Date.now();
    // Store importance as a tag since metadata doesn't have importance field
    const noteTags = [...args.tags, args.category];
    if (args.importance && args.importance > 0.8) {
      noteTags.push("high-importance");
    }
    
    const noteId = await ctx.db.insert("notes", {
      notebookId: notebook!._id,
      userId: args.userId,
      title: args.category.charAt(0).toUpperCase() + args.category.slice(1),
      content: args.content,
      tags: noteTags,
      metadata: {
        source: args.source,
        context: `Category: ${args.category}`,
      },
      pinned: args.importance ? args.importance > 0.8 : false,
      createdAt: now,
      updatedAt: now,
    });

    return { noteId, notebookId: notebook!._id };
  },
});

export const updateMemory = internalMutation({
  args: {
    id: v.id("notes"),
    content: v.optional(v.string()),
    category: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    importance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.id);
    if (!note) throw new Error("Memory not found");

    const updates: any = { updatedAt: Date.now() };
    if (args.content) updates.content = args.content;
    if (args.tags) updates.tags = args.tags;
    if (args.importance !== undefined) updates.pinned = args.importance > 0.8;
    if (args.category) {
      updates.title = args.category.charAt(0).toUpperCase() + args.category.slice(1);
    }

    await ctx.db.patch(args.id, updates);
    return { updated: true };
  },
});

export const deleteMemory = internalMutation({
  args: {
    id: v.id("notes"),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.id);
    if (!note) throw new Error("Memory not found");
    
    await ctx.db.delete(args.id);
    return { deleted: true };
  },
});

// --- User Profiles ---
// For now we still track user profiles for agent context, but notes are global.

export const getUserContext = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    // Query users directly without relying on clerkId index
    const users = await ctx.db
      .query("users")
      .collect();

    // Legacy field: clerkId was from previous Clerk integration, now unused
    const user = users.find(u => (u as any).clerkId === args.userId);

    if (!user) return null;

    // Get statistics
    const notebooksCount = await ctx.db
      .query("notebooks")
      .collect();

    const notesCount = await ctx.db
      .query("notes")
      .collect();

    return {
      user,
      stats: {
        notebooks: notebooksCount.length,
        notes: notesCount.length,
      }
    };
  },
});

// --- Projects ---
// Projects are notebooks of type "project"

export const listProjects = internalQuery({
  args: { userId: v.string(), status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("notebooks")
      .withIndex("by_type", (q) =>
        q.eq("type", "project")
      );

    // Manual filtering for status since composite index might not cover "type" AND "status" perfectly 
    const results = await query.collect();

    if (args.status) {
      return results.filter(p => p.status === args.status);
    }

    return results.filter(p => p.status !== "deleted");
  },
});

export const countProjects = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const projects = await ctx.db
      .query("notebooks")
      .filter((q) => q.eq(q.field("type"), "project"))
      .collect();
    return projects.length;
  },
});

export const getProject = internalQuery({
  args: { id: v.id("notebooks") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const createProject = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    goals: v.optional(v.array(v.string())),
    techStack: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const projectId = await ctx.db.insert("notebooks", {
      userId: args.userId,
      name: args.name,
      description: args.description || "Project notebook",
      tags: args.techStack || [],
      type: "project",
      status: "active",
      color: "#10b981",
      icon: "📁",
      createdAt: now,
      updatedAt: now,
    });

    return { projectId, name: args.name };
  },
});

export const updateProject = internalMutation({
  args: {
    id: v.id("notebooks"),
    userId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    goals: v.optional(v.array(v.string())),
    techStack: v.optional(v.array(v.string())),
    status: v.optional(v.union(v.literal("active"), v.literal("archived"), v.literal("completed"))),
    currentFocus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get(args.id);
    if (!project || project.type !== "project") {
      throw new Error("Project not found");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.name) updates.name = args.name;
    if (args.description) updates.description = args.description;
    if (args.status) updates.status = args.status;
    if (args.techStack) updates.tags = args.techStack;

    await ctx.db.patch(args.id, updates);
    return { id: args.id, updated: true };
  },
});

// --- Settings ---

export const listSettings = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("settings")
      .withIndex("by_user_key", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const setSetting = internalMutation({
  args: {
    userId: v.string(),
    key: v.string(),
    value: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("settings")
      .withIndex("by_user_key", (q) => q.eq("userId", args.userId).eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        updatedAt: Date.now(),
      });
      return { id: existing._id, updated: true };
    }

    const id = await ctx.db.insert("settings", {
      userId: args.userId,
      key: args.key,
      value: args.value,
      updatedAt: Date.now(),
    });

    return { id, created: true };
  },
});

// --- Usage Tracking ---

export const logUsage = internalMutation({
  args: {
    userId: v.string(),
    threadId: v.optional(v.string()),
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    cost: v.float64(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("usageLog", {
      userId: args.userId,
      threadId: args.threadId,
      model: args.model,
      promptTokens: args.promptTokens,
      completionTokens: args.completionTokens,
      totalTokens: args.totalTokens,
      cost: args.cost,
      timestamp: Date.now(),
    });
  },
});

export const getUsageStats = internalQuery({
  args: {
    userId: v.string(),
    threadId: v.optional(v.string()),
    periodMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
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
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
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
