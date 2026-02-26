import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Hybrid semantic search over ingested Oakstone documents.
 * Generates a query embedding via OpenRouter, runs vector search,
 * then fetches full document chunks for context.
 */
export const searchDocuments = internalAction({
  args: {
    query: v.string(),
    userId: v.string(),
    docType: v.optional(v.string()),
    vertical: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Array<{
    _id: string;
    title: string;
    content: string;
    docType: string;
    vertical?: string;
    companyName?: string;
    chunkIndex?: number;
    tags: string[];
    score: number;
  }>> => {
    const limit = args.limit ?? 5;

    // 1. Embed the query via OpenRouter (same model as documents: openai/text-embedding-3-small)
    const queryEmbedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
      text: args.query,
    });

    // 2. Vector search — filter by embeddingStatus to only hit fully embedded docs
    const vectorResults = await ctx.vectorSearch("oakstoneDocs", "by_embedding", {
      vector: queryEmbedding,
      limit: limit * 2, // fetch more to allow post-filter
      filter: (q) => q.eq("embeddingStatus", "embedded"),
    });

    // 3. Fetch full chunk data and apply optional docType/vertical filters
    const docs = await Promise.all(
      vectorResults.map(async (result) => {
        const doc = await ctx.runQuery(internal.functions.documents.getDocumentChunk, {
          id: result._id,
        });
        if (!doc) return null;
        if (args.docType && doc.docType !== args.docType) return null;
        if (args.vertical && doc.vertical !== args.vertical) return null;
        // Only return docs belonging to this user
        if (doc.userId !== args.userId) return null;
        return {
          _id: result._id,
          title: doc.title,
          content: doc.content.slice(0, 500), // snippet for display
          docType: doc.docType,
          vertical: doc.vertical,
          companyName: doc.companyName,
          chunkIndex: doc.chunkIndex,
          tags: doc.tags,
          score: result._score,
        };
      })
    );

    return docs
      .filter((d): d is NonNullable<typeof d> => d !== null)
      .slice(0, limit);
  },
});
