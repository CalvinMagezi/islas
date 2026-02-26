import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  // Auth tables from @convex-dev/auth (schema structure only - providers not active)
  ...authTables,


  settings: defineTable({
    userId: v.string(),
    key: v.string(),
    value: v.string(),
    updatedAt: v.number(),
  }).index("by_user_key", ["userId", "key"]),



  usageLog: defineTable({
    userId: v.string(),
    threadId: v.optional(v.string()),
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    cost: v.float64(),
    timestamp: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_thread", ["threadId"])
    .index("by_timestamp", ["timestamp"]),

  notifications: defineTable({
    userId: v.string(),
    sessionId: v.optional(v.string()),
    type: v.union(
      v.literal("permission_prompt"),
      v.literal("idle_prompt"),
      v.literal("auth_success"),
      v.literal("task_complete"),
      v.literal("stop"),
      v.literal("info"),
    ),
    message: v.string(),
    title: v.optional(v.string()),
    project: v.optional(v.string()),
    host: v.optional(v.string()),
    cwd: v.optional(v.string()),
    read: v.boolean(),
  })
    .index("by_user", ["userId"])
    .index("by_user_read", ["userId", "read"]),

  apiKeys: defineTable({
    userId: v.string(),
    name: v.string(),
    keyHash: v.string(),
    prefix: v.string(),
    lastUsedAt: v.optional(v.number()),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    scopes: v.optional(v.array(v.string())), // OAuth-style scopes (optional for backwards compatibility)
  })
    .index("by_user", ["userId"])
    .index("by_key_hash", ["keyHash"]),

  rateLimits: defineTable({
    keyHash: v.string(),
    windowStart: v.number(),
    requestCount: v.number(),
  })
    .index("by_key_window", ["keyHash", "windowStart"]),

  mcpAuditLog: defineTable({
    userId: v.string(),
    keyId: v.id("apiKeys"),
    method: v.string(), // "tools/call", "tools/list", "initialize"
    toolName: v.optional(v.string()),
    success: v.boolean(),
    errorCode: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    requestDurationMs: v.optional(v.number()),
    timestamp: v.number(),
  })
    .index("by_user", ["userId", "timestamp"])
    .index("by_key", ["keyId", "timestamp"])
    .index("by_tool", ["toolName", "timestamp"])
    .index("by_timestamp", ["timestamp"]),

  threadMetadata: defineTable({
    threadId: v.string(),
    userId: v.string(),
    status: v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("deleted"),
    ),
    titleGenerated: v.boolean(),
  })
    .index("by_thread", ["threadId"])
    .index("by_user_status", ["userId", "status"]),

  // ==========================================
  // CORE: Notebooks & Notes (Unified System)
  // ==========================================

  notebooks: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    tags: v.array(v.string()),

    // NEW: Notebook type for organization (optional for backwards compatibility)
    type: v.optional(v.union(
      v.literal("personal"),    // User-created notebooks
      v.literal("system"),      // System files (SOUL.md, HEARTBEAT.md, etc.)
      v.literal("digest"),      // AI-generated digests
      v.literal("project"),     // Project documentation
    )),

    status: v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("deleted"),
    ),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),

    // Enhanced metadata (flat for Convex compatibility)
    isArchived: v.optional(v.boolean()),
    generatedBy: v.optional(v.union(
      v.literal("workflow"),
      v.literal("manual"),
      v.literal("ai"),
    )),
    workflowId: v.optional(v.string()),

    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_type", ["type"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_type", ["userId", "type"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["status", "type", "userId"],
    }),

  notes: defineTable({
    notebookId: v.id("notebooks"),
    userId: v.string(),
    title: v.string(),
    content: v.string(),
    tags: v.array(v.string()),

    // NEW: Note type for filtering/display
    noteType: v.optional(v.union(
      v.literal("note"),          // Regular note
      v.literal("digest"),        // Generated digest
      v.literal("system-file"),   // System file content
      v.literal("report"),        // Generated report
    )),

    // Enhanced metadata (keeping original for backwards compatibility)
    metadata: v.optional(v.object({
      source: v.optional(v.string()),
      context: v.optional(v.string()),
      references: v.optional(v.array(v.string())),
    })),

    // Additional flat fields for new functionality
    source: v.optional(v.string()),           // e.g., "digest-workflow", "manual", "import"
    generatedBy: v.optional(v.string()),      // workflow ID or user
    originalFormat: v.optional(v.string()),   // if migrated
    fileName: v.optional(v.string()),         // e.g., "soul", "memory" (for system files)
    version: v.optional(v.number()),          // Version tracking (for system files)
    lastUpdatedBy: v.optional(v.string()),    // "openclaw" | "calvin" (for system files)
    pageNumber: v.optional(v.number()),       // For digest pages

    pinned: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),

    // Embedding fields for semantic search (RAG)
    embeddingStatus: v.optional(v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("embedded"),
      v.literal("failed"),
    )),
    embedding: v.optional(v.array(v.float64())),
    embeddingModel: v.optional(v.string()),
    embeddingDims: v.optional(v.number()),
    embeddedAt: v.optional(v.number()),
    embeddingError: v.optional(v.string()),
  })
    .index("by_notebook", ["notebookId", "createdAt"])
    .index("by_user", ["userId", "createdAt"])
    .index("by_pinned", ["pinned", "createdAt"])
    .index("by_user_pinned", ["userId", "pinned"])
    .index("by_user_type", ["userId", "noteType"])
    .index("by_noteType", ["noteType", "createdAt"])
    .index("by_embeddingStatus", ["embeddingStatus"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["notebookId", "embeddingStatus", "noteType"],
    })
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["notebookId", "noteType", "userId"],
    })
    .searchIndex("search_title", {
      searchField: "title",
      filterFields: ["notebookId", "noteType", "userId"],
    }),

  // ==========================================
  // AGENT: Job Queue & Sessions (HQ)
  // ==========================================

  agentJobs: defineTable({
    userId: v.string(),
    workerId: v.optional(v.string()), // ID of the machine/worker picked up the job
    instruction: v.string(),
    type: v.optional(v.union(v.literal("background"), v.literal("rpc"), v.literal("interactive"))), // Default to background
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("waiting_for_user"), // Agent is waiting for user input
      v.literal("done"),
      v.literal("failed"),
      v.literal("cancelled") // Cancelled via API — agent calls session.abort()
    ),
    result: v.optional(v.any()), // For RPC results
    threadId: v.optional(v.string()), // To link back to a chat thread
    recoveryPoint: v.optional(v.any()), // Snapshot of progress for crash recovery
    pendingUserMessage: v.optional(v.string()), // Message from user during waiting_for_user state
    streamingText: v.optional(v.string()), // Real-time agent output
    conversationHistory: v.optional(v.array(v.object({
      role: v.union(v.literal("user"), v.literal("agent")),
      content: v.string(),
      timestamp: v.number(),
    }))), // Track conversation within the job
    steeringMessage: v.optional(v.string()), // Mid-job course correction via session.steer()
    securityProfile: v.optional(v.union( // Per-job security profile for dynamic tool activation
      v.literal("minimal"),
      v.literal("standard"),
      v.literal("guarded"),
      v.literal("admin")
    )),
    priority: v.optional(v.number()), // Job priority (higher = processed first, default 50)
    modelOverride: v.optional(v.string()), // Override LLM model for this job (e.g. "anthropic/claude-sonnet-4.5")
    thinkingLevel: v.optional(v.union( // Override thinking level for this job
      v.literal("off"),
      v.literal("minimal"),
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("xhigh"),
    )),
    stats: v.optional(v.object({ // Pi SDK session stats captured on job completion
      tokens: v.object({
        input: v.number(),
        output: v.number(),
        cacheRead: v.number(),
        total: v.number(),
      }),
      cost: v.number(),
      toolCalls: v.number(),
      messages: v.number(),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_worker", ["workerId"]),

  jobLogs: defineTable({
    jobId: v.id("agentJobs"),
    type: v.union(
      v.literal("thought"),
      v.literal("tool_call"),
      v.literal("tool_result"),
      v.literal("error"),
      v.literal("info"),
      v.literal("message_start"),
      v.literal("message_delta"),
      v.literal("message_stop"),
      v.literal("message_update"), // Added
      v.literal("message_end"), // Added
      v.literal("turn_start"), // Added
      v.literal("turn_end"), // Added
      v.literal("tool_execution_start"),
      v.literal("tool_execution_end"),
      v.literal("tool_execution_update"), // Added
      v.literal("agent_start"),
      v.literal("agent_stop"),
      v.literal("agent_end"), // Added to match pi-coding-agent
      v.literal("auto_compaction_start"), // Added
      v.literal("auto_compaction_end"), // Added
      v.literal("auto_retry_start"), // Added
      v.literal("auto_retry_end"), // Added
      v.literal("context_usage"), // Pi SDK context window tracking
      v.literal("warning") // Threshold warnings
    ),
    content: v.string(),
    metadata: v.optional(v.any()),
    timestamp: v.number(),
    apiKey: v.optional(v.string())
  })
    .index("by_job", ["jobId", "timestamp"]),

  agentSessions: defineTable({
    userId: v.string(),
    workerId: v.string(),
    status: v.union(
      v.literal("online"),
      v.literal("offline"),
      v.literal("busy")
    ),
    modelConfig: v.optional(v.object({
      provider: v.string(),
      model: v.string(),
    })),
    lastHeartbeat: v.number(),
    currentJobId: v.optional(v.id("agentJobs")),
    serializedState: v.optional(v.string()), // JSON string of session state for recovery
    metadata: v.optional(v.any()), // Extra info like working directory
  })
    .index("by_user", ["userId"])
    .index("by_worker", ["workerId"]),

  // ==========================================
  // APPROVAL: Human-in-the-loop approval requests
  // ==========================================

  approvalRequests: defineTable({
    userId: v.string(),
    source: v.union(v.literal("orchestrator"), v.literal("agent")),
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("rejected"),
      v.literal("expired"),
    ),
    title: v.string(),
    description: v.string(),
    toolName: v.string(),
    toolArgs: v.optional(v.any()),
    riskLevel: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("critical"),
    ),
    threadId: v.optional(v.string()),
    jobId: v.optional(v.id("agentJobs")),
    workflowId: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    resolvedBy: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    expiresAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_user_status", ["userId", "status"])
    .index("by_job", ["jobId"])
    .index("by_workflow", ["workflowId"]),

  // ==========================================
  // WORKSPACE FILES: Files published by the agent
  // ==========================================

  workspaceFiles: defineTable({
    userId: v.string(),
    jobId: v.optional(v.id("agentJobs")),
    name: v.string(),       // display name e.g. "handover-report.docx"
    path: v.string(),       // relative path in /workspace e.g. "reports/handover.docx"
    mimeType: v.string(),
    size: v.number(),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_job", ["jobId"]),

  // ==========================================
  // SKILLS: Agent skill registry
  // ==========================================

  skills: defineTable({
    workerId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    lastSeen: v.number(),
  })
    .index("by_worker", ["workerId"])
    .index("by_name", ["name"]),

  // ==========================================
  // OAKSTONE POC TABLES
  // ==========================================

  oakstoneDocs: defineTable({
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
      v.literal("Listed Assets")
    )),
    companyName: v.optional(v.string()),
    sourceFileId: v.optional(v.id("_storage")),
    chunkIndex: v.optional(v.number()),
    totalChunks: v.optional(v.number()),
    embedding: v.optional(v.array(v.float64())),
    embeddingStatus: v.optional(v.union(v.literal("pending"), v.literal("embedded"), v.literal("failed"))),
    tags: v.array(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_docType", ["docType"])
    .index("by_vertical", ["vertical"])
    .index("by_embeddingStatus", ["embeddingStatus"])
    .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 1536, filterFields: ["docType", "vertical", "embeddingStatus"] })
    .searchIndex("search_content", { searchField: "content", filterFields: ["docType", "vertical", "userId"] }),

  oakstoneDeals: defineTable({
    userId: v.string(),
    name: v.string(),
    vertical: v.union(
      v.literal("Credit"),
      v.literal("Venture"),
      v.literal("Absolute Return"),
      v.literal("Real Assets"),
      v.literal("Digital Assets"),
      v.literal("Listed Assets")
    ),
    status: v.union(v.literal("screening"), v.literal("due_diligence"), v.literal("ic_review"), v.literal("approved"), v.literal("passed"), v.literal("closed")),
    companyName: v.string(),
    sector: v.optional(v.string()),
    geography: v.optional(v.string()),
    dealSize: v.optional(v.string()),
    summary: v.optional(v.string()),
    riskNotes: v.optional(v.string()),
    relatedDocIds: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_vertical", ["vertical"]),

});
