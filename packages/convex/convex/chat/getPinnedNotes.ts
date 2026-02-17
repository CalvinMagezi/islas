/**
 * Get Pinned Notes - Load user's pinned notes for chat context
 */

import { query } from "../_generated/server";
import { v } from "convex/values";

export const getPinnedNotes = query({
  args: {
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    // Get all pinned notes globally
    const pinnedNotes = await ctx.db
      .query("notes")
      .withIndex("by_pinned", (q) =>
        q.eq("pinned", true)
      )
      .collect();

    // Limit to 10 most recent to avoid context overflow
    const recentPinned = pinnedNotes
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 10);

    // Get notebook names for each note
    const notesWithNotebooks = await Promise.all(
      recentPinned.map(async (note) => {
        const notebook = await ctx.db.get(note.notebookId);
        return {
          title: note.title,
          content: note.content,
          notebook: notebook?.name ?? "Unknown",
          tags: note.tags,
          updatedAt: note.updatedAt,
        };
      })
    );

    return notesWithNotebooks;
  },
});
