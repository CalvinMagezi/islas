import { v } from "convex/values";
import { internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { getAuthUserId } from "./lib/auth";

/**
 * Export a notebook as markdown (internal)
 */
export const _exportNotebook = internalQuery({
  args: {
    notebookId: v.id("notebooks"),
    format: v.optional(v.union(v.literal("markdown"), v.literal("json"))),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Use provided userId (for internal calls) or default to local-user
    const userId = args.userId || "local-user";

    // Get notebook
    const notebook = await ctx.db.get(args.notebookId);
    if (!notebook) {
      throw new Error("Notebook not found");
    }

    // Skip userId check if userId is not set (for backwards compatibility)
    if (notebook.userId && notebook.userId !== userId) {
      throw new Error("Notebook not found");
    }

    // Get all notes in notebook
    const notes = await ctx.db
      .query("notes")
      .withIndex("by_notebook", (q) => q.eq("notebookId", args.notebookId))
      .filter((q) => q.eq(q.field("userId"), userId))
      .order("desc")
      .collect();

    const format = args.format || "markdown";

    if (format === "markdown") {
      // Build markdown document
      let markdown = `# ${notebook.name}\n\n`;
      
      if (notebook.description) {
        markdown += `${notebook.description}\n\n`;
      }

      markdown += `---\n\n`;
      markdown += `**Notebook:** ${notebook.name}\n`;
      markdown += `**Notes:** ${notes.length}\n`;
      if (notebook.tags && notebook.tags.length > 0) {
        markdown += `**Tags:** ${notebook.tags.join(", ")}\n`;
      }
      markdown += `**Created:** ${new Date(notebook.createdAt).toISOString()}\n`;
      markdown += `**Exported:** ${new Date().toISOString()}\n\n`;
      markdown += `---\n\n`;

      // Add each note
      for (const note of notes) {
        markdown += `## ${note.title}\n\n`;
        markdown += `${note.content}\n\n`;
        
        if (note.tags && note.tags.length > 0) {
          markdown += `**Tags:** ${note.tags.join(", ")}\n`;
        }
        
        markdown += `**Created:** ${new Date(note.createdAt).toISOString()}\n`;
        
        if (note.metadata?.source) {
          markdown += `**Source:** ${note.metadata.source}\n`;
        }
        
        markdown += `\n---\n\n`;
      }

      return {
        format: "markdown",
        filename: `${notebook.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`,
        content: markdown,
        noteCount: notes.length,
      };
    } else {
      // JSON format
      return {
        format: "json",
        filename: `${notebook.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.json`,
        content: JSON.stringify(
          {
            notebook: {
              id: notebook._id,
              name: notebook.name,
              description: notebook.description,
              tags: notebook.tags,
              createdAt: notebook.createdAt,
              updatedAt: notebook.updatedAt,
            },
            notes: notes.map((note) => ({
              id: note._id,
              title: note.title,
              content: note.content,
              tags: note.tags,
              metadata: note.metadata,
              pinned: note.pinned,
              createdAt: note.createdAt,
              updatedAt: note.updatedAt,
            })),
            exportedAt: Date.now(),
          },
          null,
          2
        ),
        noteCount: notes.length,
      };
    }
  },
});

/**
 * Export a single note as markdown (internal)
 */
export const _exportNote = internalQuery({
  args: {
    noteId: v.id("notes"),
    userId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Use provided userId (for internal calls) or default to local-user
    const userId = args.userId || "local-user";

    const note = await ctx.db.get(args.noteId);
    if (!note) {
      throw new Error("Note not found");
    }

    // Skip userId check if userId is not set (for backwards compatibility)
    if (note.userId && note.userId !== userId) {
      throw new Error("Note not found");
    }

    // Get notebook info
    const notebook = await ctx.db.get(note.notebookId);

    let markdown = `# ${note.title}\n\n`;
    markdown += `${note.content}\n\n`;
    markdown += `---\n\n`;
    
    if (notebook) {
      markdown += `**Notebook:** ${notebook.name}\n`;
    }
    
    if (note.tags && note.tags.length > 0) {
      markdown += `**Tags:** ${note.tags.join(", ")}\n`;
    }
    
    markdown += `**Created:** ${new Date(note.createdAt).toISOString()}\n`;
    markdown += `**Updated:** ${new Date(note.updatedAt).toISOString()}\n`;
    
    if (note.metadata?.source) {
      markdown += `**Source:** ${note.metadata.source}\n`;
    }

    return {
      format: "markdown",
      filename: `${note.title.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.md`,
      content: markdown,
    };
  },
});

/**
 * Public wrapper for exporting a notebook
 */
export const exportNotebook = query({
  args: {
    notebookId: v.id("notebooks"),
    format: v.optional(v.union(v.literal("markdown"), v.literal("json"))),
  },
  handler: async (ctx, args): Promise<{
    format: string;
    filename: string;
    content: string;
    noteCount: number;
  }> => {
    // Get authenticated user ID (or undefined if not authenticated)
    const userId = await getAuthUserId(ctx);

    return ctx.runQuery(internal.export._exportNotebook, {
      ...args,
      userId,
    });
  },
});

/**
 * Public wrapper for exporting a note
 */
export const exportNote = query({
  args: {
    noteId: v.id("notes"),
  },
  handler: async (ctx, args): Promise<{
    format: string;
    filename: string;
    content: string;
  }> => {
    // Get authenticated user ID (or undefined if not authenticated)
    const userId = await getAuthUserId(ctx);

    return ctx.runQuery(internal.export._exportNote, {
      ...args,
      userId,
    });
  },
});
