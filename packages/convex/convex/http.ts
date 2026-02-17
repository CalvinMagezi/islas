import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { corsHeaders, hashApiKey } from "./lib/cors";
import { MCP_TOOLS, dispatchToolCall } from "./lib/mcpTools";

const http = httpRouter();

// Note: authTables from @convex-dev/auth provide schema structure only
// Authentication providers (GitHub/Resend) are defined but not active

// ── Input validation limits ───────────────────────────────────────────

const MAX_MESSAGE_LENGTH = 5000;
const MAX_TITLE_LENGTH = 200;
const MAX_SHORT_STRING = 500;

function truncate(s: unknown, max: number): string | undefined {
  if (typeof s !== "string") return undefined;
  return s.slice(0, max);
}

function requireString(s: unknown, max: number): string {
  if (typeof s !== "string") return "";
  return s.slice(0, max);
}

// ── Helper: validate API key, enforce rate limit, return userId ───────

async function authenticateApiKey(
  ctx: { runQuery: any; runMutation: any },
  request: Request,
  headerName: "X-API-Key" | "Authorization",
): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: number; body: string; retryAfter?: number }
> {
  let rawKey: string | null = null;

  if (headerName === "Authorization") {
    const auth = request.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) {
      rawKey = auth.slice(7);
    }
  } else {
    rawKey = request.headers.get(headerName);
  }

  if (!rawKey) {
    return { ok: false, status: 401, body: "Missing API key" };
  }

  const keyHash = await hashApiKey(rawKey);

  // Validate key exists and isn't expired
  // @ts-ignore — TS2589: deep type instantiation in Convex internal references
  const keyDoc = await ctx.runQuery(internal.functions.apiKeys.validateKey, {
    keyHash,
  });
  if (!keyDoc) {
    return { ok: false, status: 401, body: "Invalid or expired API key" };
  }

  // Rate limit check (120 req/min per key)
  const rateResult = await ctx.runMutation(
    internal.functions.apiKeys.checkAndIncrementRateLimit,
    { keyHash },
  );
  if (!rateResult.allowed) {
    return {
      ok: false,
      status: 429,
      body: "Rate limit exceeded",
      retryAfter: Math.ceil(rateResult.retryAfterMs / 1000),
    };
  }

  // Update lastUsedAt
  await ctx.runMutation(internal.functions.apiKeys.updateLastUsed, {
    id: keyDoc._id,
  });

  return { ok: true, userId: keyDoc.userId };
}

// ── CORS preflight for all endpoints ──────────────────────────────────

http.route({
  path: "/api/notifications",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

http.route({
  path: "/mcp",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

http.route({
  path: "/api/plans",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

http.route({
  path: "/api/approvals/create",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

http.route({
  path: "/api/approvals/status",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

// ── POST /api/notifications — Notification ingestion ──────────────────

http.route({
  path: "/api/notifications",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiKey(ctx, request, "X-API-Key");
    if (!auth.ok) {
      return errorResponse(auth.status, auth.body, auth.retryAfter, request);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON body", undefined, request);
    }

    // Map + validate fields
    const notificationType = mapNotificationType(
      body.notification_type ?? body.type ?? "info",
    );

    await ctx.runMutation(
      internal.functions.notifications.insertNotification,
      {
        userId: auth.userId,
        sessionId: truncate(body.session_id ?? body.sessionId, MAX_SHORT_STRING),
        type: notificationType,
        message: requireString(body.message, MAX_MESSAGE_LENGTH),
        title: truncate(body.title, MAX_TITLE_LENGTH),
        project: truncate(
          body.project ?? extractProjectFromCwd(body.cwd),
          MAX_SHORT_STRING,
        ),
        host: truncate(body.host, MAX_SHORT_STRING),
        cwd: truncate(body.cwd, MAX_SHORT_STRING),
      },
    );

    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      },
    );
  }),
});

// ── POST /mcp — MCP JSON-RPC 2.0 endpoint (DEPRECATED) ───────────────
// ⚠️ DEPRECATED: This endpoint is deprecated and will be removed in a future version.
// Please use the secure Next.js gateway at /api/mcp instead.
// The gateway provides:
// - OAuth-style scoped permissions
// - Tool allowlist (only safe tools exposed)
// - Comprehensive audit logging
// - Restricted CORS policy

http.route({
  path: "/mcp",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Return deprecation error to all clients
    return jsonRpcError(
      null,
      -32000,
      "DEPRECATED: This endpoint has been replaced by /api/mcp. " +
      "Please update your MCP client configuration to use the new gateway URL. " +
      "Example: https://your-vercel-url.vercel.app/api/mcp",
      request
    );
  }),
});

// Original /mcp implementation (commented out for reference)
/*
http.route({
  path: "/mcp",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiKey(ctx, request, "Authorization");
    if (!auth.ok) {
      if (auth.status === 429) {
        return jsonRpcError(null, -32000, "Rate limit exceeded", request);
      }
      return jsonRpcError(null, -32000, "Invalid or expired API key", request);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return jsonRpcError(null, -32700, "Parse error", request);
    }

    const { jsonrpc, method, params, id } = body;
    if (jsonrpc !== "2.0") {
      return jsonRpcError(id, -32600, "Invalid JSON-RPC version", request);
    }

    try {
      switch (method) {
        case "initialize":
          return jsonRpcResponse(id, {
            protocolVersion: "2024-11-05",
            capabilities: { tools: {} },
            serverInfo: {
              name: "islas",
              version: "1.0.0",
            },
          }, request);

        case "notifications/initialized":
          return jsonRpcResponse(id, {}, request);

        case "tools/list":
          return jsonRpcResponse(id, { tools: MCP_TOOLS }, request);

        case "tools/call": {
          const toolName = params?.name;
          const toolArgs = params?.arguments ?? {};

          const tool = MCP_TOOLS.find((t) => t.name === toolName);
          if (!tool) {
            return jsonRpcError(id, -32602, `Unknown tool: ${toolName}`, request);
          }

          const result = await dispatchToolCall(
            ctx,
            auth.userId,
            toolName,
            toolArgs,
          );

          return jsonRpcResponse(id, {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          }, request);
        }

        default:
          return jsonRpcError(id, -32601, `Method not found: ${method}`, request);
      }
    } catch (err: any) {
      return jsonRpcError(id, -32603, err.message ?? "Internal error", request);
    }
  }),
});
*/

// ── POST /api/approvals/create — Create approval + start workflow ─────

http.route({
  path: "/api/approvals/create",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiKey(ctx, request, "X-API-Key");
    if (!auth.ok) {
      return errorResponse(auth.status, auth.body, auth.retryAfter, request);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON body", undefined, request);
    }

    if (!body.title || !body.toolName) {
      return errorResponse(400, "Missing required fields: title, toolName", undefined, request);
    }

    const validRisks = ["low", "medium", "high", "critical"];
    const riskLevel = validRisks.includes(body.riskLevel)
      ? body.riskLevel
      : "medium";

    const result = await ctx.runMutation(
      internal.functions.approvals.createApprovalFromAgent,
      {
        userId: auth.userId,
        title: requireString(body.title, MAX_TITLE_LENGTH),
        description: requireString(body.description || body.title, MAX_MESSAGE_LENGTH),
        toolName: requireString(body.toolName, MAX_SHORT_STRING),
        toolArgs: body.toolArgs,
        riskLevel,
        jobId: body.jobId,
        timeoutMinutes: body.timeoutMinutes ?? 30,
      },
    );

    return new Response(
      JSON.stringify({ ok: true, ...result }),
      {
        status: 200,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      },
    );
  }),
});

// ── GET /api/approvals/status — Poll approval status ─────────────────

http.route({
  path: "/api/approvals/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiKey(ctx, request, "X-API-Key");
    if (!auth.ok) {
      return errorResponse(auth.status, auth.body, auth.retryAfter, request);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON body", undefined, request);
    }

    if (!body.approvalId) {
      return errorResponse(400, "Missing required field: approvalId", undefined, request);
    }

    const approval = await ctx.runQuery(
      internal.functions.approvals.getApprovalInternal,
      { approvalId: body.approvalId as Id<"approvalRequests"> },
    );

    if (!approval) {
      return errorResponse(404, "Approval not found", undefined, request);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        status: approval.status,
        approved: approval.status === "approved",
        rejectionReason: approval.rejectionReason,
        resolvedAt: approval.resolvedAt,
      }),
      {
        status: 200,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      },
    );
  }),
});

// ── POST /api/approvals/pending — List pending approvals (for Discord bot) ──

http.route({
  path: "/api/approvals/pending",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

http.route({
  path: "/api/approvals/pending",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiKey(ctx, request, "X-API-Key");
    if (!auth.ok) {
      return errorResponse(auth.status, auth.body, auth.retryAfter, request);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON body", undefined, request);
    }

    const approvals = await ctx.runQuery(
      internal.functions.approvals.listPendingInternal,
      { userId: auth.userId, limit: body.limit ?? 10 },
    );

    return new Response(
      JSON.stringify({
        ok: true,
        approvals: approvals.map((a: any) => ({
          approvalId: a._id,
          title: a.title,
          description: a.description,
          riskLevel: a.riskLevel,
          toolName: a.toolName,
        })),
      }),
      {
        status: 200,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      },
    );
  }),
});

// ── POST /api/settings/discord — Get Discord settings (for agent) ─────

http.route({
  path: "/api/settings/discord",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

http.route({
  path: "/api/settings/discord",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiKey(ctx, request, "X-API-Key");
    if (!auth.ok) {
      return errorResponse(auth.status, auth.body, auth.retryAfter, request);
    }

    const keys = [
      "discord_bot_token",
      "discord_user_id",
      "discord_channel_id",
      "discord_webhook_url",
      "discord_enable_presence",
      "discord_presence_type",
    ];
    const settings: Record<string, string | undefined> = {};

    for (const key of keys) {
      const setting = await ctx.runQuery(
        internal.functions.settings.getByUserKey,
        { userId: auth.userId, key },
      );
      if (setting) {
        const shortKey = key.replace("discord_", "");
        // Convert snake_case to camelCase
        const camelKey = shortKey.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
        settings[camelKey] = setting.value;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        botToken: settings.botToken,
        userId: settings.userId,
        channelId: settings.channelId,
        webhookUrl: settings.webhookUrl,
        enablePresence: settings.enablePresence === "true",
        presenceType: settings.presenceType || "activity",
      }),
      {
        status: 200,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      },
    );
  }),
});

// ── POST /api/discord/interaction — Discord button callback ───────────

http.route({
  path: "/api/discord/interaction",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

http.route({
  path: "/api/discord/interaction",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    // Discord interactions are verified by signature, but for simplicity
    // we use API key auth here (the Discord bot calls this endpoint)
    const auth = await authenticateApiKey(ctx, request, "X-API-Key");
    if (!auth.ok) {
      return errorResponse(auth.status, auth.body, auth.retryAfter, request);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON body", undefined, request);
    }

    const { approvalId, decision, reason } = body;
    if (!approvalId || !decision) {
      return errorResponse(400, "Missing approvalId or decision", undefined, request);
    }

    const validDecisions = ["approved", "rejected"];
    if (!validDecisions.includes(decision)) {
      return errorResponse(400, "Decision must be 'approved' or 'rejected'", undefined, request);
    }

    // Resolve the approval internally
    const approval = await ctx.runQuery(
      internal.functions.approvals.getApprovalInternal,
      { approvalId: approvalId as Id<"approvalRequests"> },
    );

    if (!approval) {
      return errorResponse(404, "Approval not found", undefined, request);
    }

    if (approval.status !== "pending") {
      return new Response(
        JSON.stringify({ ok: false, error: `Already ${approval.status}` }),
        {
          status: 200,
          headers: { ...corsHeaders(request), "Content-Type": "application/json" },
        },
      );
    }

    // Patch the approval
    await ctx.runMutation(
      internal.functions.approvals.resolveApprovalInternal,
      {
        approvalId: approvalId as Id<"approvalRequests">,
        decision,
        resolvedBy: `discord:${auth.userId}`,
        rejectionReason: reason,
      },
    );

    return new Response(
      JSON.stringify({ ok: true, status: decision }),
      {
        status: 200,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      },
    );
  }),
});

// ── /api/jobs/create — CLI job dispatch ───────────────────────────────

http.route({
  path: "/api/jobs/create",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

http.route({
  path: "/api/jobs/create",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiKey(ctx, request, "X-API-Key");
    if (!auth.ok) {
      return errorResponse(auth.status, auth.body, auth.retryAfter, request);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON body", undefined, request);
    }

    const instruction = requireString(body.instruction, MAX_MESSAGE_LENGTH);
    if (!instruction) {
      return errorResponse(400, "Missing or empty 'instruction' field", undefined, request);
    }

    const jobId = await ctx.runMutation(internal.agent.createJobInternal, {
      userId: auth.userId,
      instruction,
      type: body.type || "background",
      priority: typeof body.priority === "number" ? body.priority : undefined,
      threadId: body.threadId,
      securityProfile: body.securityProfile,
      modelOverride: body.modelOverride,
      thinkingLevel: body.thinkingLevel,
      discordChannelId: body.discordChannelId,
      discordIsDM: body.discordIsDM,
    });

    return new Response(
      JSON.stringify({ ok: true, jobId }),
      {
        status: 200,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      },
    );
  }),
});

// ── /api/jobs/discord-completed — Get completed Discord jobs ─────────

http.route({
  path: "/api/jobs/discord-completed",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiKey(ctx, request, "X-API-Key");
    if (!auth.ok) {
      return errorResponse(auth.status, auth.body, auth.retryAfter, request);
    }

    // Query for completed/failed jobs with Discord context
    const jobs = await ctx.runQuery(internal.agent.getCompletedDiscordJobs, {
      userId: auth.userId,
    });

    return new Response(
      JSON.stringify({ ok: true, jobs }),
      {
        status: 200,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      },
    );
  }),
});

// ── /api/jobs/discord-notified — Mark a job as Discord-notified ──────

http.route({
  path: "/api/jobs/discord-notified",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiKey(ctx, request, "X-API-Key");
    if (!auth.ok) {
      return errorResponse(auth.status, auth.body, auth.retryAfter, request);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON body", undefined, request);
    }

    if (!body.jobId) {
      return errorResponse(400, "Missing 'jobId' field", undefined, request);
    }

    await ctx.runMutation(internal.agent.markDiscordNotified, {
      jobId: body.jobId,
    });

    return new Response(
      JSON.stringify({ ok: true }),
      {
        status: 200,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      },
    );
  }),
});

// ── GET /api/jobs/status — Check job status ──────────────────────────

http.route({
  path: "/api/jobs/status",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

http.route({
  path: "/api/jobs/status",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiKey(ctx, request, "X-API-Key");
    if (!auth.ok) {
      return errorResponse(auth.status, auth.body, auth.retryAfter, request);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON body", undefined, request);
    }

    if (!body.jobId) {
      return errorResponse(400, "Missing 'jobId' field", undefined, request);
    }

    const job = await ctx.runQuery(internal.agent.getJobInternal, {
      jobId: body.jobId,
    });

    if (!job) {
      return errorResponse(404, "Job not found", undefined, request);
    }

    // Extract last agent response from conversationHistory if streamingText is empty
    let responseText = job.streamingText;
    if (!responseText && job.conversationHistory) {
      const lastAgentMessage = job.conversationHistory
        .filter((msg: any) => msg.role === "agent")
        .pop();
      if (lastAgentMessage) {
        responseText = lastAgentMessage.content;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        jobId: job._id,
        status: job.status,
        instruction: job.instruction,
        result: job.result,
        streamingText: responseText, // Now includes last agent response
        discordChannelId: job.discordChannelId,
        discordIsDM: job.discordIsDM,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
      }),
      {
        status: 200,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      },
    );
  }),
});

// ── POST /api/jobs/cancel — Cancel a running job ──────────────────────

http.route({
  path: "/api/jobs/cancel",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

http.route({
  path: "/api/jobs/cancel",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiKey(ctx, request, "X-API-Key");
    if (!auth.ok) {
      return errorResponse(auth.status, auth.body, auth.retryAfter, request);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON body", undefined, request);
    }

    if (!body.jobId) {
      return errorResponse(400, "Missing 'jobId' field", undefined, request);
    }

    const result = await ctx.runMutation(internal.agent.cancelJobInternal, {
      jobId: body.jobId,
    });

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      },
    );
  }),
});

// ── POST /api/jobs/steer — Send steering message to running job ──────

http.route({
  path: "/api/jobs/steer",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

http.route({
  path: "/api/jobs/steer",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiKey(ctx, request, "X-API-Key");
    if (!auth.ok) {
      return errorResponse(auth.status, auth.body, auth.retryAfter, request);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON body", undefined, request);
    }

    if (!body.jobId || !body.message) {
      return errorResponse(400, "Missing 'jobId' or 'message' field", undefined, request);
    }

    const result = await ctx.runMutation(internal.agent.steerJobInternal, {
      jobId: body.jobId,
      message: body.message,
    });

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      },
    );
  }),
});

// ── POST /api/plans — Plan ingestion (from Claude Code hooks) ─────────

http.route({
  path: "/api/plans",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const auth = await authenticateApiKey(ctx, request, "X-API-Key");
    if (!auth.ok) {
      return errorResponse(auth.status, auth.body, auth.retryAfter, request);
    }

    let body: any;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, "Invalid JSON body", undefined, request);
    }

    // Validate required fields
    if (!body.title || typeof body.title !== "string") {
      return errorResponse(400, "Missing or invalid title", undefined, request);
    }
    if (!body.content || typeof body.content !== "string") {
      return errorResponse(400, "Missing or invalid content", undefined, request);
    }

    // Get or create "Plans" notebook
    const notebookName = body.notebook || "Plans";
    const notebookResult = await ctx.runMutation(
      internal.notebooks.findNotebookByName,
      {
        userId: auth.userId,
        name: notebookName,
        createIfMissing: true,
      },
    );

    // Create the plan note
    const result = await ctx.runMutation(
      internal.notebooks.createNoteInternal,
      {
        userId: auth.userId,
        notebookId: notebookResult.notebookId as Id<"notebooks">,
        title: requireString(body.title, MAX_TITLE_LENGTH),
        content: body.content,
        tags: Array.isArray(body.tags)
          ? body.tags.slice(0, 10).map((t: any) => String(t).slice(0, 50))
          : ["plan"],
        pinned: body.pinned ?? false,
      },
    );

    return new Response(
      JSON.stringify({ ok: true, noteId: result.noteId }),
      {
        status: 200,
        headers: { ...corsHeaders(request), "Content-Type": "application/json" },
      },
    );
  }),
});

// ── Helpers ───────────────────────────────────────────────────────────

function mapNotificationType(raw: string) {
  const valid = [
    "permission_prompt",
    "idle_prompt",
    "auth_success",
    "task_complete",
    "stop",
    "info",
  ] as const;
  type NotifType = (typeof valid)[number];

  if (valid.includes(raw as NotifType)) return raw as NotifType;

  const map: Record<string, NotifType> = {
    notification: "info",
    Notification: "info",
    Stop: "stop",
    stop: "stop",
  };
  return map[raw] ?? "info";
}

function extractProjectFromCwd(cwd?: string): string | undefined {
  if (!cwd) return undefined;
  const parts = cwd.replace(/\/+$/, "").split("/");
  return parts[parts.length - 1] || undefined;
}

function errorResponse(status: number, message: string, retryAfter?: number, request?: Request) {
  const headers: Record<string, string> = {
    ...corsHeaders(request),
    "Content-Type": "application/json",
  };
  if (retryAfter) {
    headers["Retry-After"] = String(retryAfter);
  }
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

function jsonRpcResponse(id: unknown, result: unknown, request?: Request) {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id, result }),
    {
      status: 200,
      headers: { ...corsHeaders(request), "Content-Type": "application/json" },
    },
  );
}

function jsonRpcError(id: unknown, code: number, message: string, request?: Request) {
  return new Response(
    JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }),
    {
      status: 200,
      headers: { ...corsHeaders(request), "Content-Type": "application/json" },
    },
  );
}

// ── MCP Gateway HTTP Actions (for Next.js gateway) ───────────────────

import * as mcpGateway from "./mcpGateway";

http.route({
  path: "/gateway/mcp/validate-key",
  method: "POST",
  handler: mcpGateway.validateApiKey,
});

http.route({
  path: "/gateway/mcp/tools-list",
  method: "POST",
  handler: mcpGateway.getToolsList,
});

http.route({
  path: "/gateway/mcp/execute-tool",
  method: "POST",
  handler: mcpGateway.executeTool,
});

http.route({
  path: "/gateway/mcp/audit-log",
  method: "POST",
  handler: mcpGateway.logAuditEntry,
});

// CORS OPTIONS for gateway endpoints
http.route({
  path: "/gateway/mcp/validate-key",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

http.route({
  path: "/gateway/mcp/tools-list",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

http.route({
  path: "/gateway/mcp/execute-tool",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

http.route({
  path: "/gateway/mcp/audit-log",
  method: "OPTIONS",
  handler: httpAction(async (ctx, request) => {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }),
});

export default http;
