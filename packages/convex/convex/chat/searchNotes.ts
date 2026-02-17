/**
 * RAG Search Tool - Search through notebooks and notes
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { Doc } from "../_generated/dataModel";

interface SearchResult {
  noteId: string;
  title: string;
  notebook: string;
  notebookId: string;
  snippet: string;
  tags: string[];
  relevance: number;
}

export const searchNotes = action({
  args: {
    query: v.string(),
    userId: v.string(),
    limit: v.optional(v.number()),
    notebookId: v.optional(v.id("notebooks")),
  },
  handler: async (ctx, args): Promise<SearchResult[]> => {
    // Use existing semantic search (no userId filter - searches all user's notes)
    const results: Doc<"notes">[] = await ctx.runAction(internal.search.semanticSearchInternal, {
      query: args.query,
      limit: args.limit ?? 5,
      notebookId: args.notebookId,
    });

    // Get notebook names for each result
    const resultsWithNotebooks: SearchResult[] = await Promise.all(
      results.map(async (note: Doc<"notes">) => {
        const notebook = await ctx.runQuery(internal.functions.notebooks.getNotebookInternal, {
          notebookId: note.notebookId,
        });

        return {
          noteId: note._id,
          title: note.title,
          notebook: notebook?.name ?? "Unknown",
          notebookId: note.notebookId,
          snippet: note.content.slice(0, 200) + (note.content.length > 200 ? "..." : ""),
          tags: note.tags,
          relevance: 0.85, // Placeholder - real semantic search would return score
        };
      })
    );

    return resultsWithNotebooks;
  },
});
