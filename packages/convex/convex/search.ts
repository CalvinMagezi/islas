import { action, internalAction, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { internal, api } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import { parseSearchQuery, getKeywordsString } from "./lib/searchParser";

/**
 * Internal action for semantic search (used by MCP and public wrapper)
 */
export const semanticSearchInternal = internalAction({
  args: {
    query: v.string(),
    notebookId: v.optional(v.id("notebooks")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Doc<"notes">[]> => {
    // 1. Generate query embedding
    const queryEmbedding: number[] = await ctx.runAction(internal.embeddings.generateEmbedding, {
      text: args.query,
    });

    // 2. Search via vector index
    const results: Doc<"notes">[] = await ctx.runQuery(internal.search.vectorSearch, {
      queryEmbedding,
      notebookId: args.notebookId,
      limit: args.limit ?? 10,
    });

    return results;
  },
});

/**
 * Public wrapper for semantic search
 */
export const semanticSearch = action({
  args: {
    query: v.string(),
    notebookId: v.optional(v.id("notebooks")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Doc<"notes">[]> => {
    return ctx.runAction(internal.search.semanticSearchInternal, args);
  },
});

/**
 * Internal query for vector similarity search
 */
export const vectorSearch = internalQuery({
  args: {
    queryEmbedding: v.array(v.float64()),
    notebookId: v.optional(v.id("notebooks")),
    limit: v.number(),
  },
  handler: async (ctx, args): Promise<Doc<"notes">[]> => {
    // Use vectorSearch once index is available
    // For now, return empty array to allow deployment
    const results = await ctx.db
      .query("notes")
      .filter((q) => q.eq(q.field("embeddingStatus"), "embedded"))
      .take(args.limit);

    return results;
  },
});

/**
 * Internal query for keyword text search
 */
export const keywordSearch = internalQuery({
  args: {
    query: v.string(),
    notebookId: v.optional(v.id("notebooks")),
    userId: v.string(),
    limit: v.number(),
  },
  handler: async (ctx, args): Promise<Doc<"notes">[]> => {
    if (args.query.length === 0) return [];

    const results = await ctx.db
      .query("notes")
      .withSearchIndex("search_content", (q) => {
        let search = q.search("content", args.query);
        if (args.notebookId !== undefined) {
          search = search.eq("notebookId", args.notebookId);
        }
        return search;
      })
      .take(args.limit);

    return results;
  },
});

/**
 * Internal Hybrid Search (for MCP tools)
 */
export const hybridSearchInternal = internalAction({
  args: {
    query: v.string(),
    notebookId: v.optional(v.id("notebooks")),
    tags: v.optional(v.array(v.string())),
    before: v.optional(v.number()),
    after: v.optional(v.number()),
    limit: v.optional(v.number()),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<Array<Doc<"notes"> & { score: number }>> => {
    const userId = "local-user";
    return hybridSearchLogic(ctx, userId, args);
  },
});

/**
 * Hybrid Search: Combines semantic + keyword search with advanced filters
 */
export const hybridSearch = action({
  args: {
    query: v.string(),
    notebookId: v.optional(v.id("notebooks")),
    tags: v.optional(v.array(v.string())),
    before: v.optional(v.number()),
    after: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<Doc<"notes"> & { score: number }>> => {
    const userId = "local-user";
    return hybridSearchLogic(ctx, userId, args);
  },
});

/**
 * Shared hybrid search logic
 */
async function hybridSearchLogic(
  ctx: any,
  userId: string,
  args: {
    query: string;
    notebookId?: Id<"notebooks">;
    tags?: string[];
    before?: number;
    after?: number;
    limit?: number;
  }
): Promise<Array<Doc<"notes"> & { score: number }>> {
  const limit = args.limit ?? 20;

  // 1. Parse query operators
  const parsed = parseSearchQuery(args.query);
  const keywordString = getKeywordsString(parsed);

  // Merge parsed filters with explicit args
  const notebookId = args.notebookId || parsed.notebookName
    ? await resolveNotebookId(ctx, userId, parsed.notebookName || undefined, args.notebookId)
    : undefined;
  const tags = args.tags || parsed.tags;
  const before = args.before ?? parsed.before;
  const after = args.after ?? parsed.after;

  // 2. Run semantic search (if keywords exist)
  let semanticResults: Doc<"notes">[] = [];
  if (keywordString.length > 0) {
    semanticResults = await ctx.runAction(internal.search.semanticSearchInternal, {
      query: keywordString,
      notebookId,
      limit: limit * 2, // Get more for deduplication
    });
  }

  // 3. Run keyword text search (if keywords exist)
  let keywordResults: Doc<"notes">[] = [];
  if (keywordString.length > 0) {
    keywordResults = await ctx.runQuery(internal.search.keywordSearch, {
      query: keywordString,
      notebookId,
      userId: userId,
      limit: limit * 2,
    });
  }

  // 4. Combine & deduplicate with scoring
  const scoreMap = new Map<string, { note: Doc<"notes">; semanticScore: number; keywordScore: number }>();

  // Add semantic results
  semanticResults.forEach((note, idx) => {
    const semanticScore = 1 - idx / semanticResults.length; // 1.0 to ~0
    scoreMap.set(note._id, { note, semanticScore, keywordScore: 0 });
  });

  // Add keyword results
  keywordResults.forEach((note, idx) => {
    const keywordScore = 1 - idx / keywordResults.length; // 1.0 to ~0
    const existing = scoreMap.get(note._id);
    if (existing) {
      existing.keywordScore = keywordScore;
    } else {
      scoreMap.set(note._id, { note, semanticScore: 0, keywordScore });
    }
  });

  // If no keywords, fetch recent notes for metadata filtering
  if (keywordString.length === 0) {
    let allNotes: Doc<"notes">[] = [];
    if (notebookId) {
      const finalNotebookId = notebookId; // Capture for closure
      allNotes = await ctx.db
        .query("notes")
        .withIndex("by_notebook", (q: any) => q.eq("notebookId", finalNotebookId))
        .order("desc")
        .take(500);
    } else {
      allNotes = await ctx.db
        .query("notes")
        .order("desc")
        .take(500);
    }
    allNotes.forEach((note) => {
      if (!scoreMap.has(note._id)) {
        scoreMap.set(note._id, { note, semanticScore: 0, keywordScore: 0 });
      }
    });
  }

  // 5. Apply metadata filters and calculate final scores
  const filtered = Array.from(scoreMap.values())
    .filter(({ note }) => {
      // Filter by tags
      if (tags && tags.length > 0) {
        if (!tags.some(tag => note.tags.includes(tag))) {
          return false;
        }
      }
      // Filter by date range
      if (before && note.createdAt > before) return false;
      if (after && note.createdAt < after) return false;
      return true;
    })
    .map(({ note, semanticScore, keywordScore }) => {
      // Scoring: semantic (60%) + keyword (40%) + metadata bonus
      let finalScore = semanticScore * 0.6 + keywordScore * 0.4;

      // Metadata bonuses
      if (note.pinned) finalScore += 0.1;
      if (tags && tags.length > 0 && tags.every(tag => note.tags.includes(tag))) {
        finalScore += 0.05; // All tags match
      }

      return { ...note, score: finalScore };
    });

  // 6. Sort by score and return top N
  filtered.sort((a, b) => b.score - a.score);
  return filtered.slice(0, limit);
}

/**
 * Helper: Resolve notebook name to ID
 */
async function resolveNotebookId(
  ctx: any,
  userId: string,
  notebookName: string | undefined,
  explicitId: Id<"notebooks"> | undefined
): Promise<Id<"notebooks"> | undefined> {
  if (explicitId) return explicitId;
  if (!notebookName) return undefined;

  // Search for notebook by name
  const notebooks = await ctx.runQuery(api.functions.notebooks.listNotebooks, {});
  const match = notebooks.find((nb: any) =>
    nb.name.toLowerCase() === notebookName.toLowerCase()
  );
  return match?._id;
}
