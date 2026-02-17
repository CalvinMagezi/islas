import { internalMutation, internalQuery, query, mutation } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { getAuthUserId } from "../lib/auth";

/**
 * Internal: Get a notebook by ID
 */
export const getNotebookInternal = internalQuery({
  args: {
    notebookId: v.id("notebooks"),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.notebookId);
  },
});

/**
 * Internal: Create a notebook
 */
export const createNotebookInternal = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    type: v.optional(v.union(
      v.literal("personal"),
      v.literal("system"),
      v.literal("digest"),
      v.literal("project"),
    )),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const notebookId = await ctx.db.insert("notebooks", {
      userId: args.userId,
      name: args.name,
      description: args.description,
      tags: args.tags ?? [],
      type: args.type ?? "personal",
      status: "active",
      color: args.color,
      icon: args.icon,
      createdAt: now,
      updatedAt: now,
    });

    return { notebookId, name: args.name, createdAt: now };
  },
});

/**
 * Internal: List notebooks
 */
export const listNotebooksInternal = internalQuery({
  args: {
    userId: v.string(),
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("deleted"),
    )),
  },
  handler: async (ctx, args) => {
    let q;
    if (args.status) {
      q = ctx.db
        .query("notebooks")
        .withIndex("by_status", (q) => q.eq("status", args.status!));
    } else {
      q = ctx.db
        .query("notebooks")
        .filter((q) => q.neq(q.field("status"), "deleted"));
    }

    return await q.order("desc").collect();
  },
});

/**
 * Internal: Search notebooks by name
 */
export const searchNotebooksInternal = internalQuery({
  args: {
    userId: v.string(),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("notebooks")
      .withSearchIndex("search_name", (q) =>
        q.search("name", args.query).eq("status", "active")
      )
      .take(20);

    return results;
  },
});

/**
 * Internal: Update notebook
 */
export const updateNotebookInternal = internalMutation({
  args: {
    notebookId: v.id("notebooks"),
    userId: v.string(),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("deleted"),
    )),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notebook = await ctx.db.get(args.notebookId);
    if (!notebook) {
      throw new Error("Notebook not found");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.status !== undefined) updates.status = args.status;
    if (args.color !== undefined) updates.color = args.color;
    if (args.icon !== undefined) updates.icon = args.icon;

    await ctx.db.patch(args.notebookId, updates);
    return { notebookId: args.notebookId, updated: true };
  },
});

/**
 * Internal: Create a note
 */
export const createNoteInternal = internalMutation({
  args: {
    userId: v.string(),
    notebookId: v.id("notebooks"),
    title: v.string(),
    content: v.string(),
    tags: v.optional(v.array(v.string())),
    metadata: v.optional(v.object({
      source: v.optional(v.string()),
      context: v.optional(v.string()),
      references: v.optional(v.array(v.string())),
    })),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Verify notebook exists
    const notebook = await ctx.db.get(args.notebookId);
    if (!notebook) {
      throw new Error("Notebook not found");
    }

    const now = Date.now();
    const noteId = await ctx.db.insert("notes", {
      notebookId: args.notebookId,
      userId: args.userId,
      title: args.title,
      content: args.content,
      tags: args.tags ?? [],
      metadata: args.metadata,
      pinned: args.pinned ?? false,
      createdAt: now,
      updatedAt: now,
      // Trigger embedding generation
      embeddingStatus: "pending",
    });

    // Update notebook's updatedAt
    await ctx.db.patch(args.notebookId, { updatedAt: now });

    // Schedule embedding processing
    await ctx.scheduler.runAfter(0, internal.embeddings.processPendingEmbeddings, {});

    return { noteId, title: args.title, createdAt: now };
  },
});

/**
 * Internal: List notes in a notebook
 */
export const listNotesInternal = internalQuery({
  args: {
    userId: v.string(),
    notebookId: v.optional(v.id("notebooks")),
    pinnedOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let results;

    if (args.notebookId !== undefined) {
      // Filter by specific notebook
      results = await ctx.db
        .query("notes")
        .withIndex("by_notebook", (q) => q.eq("notebookId", args.notebookId!))
        .order("desc")
        .take(args.limit ?? 100);
    } else if (args.pinnedOnly) {
      // Show only pinned notes
      results = await ctx.db
        .query("notes")
        .withIndex("by_pinned", (q) =>
          q.eq("pinned", true)
        )
        .order("desc")
        .take(args.limit ?? 100);
    } else {
      // Show all notes
      results = await ctx.db
        .query("notes")
        .order("desc")
        .take(args.limit ?? 100);
    }

    return results;
  },
});

/**
 * Internal: Search notes
 */
export const searchNotesInternal = internalQuery({
  args: {
    userId: v.string(),
    query: v.string(),
    notebookId: v.optional(v.id("notebooks")),
  },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query("notes")
      .withSearchIndex("search_content", (q) => {
        let search = q.search("content", args.query);
        if (args.notebookId !== undefined) {
          search = search.eq("notebookId", args.notebookId);
        }
        return search;
      })
      .take(50);

    return results;
  },
});

/**
 * Internal: Update a note
 */
export const updateNoteInternal = internalMutation({
  args: {
    noteId: v.id("notes"),
    userId: v.string(), // Kept for API compatibility, but not used for access check
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    metadata: v.optional(v.object({
      source: v.optional(v.string()),
      context: v.optional(v.string()),
      references: v.optional(v.array(v.string())),
    })),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.content !== undefined) updates.content = args.content;
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.metadata !== undefined) updates.metadata = args.metadata;
    if (args.pinned !== undefined) updates.pinned = args.pinned;

    // Re-trigger embedding if title or content changed
    if (args.title !== undefined || args.content !== undefined) {
      updates.embeddingStatus = "pending";
    }

    await ctx.db.patch(args.noteId, updates);

    // Update notebook's updatedAt
    await ctx.db.patch(note.notebookId, { updatedAt: Date.now() });

    // Schedule embedding processing if content changed
    if (args.title !== undefined || args.content !== undefined) {
      await ctx.scheduler.runAfter(0, internal.embeddings.processPendingEmbeddings, {});
    }

    return { noteId: args.noteId, updated: true };
  },
});

/**
 * Internal: Delete a note
 */
export const deleteNoteInternal = internalMutation({
  args: {
    noteId: v.id("notes"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    await ctx.db.delete(args.noteId);

    // Update notebook's updatedAt
    await ctx.db.patch(note.notebookId, { updatedAt: Date.now() });

    return { noteId: args.noteId, deleted: true };
  },
});

/**
 * Internal: Get note by ID
 */
export const getNoteInternal = internalQuery({
  args: {
    noteId: v.id("notes"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) {
      throw new Error("Note not found");
    }
    return note;
  },
});

// --- Public API ---

export const listNotebooks = query({
  args: {
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("deleted"),
    )),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx); // Still require authentication
    let q;
    if (args.status) {
      q = ctx.db
        .query("notebooks")
        .withIndex("by_status", (query) => query.eq("status", args.status!));
    } else {
      q = ctx.db
        .query("notebooks")
        .filter((query) => query.neq(query.field("status"), "deleted"));
    }

    return await q.order("desc").collect();
  },
});

export const listNotes = query({
  args: {
    notebookId: v.optional(v.id("notebooks")),
    pinnedOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx); // Still require authentication
    let results;

    if (args.notebookId !== undefined) {
      const notebook = await ctx.db.get(args.notebookId);
      if (!notebook) {
        throw new Error("Notebook not found");
      }
      results = await ctx.db
        .query("notes")
        .withIndex("by_notebook", (q) => q.eq("notebookId", args.notebookId!))
        .order("desc")
        .take(args.limit ?? 100);
    } else if (args.pinnedOnly) {
      results = await ctx.db
        .query("notes")
        .withIndex("by_pinned", (q) =>
          q.eq("pinned", true)
        )
        .order("desc")
        .take(args.limit ?? 100);
    } else {
      results = await ctx.db
        .query("notes")
        .order("desc")
        .take(args.limit ?? 100);
    }

    return results;
  },
});

export const getNotebook = query({
  args: { notebookId: v.id("notebooks") },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    const notebook = await ctx.db.get(args.notebookId);
    if (!notebook) {
      return null;
    }
    return notebook;
  },
});

export const getNote = query({
  args: { noteId: v.id("notes") },
  handler: async (ctx, args) => {
    await getAuthUserId(ctx);
    const note = await ctx.db.get(args.noteId);
    if (!note) {
      return null;
    }
    return note;
  },
});

// Public create mutations
export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    type: v.optional(v.union(
      v.literal("personal"),
      v.literal("system"),
      v.literal("digest"),
      v.literal("project"),
    )),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    const notebookId = await ctx.db.insert("notebooks", {
      userId,
      name: args.name,
      description: args.description,
      tags: args.tags ?? [],
      type: args.type ?? "personal",
      status: "active",
      color: args.color,
      icon: args.icon,
      createdAt: now,
      updatedAt: now,
    });

    return { notebookId, name: args.name, createdAt: now };
  },
});

export const createNote = mutation({
  args: {
    notebookId: v.id("notebooks"),
    title: v.string(),
    content: v.string(),
    tags: v.optional(v.array(v.string())),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const now = Date.now();
    const noteId = await ctx.db.insert("notes", {
      notebookId: args.notebookId,
      userId,
      title: args.title,
      content: args.content,
      tags: args.tags ?? [],
      pinned: args.pinned ?? false,
      embeddingStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return { noteId, title: args.title, createdAt: now };
  },
});

export const updateNote = mutation({
  args: {
    noteId: v.id("notes"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found or access denied");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.title !== undefined) updates.title = args.title;
    if (args.content !== undefined) {
      updates.content = args.content;
      updates.embeddingStatus = "pending";
    }
    if (args.tags !== undefined) updates.tags = args.tags;
    if (args.pinned !== undefined) updates.pinned = args.pinned;

    await ctx.db.patch(args.noteId, updates);
    return { noteId: args.noteId, updated: true };
  },
});

export const togglePin = mutation({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const note = await ctx.db.get(args.noteId);
    if (!note || note.userId !== userId) {
      throw new Error("Note not found or access denied");
    }

    await ctx.db.patch(args.noteId, {
      pinned: !note.pinned,
      updatedAt: Date.now(),
    });

    return { noteId: args.noteId, pinned: !note.pinned };
  },
});
