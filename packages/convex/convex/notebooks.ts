import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

/**
 * Public: List user's notebooks
 */
export const list = query({
  args: {
    status: v.optional(v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("deleted"),
    )),
  },
  handler: async (ctx, args) => {
    let notebooksQuery;
    if (args.status) {
      notebooksQuery = ctx.db
        .query("notebooks")
        .withIndex("by_status", (q) => q.eq("status", args.status!));
    } else {
      // Default: exclude deleted
      notebooksQuery = ctx.db
        .query("notebooks")
        .filter((q) => q.neq(q.field("status"), "deleted"));
    }

    return await notebooksQuery.order("desc").collect();
  },
});

/**
 * Public: Get notes for a notebook or all notes
 */
export const getNotes = query({
  args: {
    notebookId: v.optional(v.id("notebooks")),
    pinnedOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    let results;

    if (args.notebookId !== undefined) {
      // Filter by specific notebook
      const notebook = await ctx.db.get(args.notebookId);
      if (!notebook) {
        throw new Error("Notebook not found");
      }

      results = await ctx.db
        .query("notes")
        .withIndex("by_notebook", (q) => q.eq("notebookId", args.notebookId!))
        .order("desc")
        .collect();
    } else if (args.pinnedOnly) {
      // Show only pinned notes
      results = await ctx.db
        .query("notes")
        .withIndex("by_pinned", (q) =>
          q.eq("pinned", true)
        )
        .order("desc")
        .collect();
    } else {
      // Show all notes
      results = await ctx.db
        .query("notes")
        .order("desc")
        .collect();
    }

    // Apply limit if specified
    if (args.limit) {
      results = results.slice(0, args.limit);
    }

    return results;
  },
});

/**
 * Public: Search notes by content
 */
export const searchNotes = query({
  args: {
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
 * Public: Get a single note
 */
export const getNote = query({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    return note;
  },
});

/**
 * Public: Toggle note pin status
 */
export const togglePin = mutation({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    await ctx.db.patch(args.noteId, {
      pinned: !note.pinned,
      updatedAt: Date.now(),
    });

    return { noteId: args.noteId, pinned: !note.pinned };
  },
});

/**
 * Public: Create a new note
 */
export const createNote = mutation({
  args: {
    notebookId: v.id("notebooks"),
    title: v.string(),
    content: v.string(),
    tags: v.optional(v.array(v.string())),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = "local-user";

    // Verify notebook exists
    const notebook = await ctx.db.get(args.notebookId);
    if (!notebook) {
      throw new Error("Notebook not found");
    }

    const now = Date.now();
    const noteId = await ctx.db.insert("notes", {
      notebookId: args.notebookId,
      userId: userId,
      title: args.title,
      content: args.content,
      tags: args.tags ?? [],
      metadata: undefined,
      pinned: args.pinned ?? false,
      createdAt: now,
      updatedAt: now,
    });

    // Update notebook's updatedAt
    await ctx.db.patch(args.notebookId, { updatedAt: now });

    return { noteId, title: args.title, createdAt: now };
  },
});

/**
 * Public: Update an existing note
 */
export const updateNote = mutation({
  args: {
    noteId: v.id("notes"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
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
    if (args.pinned !== undefined) updates.pinned = args.pinned;

    await ctx.db.patch(args.noteId, updates);

    // Update notebook's updatedAt
    await ctx.db.patch(note.notebookId, { updatedAt: Date.now() });

    return { noteId: args.noteId, updated: true };
  },
});

/**
 * Public: Delete a note
 */
export const deleteNote = mutation({
  args: {
    noteId: v.id("notes"),
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
 * Internal: Create a note (called by HTTP action with API key auth)
 */
export const createNoteInternal = internalMutation({
  args: {
    userId: v.string(),
    notebookId: v.id("notebooks"),
    title: v.string(),
    content: v.string(),
    tags: v.optional(v.array(v.string())),
    pinned: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = "local-user"; // Override for local

    // Verify notebook exists
    const notebook = await ctx.db.get(args.notebookId);
    if (!notebook) {
      throw new Error("Notebook not found");
    }

    const now = Date.now();
    const noteId = await ctx.db.insert("notes", {
      notebookId: args.notebookId,
      userId: userId,
      title: args.title,
      content: args.content,
      tags: args.tags ?? [],
      metadata: undefined,
      pinned: args.pinned ?? false,
      createdAt: now,
      updatedAt: now,
    });

    // Update notebook's updatedAt
    await ctx.db.patch(args.notebookId, { updatedAt: now });

    return { noteId, title: args.title, createdAt: now };
  },
});

/**
 * Internal: Find or get a notebook by name
 */
export const findNotebookByName = internalMutation({
  args: {
    userId: v.string(),
    name: v.string(),
    createIfMissing: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = "local-user"; // Override for local

    // Search for existing notebook
    const notebooks = await ctx.db
      .query("notebooks")
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    const existing = notebooks.find((nb) => nb.name === args.name);
    if (existing) {
      return { notebookId: existing._id };
    }

    // Create if requested
    if (args.createIfMissing) {
      const now = Date.now();
      const notebookId = await ctx.db.insert("notebooks", {
        userId: userId,
        name: args.name,
        description: "Auto-created for plans",
        tags: ["plans"],
        type: "personal",
        status: "active",
        color: "#3b82f6",
        icon: "📋",
        createdAt: now,
        updatedAt: now,
      });
      return { notebookId };
    }

    throw new Error("Notebook not found");
  },
});

/**
 * Internal: Get a single note by ID (for agent tools)
 */
export const getNoteInternal = internalQuery({
  args: {
    userId: v.string(),
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    const note = await ctx.db.get(args.noteId);
    if (!note) {
      return null;
    }
    return note;
  },
});

/**
 * Internal: Get notes for a user (for RAG tools)
 */
export const getNotesInternal = internalQuery({
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
      const notebook = await ctx.db.get(args.notebookId);
      if (!notebook) {
        throw new Error("Notebook not found");
      }

      results = await ctx.db
        .query("notes")
        .withIndex("by_notebook", (q) => q.eq("notebookId", args.notebookId!))
        .order("desc")
        .collect();
    } else if (args.pinnedOnly) {
      // Show only pinned notes
      results = await ctx.db
        .query("notes")
        .withIndex("by_pinned", (q) =>
          q.eq("pinned", true)
        )
        .order("desc")
        .collect();
    } else {
      // Show all notes
      results = await ctx.db
        .query("notes")
        .order("desc")
        .collect();
    }

    // Apply limit if specified
    if (args.limit) {
      results = results.slice(0, args.limit);
    }

    return results;
  },
});

/**
 * Public: Create a new notebook
 */
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
    const now = Date.now();
    const notebookId = await ctx.db.insert("notebooks", {
      userId: "", // Will be set by auth
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
