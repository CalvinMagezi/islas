import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/embeddings";
const EMBEDDING_MODEL = "openai/text-embedding-3-small";
const EMBEDDING_DIMS = 1536;

/**
 * Generate embedding for text using OpenRouter API
 */
export const generateEmbedding = internalAction({
  args: {
    text: v.string(),
  },
  handler: async (ctx, args): Promise<number[]> => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY environment variable not set");
    }

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: args.text,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    return data.data[0].embedding as number[];
  },
});

/**
 * Update note with generated embedding
 */
export const updateNoteEmbedding = internalMutation({
  args: {
    noteId: v.id("notes"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.noteId, {
      embedding: args.embedding,
      embeddingStatus: "embedded",
      embeddedAt: Date.now(),
      embeddingModel: EMBEDDING_MODEL,
      embeddingDims: EMBEDDING_DIMS,
    });
  },
});

/**
 * Mark note embedding as failed
 */
export const markEmbeddingFailed = internalMutation({
  args: {
    noteId: v.id("notes"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.noteId, {
      embeddingStatus: "failed",
      embeddingError: args.error,
    });
  },
});

import { Doc, Id } from "./_generated/dataModel";

/**
 * Get notes with pending embeddings
 */
export const getPendingNotes = internalQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<Doc<"notes">[]> => {
    const limit = args.limit ?? 10;
    return await ctx.db
      .query("notes")
      .withIndex("by_embeddingStatus", (q) =>
        q.eq("embeddingStatus", "pending")
      )
      .take(limit);
  },
});

/**
 * Process pending embeddings in batch
 */
export const processPendingEmbeddings = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number }> => {
    // Get pending notes
    const pendingNotes = await ctx.runQuery(internal.embeddings.getPendingNotes, {
      limit: 10,
    });

    console.log(`Processing ${pendingNotes.length} pending embeddings`);

    for (const note of pendingNotes) {
      try {
        // Mark as processing
        await ctx.runMutation(internal.embeddings.updateProcessingStatus, {
          noteId: note._id as Id<"notes">,
        });

        // Generate embedding for title + content
        const text = `${note.title}\n\n${note.content}`;
        const embedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
          text,
        });

        // Store embedding
        await ctx.runMutation(internal.embeddings.updateNoteEmbedding, {
          noteId: note._id as Id<"notes">,
          embedding,
        });

        console.log(`Successfully embedded note ${note._id}`);
      } catch (error) {
        console.error(`Failed to embed note ${note._id}:`, error);
        await ctx.runMutation(internal.embeddings.markEmbeddingFailed, {
          noteId: note._id as Id<"notes">,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      processed: pendingNotes.length,
    };
  },
});

/**
 * Update note status to processing
 */
export const updateProcessingStatus = internalMutation({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.noteId, {
      embeddingStatus: "processing",
    });
  },
});
