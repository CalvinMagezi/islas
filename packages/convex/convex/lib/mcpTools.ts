/**
 * MCP Tool definitions and dispatch for Islas.
 *
 * Each tool maps to an existing internal Convex function,
 * so no business logic is duplicated.
 */

import { ActionCtx } from "../_generated/server";
import { internal, api } from "../_generated/api";

// ── Tool manifest (returned by tools/list) ────────────────────────────

export const MCP_TOOLS = [
  {
    name: "memory_store",
    description: "Store a new memory for the user",
    inputSchema: {
      type: "object" as const,
      properties: {
        content: { type: "string", description: "Memory content" },
        category: {
          type: "string",
          enum: ["learning", "preference", "fact", "project_context", "decision"],
        },
        tags: { type: "array", items: { type: "string" }, default: [] },
        source: { type: "string", default: "mcp" },
        importance: { type: "number", default: 0.5 },
      },
      required: ["content", "category"],
    },
  },
  {
    name: "memory_recall",
    description: "Search memories by content query",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "memory_list",
    description: "List all memories, optionally filtered by category",
    inputSchema: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["learning", "preference", "fact", "project_context", "decision"],
        },
      },
    },
  },
  {
    name: "project_list",
    description: "List user's projects, optionally filtered by status",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["active", "archived", "completed"] },
      },
    },
  },
  {
    name: "project_create",
    description: "Create a new project",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["active", "archived", "completed"] },
        techStack: { type: "array", items: { type: "string" } },
        goals: { type: "array", items: { type: "string" } },
        currentFocus: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "project_update",
    description: "Update an existing project by ID",
    inputSchema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "Project ID" },
        name: { type: "string" },
        description: { type: "string" },
        status: { type: "string", enum: ["active", "archived", "completed"] },
        techStack: { type: "array", items: { type: "string" } },
        goals: { type: "array", items: { type: "string" } },
        currentFocus: { type: "string" },
      },
      required: ["id"],
    },
  },
  {
    name: "settings_list",
    description: "List all user settings",
    inputSchema: { type: "object" as const, properties: {} },
  },
  {
    name: "settings_set",
    description: "Set a user setting key-value pair",
    inputSchema: {
      type: "object" as const,
      properties: {
        key: { type: "string" },
        value: { type: "string" },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "notification_send",
    description: "Send a notification to the user's Islas dashboard",
    inputSchema: {
      type: "object" as const,
      properties: {
        type: {
          type: "string",
          enum: ["permission_prompt", "idle_prompt", "auth_success", "task_complete", "stop", "info"],
          default: "info",
        },
        message: { type: "string" },
        title: { type: "string" },
        project: { type: "string" },
      },
      required: ["message"],
    },
  },
  {
    name: "notebook_create",
    description: "Create a new notebook for organizing notes",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Notebook name" },
        description: { type: "string", description: "Optional description" },
        tags: { type: "array", items: { type: "string" }, description: "Tags for organization" },
        color: { type: "string", description: "Color code (e.g., #FF5733)" },
        icon: { type: "string", description: "Icon identifier" },
      },
      required: ["name"],
    },
  },
  {
    name: "notebook_list",
    description: "List all notebooks, optionally filtered by status",
    inputSchema: {
      type: "object" as const,
      properties: {
        status: { type: "string", enum: ["active", "archived", "deleted"] },
      },
    },
  },
  {
    name: "notebook_search",
    description: "Search notebooks by name",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
      },
      required: ["query"],
    },
  },
  {
    name: "notebook_update",
    description: "Update an existing notebook",
    inputSchema: {
      type: "object" as const,
      properties: {
        notebookId: { type: "string", description: "Notebook ID" },
        name: { type: "string" },
        description: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        status: { type: "string", enum: ["active", "archived", "deleted"] },
        color: { type: "string" },
        icon: { type: "string" },
      },
      required: ["notebookId"],
    },
  },
  {
    name: "note_create",
    description: "Create a new note in a notebook",
    inputSchema: {
      type: "object" as const,
      properties: {
        notebookId: { type: "string", description: "Notebook ID" },
        title: { type: "string", description: "Note title" },
        content: { type: "string", description: "Note content (markdown supported)" },
        tags: { type: "array", items: { type: "string" }, description: "Tags" },
        source: { type: "string", description: "Source context (e.g., 'chat', 'research')" },
        context: { type: "string", description: "Additional context" },
        references: { type: "array", items: { type: "string" }, description: "Related URLs or IDs" },
        pinned: { type: "boolean", description: "Pin note to top" },
      },
      required: ["notebookId", "title", "content"],
    },
  },
  {
    name: "note_list",
    description: "List notes, optionally filtered by notebook or pinned status",
    inputSchema: {
      type: "object" as const,
      properties: {
        notebookId: { type: "string", description: "Filter by notebook ID" },
        pinnedOnly: { type: "boolean", description: "Show only pinned notes" },
        limit: { type: "number", description: "Maximum number of notes to return" },
      },
    },
  },
  {
    name: "note_search",
    description: "Search notes by content",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query" },
        notebookId: { type: "string", description: "Limit search to specific notebook" },
      },
      required: ["query"],
    },
  },
  {
    name: "note_search_semantic",
    description: "Search notes using AI semantic search (finds notes by meaning, not just keywords)",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Natural language search query" },
        notebookId: { type: "string", description: "Optional: Limit search to specific notebook" },
        limit: { type: "number", description: "Maximum number of results (default 10, max 50)", default: 10 },
      },
      required: ["query"],
    },
  },
  {
    name: "note_search_advanced",
    description: "Hybrid search with advanced filtering (semantic + keyword + metadata). Supports operators: tag:work, notebook:\"name\", before:YYYY-MM-DD, after:YYYY-MM-DD",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Search query (supports operators: tag:, notebook:, before:, after:)" },
        notebookId: { type: "string", description: "Optional: Limit to specific notebook" },
        tags: { type: "array", items: { type: "string" }, description: "Filter by tags (alternative to tag: operator)" },
        before: { type: "number", description: "Filter notes created before this Unix timestamp" },
        after: { type: "number", description: "Filter notes created after this Unix timestamp" },
        limit: { type: "number", description: "Maximum results (default 20)", default: 20 },
      },
      required: ["query"],
    },
  },
  {
    name: "note_get",
    description: "Get a specific note by ID",
    inputSchema: {
      type: "object" as const,
      properties: {
        noteId: { type: "string", description: "Note ID" },
      },
      required: ["noteId"],
    },
  },
  {
    name: "note_update",
    description: "Update an existing note",
    inputSchema: {
      type: "object" as const,
      properties: {
        noteId: { type: "string", description: "Note ID" },
        title: { type: "string" },
        content: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
        source: { type: "string" },
        context: { type: "string" },
        references: { type: "array", items: { type: "string" } },
        pinned: { type: "boolean" },
      },
      required: ["noteId"],
    },
  },
  {
    name: "note_delete",
    description: "Delete a note",
    inputSchema: {
      type: "object" as const,
      properties: {
        noteId: { type: "string", description: "Note ID" },
      },
      required: ["noteId"],
    },
  },
  {
    name: "notebook_export",
    description: "Export a notebook as markdown or JSON (all notes combined)",
    inputSchema: {
      type: "object" as const,
      properties: {
        notebookId: { type: "string", description: "Notebook ID to export" },
        format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "Export format (default: markdown)",
          default: "markdown"
        },
      },
      required: ["notebookId"],
    },
  },
  {
    name: "note_export",
    description: "Export a single note as markdown",
    inputSchema: {
      type: "object" as const,
      properties: {
        noteId: { type: "string", description: "Note ID to export" },
      },
      required: ["noteId"],
    },
  },
];

// ── Dispatch a tool call ──────────────────────────────────────────────

export async function dispatchToolCall(
  ctx: ActionCtx,
  userId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (toolName) {
    case "memory_store":
      // Validate required fields
      if (!args.content || typeof args.content !== 'string') {
        throw new Error("memory_store requires 'content' parameter (string)");
      }
      if (!args.category) {
        throw new Error("memory_store requires 'category' parameter (one of: learning, preference, fact, project_context, decision)");
      }

      return ctx.runMutation(internal.functions.internal.storeMemory, {
        userId,
        content: args.content as string,
        category: args.category as any,
        tags: (args.tags as string[]) ?? [],
        source: (args.source as string) ?? "mcp",
        importance: (args.importance as number) ?? 0.5,
      });

    case "memory_recall":
      // Validate required fields
      if (!args.query || typeof args.query !== 'string') {
        throw new Error("memory_recall requires 'query' parameter (string)");
      }

      return ctx.runQuery(internal.functions.internal.searchMemories, {
        userId,
        query: args.query as string,
      });

    case "memory_list":
      return ctx.runQuery(internal.functions.internal.listMemories, {
        userId,
        category: args.category as any,
      });

    case "project_list":
      return ctx.runQuery(internal.functions.internal.listProjects, {
        userId,
        status: args.status as any,
      });

    case "project_create":
      return ctx.runMutation(internal.functions.internal.createProject, {
        userId,
        name: args.name as string,
        description: args.description as string | undefined,
        techStack: args.techStack as string[] | undefined,
        goals: args.goals as string[] | undefined,
      });

    case "project_update":
      return ctx.runMutation(internal.functions.internal.updateProject, {
        id: args.id as any,
        userId,
        name: args.name as string | undefined,
        description: args.description as string | undefined,
        status: args.status as any,
        techStack: args.techStack as string[] | undefined,
        goals: args.goals as string[] | undefined,
        currentFocus: args.currentFocus as string | undefined,
      });

    case "settings_list":
      return ctx.runQuery(internal.functions.internal.listSettings, {
        userId,
      });

    case "settings_set":
      return ctx.runMutation(internal.functions.internal.setSetting, {
        userId,
        key: args.key as string,
        value: args.value as string,
      });

    case "notification_send":
      return ctx.runMutation(
        internal.functions.notifications.insertNotification,
        {
          userId,
          type: (args.type as any) ?? "info",
          message: args.message as string,
          title: args.title as string | undefined,
          project: args.project as string | undefined,
        },
      );

    case "notebook_create":
      // Validate required fields
      if (!args.name || typeof args.name !== 'string') {
        throw new Error("notebook_create requires 'name' parameter (string)");
      }

      return ctx.runMutation(internal.functions.notebooks.createNotebookInternal, {
        userId,
        name: args.name as string,
        description: args.description as string | undefined,
        tags: args.tags as string[] | undefined,
        color: args.color as string | undefined,
        icon: args.icon as string | undefined,
      });

    case "notebook_list":
      return ctx.runQuery(internal.functions.notebooks.listNotebooksInternal, {
        userId,
        status: args.status as any,
      });

    case "notebook_search":
      return ctx.runQuery(internal.functions.notebooks.searchNotebooksInternal, {
        userId,
        query: args.query as string,
      });

    case "notebook_update":
      return ctx.runMutation(internal.functions.notebooks.updateNotebookInternal, {
        notebookId: args.notebookId as any,
        userId,
        name: args.name as string | undefined,
        description: args.description as string | undefined,
        tags: args.tags as string[] | undefined,
        status: args.status as any,
        color: args.color as string | undefined,
        icon: args.icon as string | undefined,
      });

    case "note_create":
      // Validate required fields
      if (!args.notebookId) {
        throw new Error("note_create requires 'notebookId' parameter");
      }
      if (!args.title || typeof args.title !== 'string') {
        throw new Error("note_create requires 'title' parameter (string)");
      }
      if (!args.content || typeof args.content !== 'string') {
        throw new Error("note_create requires 'content' parameter (string)");
      }

      return ctx.runMutation(internal.functions.notebooks.createNoteInternal, {
        userId,
        notebookId: args.notebookId as any,
        title: args.title as string,
        content: args.content as string,
        tags: args.tags as string[] | undefined,
        metadata: {
          source: args.source as string | undefined,
          context: args.context as string | undefined,
          references: args.references as string[] | undefined,
        },
        pinned: args.pinned as boolean | undefined,
      });

    case "note_list":
      return ctx.runQuery(internal.functions.notebooks.listNotesInternal, {
        userId,
        notebookId: args.notebookId as any,
        pinnedOnly: args.pinnedOnly as boolean | undefined,
        limit: args.limit as number | undefined,
      });

    case "note_search":
      return ctx.runQuery(internal.functions.notebooks.searchNotesInternal, {
        userId,
        query: args.query as string,
        notebookId: args.notebookId as any,
      });

    case "note_search_semantic":
      return ctx.runAction(internal.search.semanticSearchInternal, {
        query: args.query as string,
        notebookId: args.notebookId as any,
        limit: Math.min((args.limit as number) ?? 10, 50),
      });

    case "note_search_advanced":
      return ctx.runAction(internal.search.hybridSearchInternal, {
        userId,
        query: args.query as string,
        notebookId: args.notebookId as any,
        tags: args.tags as string[] | undefined,
        before: args.before as number | undefined,
        after: args.after as number | undefined,
        limit: Math.min((args.limit as number) ?? 20, 50),
      });

    case "note_get":
      return ctx.runQuery(internal.functions.notebooks.getNoteInternal, {
        userId,
        noteId: args.noteId as any,
      });

    case "note_update":
      return ctx.runMutation(internal.functions.notebooks.updateNoteInternal, {
        noteId: args.noteId as any,
        userId,
        title: args.title as string | undefined,
        content: args.content as string | undefined,
        tags: args.tags as string[] | undefined,
        metadata: {
          source: args.source as string | undefined,
          context: args.context as string | undefined,
          references: args.references as string[] | undefined,
        },
        pinned: args.pinned as boolean | undefined,
      });

    case "note_delete":
      return ctx.runMutation(internal.functions.notebooks.deleteNoteInternal, {
        userId,
        noteId: args.noteId as any,
      });

    case "notebook_export":
      return ctx.runQuery(internal.export._exportNotebook, {
        notebookId: args.notebookId as any,
        format: args.format as any,
        userId, // Pass the MCP user ID
      });

    case "note_export":
      return ctx.runQuery(internal.export._exportNote, {
        noteId: args.noteId as any,
        userId, // Pass the MCP user ID
      });

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
