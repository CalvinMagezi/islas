import { createTool, type ToolCtx } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../_generated/api";

export const showDashboard = createTool({
  description:
    "Show the user's dashboard with overview stats including memory count, project count, usage, and cost. Use when the user wants to see their dashboard or overview.",
  args: z.object({}),
  handler: async (ctx: ToolCtx, _args: Record<string, never>): Promise<{
    memoryCount: number;
    projectCount: number;
    tokensToday: number;
    costToday: number;
    requestsToday: number;
  }> => {
    const userId = ctx.userId!;

    // @ts-ignore
    const memoryCount = (await ctx.runQuery(internal.functions.internal.countMemories, {
      userId,
    })) as number;
    // @ts-ignore
    const projectCount = (await ctx.runQuery(internal.functions.internal.countProjects, {
      userId,
    })) as number;
    // @ts-ignore
    const usageStats = (await ctx.runQuery(internal.functions.internal.getUsageStats, {
      userId,
      periodMs: 24 * 60 * 60 * 1000,
    })) as { totalTokens: number; cost: number; requestCount: number };

    return {
      memoryCount,
      projectCount,
      tokensToday: usageStats.totalTokens,
      costToday: usageStats.cost,
      requestsToday: usageStats.requestCount,
    };
  },
});

export const showMemories = createTool({
  description:
    "Show the user's stored memories, optionally filtered by category. Use when the user wants to see or browse their memories.",
  args: z.object({
    category: z.string().optional().describe("Optional category/tag filter"),
  }),
  handler: async (ctx: ToolCtx, args: { category?: string }): Promise<{
    memories: unknown[];
    total: number;
  }> => {
    const userId = ctx.userId!;
    const memories = (await ctx.runQuery(
      internal.functions.internal.listMemories,
      { userId, category: args.category },
    )) as unknown[];
    return { memories, total: memories.length };
  },
});

export const showProjects = createTool({
  description:
    "Show the user's projects, optionally filtered by status. Use when the user wants to see their projects.",
  args: z.object({
    status: z.string().optional().describe("Optional status filter"),
  }),
  handler: async (ctx: ToolCtx, args: { status?: string }): Promise<{
    projects: unknown[];
  }> => {
    const userId = ctx.userId!;
    const projects = (await ctx.runQuery(
      internal.functions.internal.listProjects,
      { userId, status: args.status },
    )) as unknown[];
    return { projects };
  },
});

export const showProjectDetail = createTool({
  description:
    "Show detailed information about a specific project. Use when the user asks about a specific project.",
  args: z.object({
    projectId: z.string().describe("The project ID to show details for"),
  }),
  handler: async (ctx: ToolCtx, args: { projectId: string }): Promise<{
    project: unknown;
    relatedMemories: unknown[];
  }> => {
    const userId = ctx.userId!;
    const project = await ctx.runQuery(
      internal.functions.internal.getProject,
      { id: args.projectId as any },
    );

    const relatedMemories = (await ctx.runQuery(
      internal.functions.internal.searchMemories,
      { userId, query: (project as any)?.name ?? "" },
    )) as unknown[];

    return { project, relatedMemories: relatedMemories.slice(0, 5) };
  },
});

export const showNotifications = createTool({
  description:
    "Show the user's recent notifications. Use when the user wants to see their notifications or alerts.",
  args: z.object({
    limit: z.number().optional().describe("Max notifications to show (default 20)"),
  }),
  handler: async (ctx: ToolCtx, args: { limit?: number }): Promise<{
    notifications: unknown[];
    total: number;
    unread: number;
  }> => {
    const userId = ctx.userId!;
    const limit = args.limit ?? 20;

    const all = (await ctx.runQuery(
      internal.functions.notifications.listInternal,
      { userId, limit },
    )) as any[];

    const unread = all.filter((n: any) => !n.read).length;

    return { notifications: all, total: all.length, unread };
  },
});

export const showSettings = createTool({
  description:
    "Show the user's settings. Use when the user wants to view or manage their settings.",
  args: z.object({}),
  handler: async (ctx: ToolCtx, _args: Record<string, never>): Promise<{
    settings: unknown[];
  }> => {
    const userId = ctx.userId!;
    const settings = (await ctx.runQuery(
      internal.functions.internal.listSettings,
      { userId },
    )) as unknown[];
    return { settings };
  },
});

export const showUsageStats = createTool({
  description:
    "Show token usage and cost statistics. Use when the user asks about their usage, costs, spending, or token consumption.",
  args: z.object({
    period: z
      .enum(["today", "week", "month", "all"])
      .optional()
      .describe("Time period for stats"),
    threadId: z
      .string()
      .optional()
      .describe("Optional thread ID to show per-chat costs"),
  }),
  handler: async (ctx: ToolCtx, args: { period?: string; threadId?: string }): Promise<{
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    requestCount: number;
    breakdown: Array<{ model: string; tokens: number; cost: number }>;
    period: string;
  }> => {
    const userId = ctx.userId!;
    const periodMap: Record<string, number | undefined> = {
      today: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      all: undefined,
    };
    const period = args.period ?? "today";
    const periodMs = periodMap[period];

    const stats = (await ctx.runQuery(
      internal.functions.internal.getUsageStats,
      { userId, threadId: args.threadId, periodMs },
    )) as {
      promptTokens: number;
      completionTokens: number;
      totalTokens: number;
      cost: number;
      requestCount: number;
      breakdown: Array<{ model: string; tokens: number; cost: number }>;
    };
    return { ...stats, period };
  },
});

export const showNote = createTool({
  description:
    "Show the full content of a specific note. Use when the user asks to see a note, read a note, or view note details. Requires the noteId.",
  args: z.object({
    noteId: z.string().describe("The note ID to display"),
  }),
  handler: async (ctx: ToolCtx, args: { noteId: string }): Promise<{
    note: unknown;
  }> => {
    const userId = ctx.userId!;
    const note = await ctx.runQuery(
      internal.notebooks.getNoteInternal,
      { userId, noteId: args.noteId as any },
    );

    if (!note) {
      throw new Error("Note not found or access denied");
    }

    return { note };
  },
});

export const showNotebook = createTool({
  description:
    "Show a notebook with all its notes. Use when the user asks to see a notebook, browse notes in a notebook, or view notebook contents.",
  args: z.object({
    notebookId: z.string().describe("The notebook ID to display"),
  }),
  handler: async (ctx: ToolCtx, args: { notebookId: string }): Promise<{
    notebook: unknown;
    notes: unknown[];
  }> => {
    const userId = ctx.userId!;

    // Get notebook details
    const notebook = await ctx.runQuery(
      internal.functions.internal.getProject,
      { id: args.notebookId as any },
    );

    if (!notebook || (notebook as any).userId !== userId) {
      throw new Error("Notebook not found or access denied");
    }

    // Get notes for this notebook
    const notes = (await ctx.runQuery(
      internal.notebooks.getNotesInternal,
      { userId, notebookId: args.notebookId as any },
    )) as unknown[];

    return { notebook, notes };
  },
});
