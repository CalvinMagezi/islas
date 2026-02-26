import { v } from "convex/values";
import { mutation, query, action, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";

const CHUNK_SIZE = 2000;
const CHUNK_OVERLAP = 200;

function splitIntoChunks(text: string, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    let breakPoint = end;
    for (const sep of [". ", "\n", " "]) {
      const last = text.lastIndexOf(sep, end);
      if (last > start) { breakPoint = last + sep.length; break; }
    }
    const chunk = text.slice(start, breakPoint).trim();
    if (chunk.length > 50) chunks.push(chunk);
    start = breakPoint - overlap;
    if (start < 0) start = 0;
  }
  return chunks;
}

function extractTextFromBuffer(buffer: ArrayBuffer): string {
  // Simple extraction of printable ASCII from binary (works well for text-based PDFs/docs)
  const bytes = new Uint8Array(buffer);
  let text = "";
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126) || b === 10 || b === 13) {
      text += String.fromCharCode(b);
    } else {
      text += " ";
    }
  }
  return text
    .replace(/\s+/g, " ")
    .replace(/[^\w\s.,;:!?'"()\-\/\n]/g, " ")
    .replace(/\s{3,}/g, "\n\n")
    .trim();
}

// ── Public Mutations / Queries ────────────────────────────────────────────────

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const listDocuments = query({
  args: {
    userId: v.string(),
    vertical: v.optional(v.string()),
    docType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("oakstoneDocs")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    // Return only the first chunk per source file (deduplication)
    const seen = new Set<string>();
    return docs
      .filter((d) => {
        if ((d.chunkIndex ?? 0) > 0) return false;
        const key = d.sourceFileId ? d.sourceFileId.toString() : d.title;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .filter((d) => !args.vertical || d.vertical === args.vertical)
      .filter((d) => !args.docType || d.docType === args.docType);
  },
});

export const deleteDocument = mutation({
  args: {
    sourceFileId: v.optional(v.id("_storage")),
    docId: v.optional(v.id("oakstoneDocs")),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    if (args.sourceFileId) {
      // Delete all chunks sharing this file
      const all = await ctx.db
        .query("oakstoneDocs")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect();
      for (const doc of all.filter((d) => d.sourceFileId === args.sourceFileId)) {
        await ctx.db.delete(doc._id);
      }
      await ctx.storage.delete(args.sourceFileId);
    } else if (args.docId) {
      await ctx.db.delete(args.docId);
    }
  },
});

// ── Internal Helpers ──────────────────────────────────────────────────────────

export const saveDocumentChunk = internalMutation({
  args: {
    userId: v.string(),
    title: v.string(),
    content: v.string(),
    docType: v.union(
      v.literal("im"),
      v.literal("pitch_deck"),
      v.literal("financial_model"),
      v.literal("report"),
      v.literal("contract"),
      v.literal("memo"),
      v.literal("market_brief"),
      v.literal("other"),
    ),
    vertical: v.optional(v.union(
      v.literal("Credit"),
      v.literal("Venture"),
      v.literal("Absolute Return"),
      v.literal("Real Assets"),
      v.literal("Digital Assets"),
      v.literal("Listed Assets"),
    )),
    companyName: v.optional(v.string()),
    sourceFileId: v.optional(v.id("_storage")),
    chunkIndex: v.number(),
    totalChunks: v.number(),
    embedding: v.array(v.float64()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("oakstoneDocs", {
      ...args,
      embeddingStatus: "embedded" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const getDocumentChunk = internalQuery({
  args: { id: v.id("oakstoneDocs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ── Ingestion Action: upload → extract → chunk → embed (OpenRouter) → store ──

export const ingestDocument = action({
  args: {
    storageId: v.id("_storage"),
    title: v.string(),
    userId: v.string(),
    docType: v.string(),
    vertical: v.optional(v.string()),
    companyName: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; chunksProcessed: number }> => {
    // 1. Fetch file bytes from Convex storage
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) throw new Error("Could not retrieve storage URL");
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch file: ${response.statusText}`);

    // 2. Extract text
    const contentType = response.headers.get("content-type") ?? "";
    let text: string;
    if (contentType.includes("pdf") || args.title.toLowerCase().endsWith(".pdf")) {
      const buffer = await response.arrayBuffer();
      text = extractTextFromBuffer(buffer);
    } else {
      text = await response.text();
    }

    if (!text || text.length < 50) {
      throw new Error("Could not extract meaningful text from document");
    }

    // 3. Chunk
    const chunks = splitIntoChunks(text);
    if (chunks.length === 0) throw new Error("No valid chunks produced");

    // 4. Embed each chunk via OpenRouter (openai/text-embedding-3-small) and store
    const savedIds: Id<"oakstoneDocs">[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const embeddingText = i === 0
        ? `${args.title}\n\n${chunks[i]}`
        : chunks[i];

      const embedding = await ctx.runAction(internal.embeddings.generateEmbedding, {
        text: embeddingText,
      });

      const docId = await ctx.runMutation(internal.functions.documents.saveDocumentChunk, {
        userId: args.userId,
        title: chunks.length === 1 ? args.title : `${args.title} (${i + 1}/${chunks.length})`,
        content: chunks[i],
        docType: args.docType as any,
        vertical: args.vertical as any,
        companyName: args.companyName,
        sourceFileId: args.storageId,
        chunkIndex: i,
        totalChunks: chunks.length,
        embedding,
        tags: args.tags,
      });

      savedIds.push(docId);
    }

    return { success: true, chunksProcessed: savedIds.length };
  },
});
