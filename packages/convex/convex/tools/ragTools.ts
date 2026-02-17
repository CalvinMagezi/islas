/**
 * RAG Tools - Search notebooks, web, and load context
 */

import { createTool, type ToolCtx } from "@convex-dev/agent";
import { z } from "zod";
import { api, internal } from "../_generated/api";

/**
 * Search Notes Tool - Semantic search through notebooks
 */
export const searchNotes = createTool({
  description:
    "Search through all notebooks and notes using semantic search. Use this when the user asks about stored information, past decisions, documented knowledge, or anything that might be in their notes. Returns relevant note snippets with source information.",
  args: z.object({
    query: z
      .string()
      .describe(
        "Natural language search query (e.g., 'database architecture decisions', 'project priorities')"
      ),
    limit: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Maximum number of results to return"),
  }),
  handler: async (
    ctx: ToolCtx,
    args: { query: string; limit: number }
  ): Promise<{
    found: boolean;
    message: string;
    results: Array<{
      title: string;
      notebook: string;
      snippet: string;
      noteId: string;
      tags: string[];
    }>;
  }> => {
    // @ts-ignore
    const results = (await ctx.runAction(internal.search.hybridSearchInternal, {
      query: args.query,
      userId: ctx.userId!,
      limit: args.limit,
    })) as any[];

    if (!results || results.length === 0) {
      return {
        found: false,
        message: `No notes found for query: "${args.query}"`,
        results: [],
      };
    }

    return {
      found: true,
      message: `Found ${results.length} relevant note(s)`,
      results: results.map((r: any) => ({
        title: r.title,
        notebook: r.notebookId,
        snippet: r.content.substring(0, 200),
        noteId: r._id,
        tags: r.tags,
      })),
    };
  },
});

/**
 * Search Web Tool - Brave Search API integration
 */
export const searchWeb = createTool({
  description:
    "Search the web using Brave Search API. Use this when the user asks about current information, documentation, news, recent events, or anything not likely to be in their stored notes. Returns web search results with titles, URLs, and descriptions.",
  args: z.object({
    query: z.string().describe("Web search query"),
    count: z
      .number()
      .min(1)
      .max(10)
      .default(5)
      .describe("Number of results to return"),
  }),
  handler: async (ctx: ToolCtx, args: { query: string; count: number }): Promise<{
    found: boolean;
    message: string;
    results: Array<{
      title: string;
      url: string;
      description: string;
      age?: string;
    }>;
  }> => {
    // @ts-ignore
    const results = (await ctx.runAction(api.chat.searchWeb.searchWeb, {
      query: args.query,
      count: args.count,
    })) as any[];

    if (!results || results.length === 0) {
      return {
        found: false,
        message: `No web results found for query: "${args.query}"`,
        results: [],
      };
    }

    return {
      found: true,
      message: `Found ${results.length} web result(s)`,
      results: results.map((r: any) => ({
        title: r.title,
        url: r.url,
        description: r.description,
        age: r.age,
      })),
    };
  },
});

/**
 * Load Context Tool - Load pinned notes and important user context
 * 
 * This tool should be called at the START of new conversation threads
 * to get high-priority information the user has pinned.
 */
export const loadContext = createTool({
  description:
    "Load user's pinned notes and important context. Call this at the START of new conversations (first message in a thread) to get high-priority information and context that the user wants you to be aware of. Pinned notes contain critical information like project goals, priorities, important decisions, and frequently referenced facts.",
  args: z.object({}),
  handler: async (ctx: ToolCtx): Promise<{
    loaded: boolean;
    count: number;
    message: string;
    pinnedNotes: Array<{
      notebook: string;
      title: string;
      content: string;
      tags: string[];
    }>;
  }> => {
    // @ts-ignore
    const pinnedNotes = (await ctx.runQuery(internal.notebooks.getNotesInternal, {
      userId: ctx.userId!,
      pinnedOnly: true,
    })) as any[];

    if (!pinnedNotes || pinnedNotes.length === 0) {
      return {
        loaded: false,
        count: 0,
        message: "No pinned notes found.",
        pinnedNotes: [],
      };
    }

    return {
      loaded: true,
      count: pinnedNotes.length,
      message: `Loaded ${pinnedNotes.length} pinned note(s) with important context.`,
      pinnedNotes: pinnedNotes.map((note: any) => ({
        notebook: note.notebookId,
        title: note.title,
        content: note.content,
        tags: note.tags,
      })),
    };
  },
});
