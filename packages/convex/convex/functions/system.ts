import { mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { Id } from "../_generated/dataModel";

const SYSTEM_NOTEBOOK_NAME = "System Notes";

/**
 * Ensures the 'System Notes' notebook and core identity notes exist.
 * Returns the notebook and its pinned notes for the agent to load.
 */
export const ensureSystemIdentity = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = "local-user";

    // 1. Find or Create System Notebook
    let notebook = await ctx.db
      .query("notebooks")
      .withIndex("by_user_type", (q) => 
        q.eq("userId", userId).eq("type", "system")
      )
      .filter(q => q.eq(q.field("name"), SYSTEM_NOTEBOOK_NAME))
      .first();

    if (!notebook) {
      const id = await ctx.db.insert("notebooks", {
        userId,
        name: SYSTEM_NOTEBOOK_NAME,
        description: "Global persistence for HQ Agent (Personality, Memory, etc.)",
        tags: ["system", "islas"],
        type: "system",
        status: "active",
        color: "#10b981", // Emerald
        icon: "🧠",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      notebook = (await ctx.db.get(id))!;
    }

    // 2. Ensure Core Notes Exist
    const coreNotes = [
      { 
        title: "Personality", 
        content: "# HQ Personality\nYou are HQ, a highly capable AI agent hub designed for local-first software engineering. You are professional, concise, and proactive. You value clean code and robust architecture."
      },
      {
        title: "Memory",
        content: "# HQ Memory\nThis note stores long-term facts about the projects you work on and user preferences."
      },
      {
        title: "Heartbeat",
        content: "# Heartbeat\n\n_Add tasks below. HQ checks every 2 minutes and dispatches actionable items._\n\n\n## Recently Processed\n"
      }
    ];

    for (const core of coreNotes) {
      const existing = await ctx.db
        .query("notes")
        .withIndex("by_notebook", (q) => q.eq("notebookId", notebook!._id))
        .filter(q => q.eq(q.field("title"), core.title))
        .first();

      if (!existing) {
        await ctx.db.insert("notes", {
          notebookId: notebook._id,
          userId,
          title: core.title,
          content: core.content,
          tags: ["system"],
          pinned: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    // 3. Ensure "Insights" notebook exists for memory consolidation
    const insightsNotebook = await ctx.db
      .query("notebooks")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", userId).eq("type", "system")
      )
      .filter(q => q.eq(q.field("name"), "Insights"))
      .first();

    if (!insightsNotebook) {
      await ctx.db.insert("notebooks", {
        userId,
        name: "Insights",
        description: "Auto-generated insights from memory consolidation",
        tags: ["system", "insights"],
        type: "system",
        status: "active",
        color: "#8b5cf6",
        icon: "💡",
        generatedBy: "workflow",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return notebook._id;
  },
});

/**
 * Appends a line of text to a system note by title.
 */
export const appendToSystemNote = mutation({
  args: { title: v.string(), content: v.string() },
  handler: async (ctx, args) => {
    const userId = "local-user";
    const note = await ctx.db
      .query("notes")
      .withIndex("by_user_pinned", (q) => 
        q.eq("userId", userId).eq("pinned", true)
      )
      .filter(q => q.eq(q.field("title"), args.title))
      .first();

    if (note) {
      const newContent = note.content + "\n" + args.content;
      await ctx.db.patch(note._id, { 
        content: newContent,
        updatedAt: Date.now()
      });
    }
  },
});

/**
 * Replaces the content of a system note by title.
 * Used by the agent to update the Heartbeat note or other system notes.
 */
export const updateSystemNote = mutation({
  args: { title: v.string(), content: v.string() },
  handler: async (ctx, args) => {
    const userId = "local-user";
    const note = await ctx.db
      .query("notes")
      .withIndex("by_user_pinned", (q) =>
        q.eq("userId", userId).eq("pinned", true)
      )
      .filter(q => q.eq(q.field("title"), args.title))
      .first();

    if (note) {
      await ctx.db.patch(note._id, {
        content: args.content,
        updatedAt: Date.now(),
      });
      return { updated: true };
    }
    return { updated: false };
  },
});

/**
 * Fetches all pinned notes for the agent's context.
 */
export const getAgentContext = query({
  args: {},
  handler: async (ctx) => {
    const userId = "local-user";
    const pinnedNotes = await ctx.db
      .query("notes")
      .withIndex("by_user_pinned", (q) => 
        q.eq("userId", userId).eq("pinned", true)
      )
      .collect();
    
    return pinnedNotes.map(n => ({
      title: n.title,
      content: n.content,
    }));
  },
});
