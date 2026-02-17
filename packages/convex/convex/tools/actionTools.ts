import { createTool, type ToolCtx } from "@convex-dev/agent";
import { z } from "zod";
import { internal } from "../_generated/api";

type ActionResult = {
  success: boolean;
  action: string;
  message: string;
  id?: string;
};

type MemoryListResult = {
  memories: unknown[];
  total: number;
};

export const storeMemory = createTool({
  description:
    "Store a new memory for the user. Use when the user tells you something they want to remember, or when you learn something important about the user.",
  args: z.object({
    content: z.string().describe("The memory content to store"),
    category: z
      .enum(["learning", "preference", "fact", "project_context", "decision"])
      .describe("Category of the memory"),
    tags: z.array(z.string()).describe("Tags for the memory"),
    source: z
      .string()
      .describe("Source of the memory, e.g. 'user', 'conversation'"),
    importance: z
      .number()
      .min(0)
      .max(1)
      .describe("Importance score from 0 to 1"),
  }),
  handler: async (ctx: ToolCtx, args: {
    content: string;
    category: "learning" | "preference" | "fact" | "project_context" | "decision";
    tags: string[];
    source: string;
    importance: number;
  }): Promise<ActionResult> => {
    const userId = ctx.userId!;
    const result = await ctx.runMutation(internal.functions.internal.storeMemory, {
      userId,
      ...args,
    }) as { noteId: string; notebookId: string };
    return {
      success: true,
      action: "stored",
      message: "Memory stored successfully",
      id: result.noteId,
    };
  },
});

export const recallMemory = createTool({
  description:
    "Search for memories matching a query. Use when the user asks to recall or find a memory.",
  args: z.object({
    query: z.string().describe("Search query to find relevant memories"),
  }),
  handler: async (ctx: ToolCtx, args: { query: string }): Promise<MemoryListResult> => {
    const userId = ctx.userId!;
    const memories = (await ctx.runQuery(
      internal.functions.internal.searchMemories,
      { userId, query: args.query },
    )) as unknown[];
    return { memories, total: memories.length };
  },
});

export const updateMemory = createTool({
  description:
    "Update an existing memory. Use when the user wants to modify a stored memory.",
  args: z.object({
    memoryId: z.string().describe("The memory ID to update (this is now a Note ID)"),
    content: z.string().optional().describe("New content"),
    category: z.string().optional().describe("New category/tag"),
    tags: z.array(z.string()).optional().describe("New tags"),
    importance: z.number().min(0).max(1).optional().describe("New importance"),
  }),
  handler: async (ctx: ToolCtx, args: {
    memoryId: string;
    content?: string;
    category?: string;
    tags?: string[];
    importance?: number;
  }): Promise<ActionResult> => {
    const { memoryId, ...fields } = args;
    await ctx.runMutation(internal.functions.internal.updateMemory, {
      id: memoryId as any,
      ...fields,
    } as any);
    return {
      success: true,
      action: "updated",
      message: "Memory updated successfully",
    };
  },
});

export const deleteMemory = createTool({
  description:
    "Delete a memory. Use when the user wants to remove a stored memory.",
  args: z.object({
    memoryId: z.string().describe("The memory ID to delete (Note ID)"),
  }),
  handler: async (ctx: ToolCtx, args: { memoryId: string }): Promise<ActionResult> => {
    await ctx.runMutation(internal.functions.internal.deleteMemory, {
      id: args.memoryId as any,
    });
    return {
      success: true,
      action: "deleted",
      message: "Memory deleted successfully",
    };
  },
});

export const createProject = createTool({
  description:
    "Create a new project. Use when the user wants to track a new project.",
  args: z.object({
    name: z.string().describe("Project name"),
    description: z.string().optional().describe("Project description"),
    techStack: z
      .array(z.string())
      .optional()
      .describe("Technologies used in the project"),
    goals: z.array(z.string()).optional().describe("Project goals"),
    currentFocus: z
      .string()
      .optional()
      .describe("Current focus area of the project"),
  }),
  handler: async (ctx: ToolCtx, args: {
    name: string;
    description?: string;
    techStack?: string[];
    goals?: string[];
    currentFocus?: string;
  }): Promise<ActionResult> => {
    const userId = ctx.userId!;
    const result = await ctx.runMutation(
      internal.functions.internal.createProject,
      { userId, ...args },
    ) as { projectId: string; name: string };
    return {
      success: true,
      action: "created",
      message: `Project "${args.name}" created successfully`,
      id: result.projectId,
    };
  },
});

export const updateProject = createTool({
  description:
    "Update an existing project. Use when the user wants to modify project details.",
  args: z.object({
    projectId: z.string().describe("The project ID to update"),
    name: z.string().optional().describe("New name"),
    description: z.string().optional().describe("New description"),
    status: z.string().optional().describe("New status"),
    techStack: z.array(z.string()).optional().describe("New tech stack"),
    goals: z.array(z.string()).optional().describe("New goals"),
    currentFocus: z.string().optional().describe("New current focus"),
  }),
  handler: async (ctx: ToolCtx, args: {
    projectId: string;
    name?: string;
    description?: string;
    status?: string;
    techStack?: string[];
    goals?: string[];
    currentFocus?: string;
  }): Promise<ActionResult> => {
    const { projectId, ...fields } = args;
    await ctx.runMutation(internal.functions.internal.updateProject, {
      id: projectId as any,
      ...fields,
    } as any);

    return {
      success: true,
      action: "updated",
      message: "Project updated successfully",
    };
  },
});

export const setSetting = createTool({
  description:
    "Set a user setting. Use when the user wants to change a preference or configuration.",
  args: z.object({
    key: z.string().describe("Setting key"),
    value: z.string().describe("Setting value"),
  }),
  handler: async (ctx: ToolCtx, args: { key: string; value: string }): Promise<ActionResult> => {
    const userId = ctx.userId!;
    await ctx.runMutation(internal.functions.internal.setSetting, {
      userId,
      key: args.key,
      value: args.value,
    });
    return {
      success: true,
      action: "set",
      message: `Setting "${args.key}" updated to "${args.value}"`,
    };
  },
});
