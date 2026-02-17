/**
 * MCP Gateway HTTP Actions
 *
 * These HTTP actions provide the backend logic for the Next.js MCP gateway.
 * They handle scope validation, tool filtering, audit logging, and tool dispatch.
 */

import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { VALID_SCOPES, SCOPE_PRESETS } from "./functions/apiKeys";
import { MCP_TOOLS, dispatchToolCall } from "./lib/mcpTools";
import { corsHeaders, hashApiKey } from "./lib/cors";

// Tool-to-scope mapping
const TOOL_SCOPE_REQUIREMENTS: Record<string, string[]> = {
  // Notebook tools
  notebook_list: ["notebooks:read"],
  notebook_search: ["notebooks:read"],
  notebook_create: ["notebooks:write"],
  notebook_update: ["notebooks:write"],
  notebook_export: ["notebooks:read", "notebooks:export"],

  // Note tools
  note_list: ["notes:read"],
  note_get: ["notes:read"],
  note_search: ["notes:read", "search:text"],
  note_search_semantic: ["notes:read", "search:semantic"],
  note_search_advanced: ["notes:read", "search:advanced"],
  note_create: ["notes:write"],
  note_update: ["notes:write"],
  note_delete: ["notes:delete"],
  note_export: ["notes:read", "notes:export"],

  // Memory tools
  memory_store: ["memory:write"],
  memory_recall: ["memory:read"],
};

// Blocked tools (not available via MCP gateway)
const BLOCKED_TOOLS = new Set([
  "job_create", "job_cancel", "job_steer", "job_status", "agent_status",
  "project_list", "project_create", "project_update",
  "settings_list", "settings_set",
  "notification_send",
  "memory_list",
]);

/**
 * Validate if scopes grant access to a tool
 */
function validateToolAccess(
  toolName: string,
  userScopes: string[]
): { allowed: boolean; missingScopes?: string[]; reason?: string } {
  if (BLOCKED_TOOLS.has(toolName)) {
    return {
      allowed: false,
      reason: `Tool "${toolName}" is not available via MCP gateway`,
    };
  }

  const requiredScopes = TOOL_SCOPE_REQUIREMENTS[toolName];
  if (!requiredScopes) {
    return {
      allowed: false,
      reason: `Unknown tool: "${toolName}"`,
    };
  }

  const hasRequiredScope = requiredScopes.some((scope) =>
    userScopes.includes(scope)
  );

  if (!hasRequiredScope) {
    const missingScopes = requiredScopes.filter(
      (scope) => !userScopes.includes(scope)
    );
    return {
      allowed: false,
      missingScopes,
      reason: `Insufficient scopes for tool "${toolName}". Missing one of: ${missingScopes.join(", ")}`,
    };
  }

  return { allowed: true };
}

/**
 * Filter tools by scopes
 */
function filterToolsByScopes(userScopes: string[]): typeof MCP_TOOLS {
  return MCP_TOOLS.filter((tool) => {
    const accessCheck = validateToolAccess(tool.name, userScopes);
    return accessCheck.allowed;
  });
}

/**
 * Validate API key and return key document with scopes
 */
export const validateApiKey = httpAction(async (ctx, request) => {
  const auth = request.headers.get("Authorization");
  if (!auth || !auth.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Missing or invalid Authorization header" }),
      { status: 401, headers: corsHeaders(request) }
    );
  }

  const rawKey = auth.slice(7);
  const keyHash = await hashApiKey(rawKey);

  // @ts-ignore
  const keyDoc = await ctx.runQuery(internal.functions.apiKeys.validateKey, {
    keyHash,
  });

  if (!keyDoc) {
    return new Response(
      JSON.stringify({ error: "Invalid or expired API key" }),
      { status: 401, headers: corsHeaders(request) }
    );
  }

  // Check rate limit
  const rateLimit = await ctx.runMutation(
    internal.functions.apiKeys.checkAndIncrementRateLimit,
    { keyHash }
  );

  if (!rateLimit.allowed) {
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        retryAfterMs: rateLimit.retryAfterMs,
      }),
      {
        status: 429,
        headers: {
          ...corsHeaders(request),
          "Retry-After": String(Math.ceil(rateLimit.retryAfterMs / 1000)),
        },
      }
    );
  }

  // Return key info with scopes
  const scopes = keyDoc.scopes || [...SCOPE_PRESETS.full_access];
  return new Response(
    JSON.stringify({
      userId: keyDoc.userId,
      keyId: keyDoc._id,
      scopes,
    }),
    { status: 200, headers: corsHeaders(request) }
  );
});

/**
 * Get filtered tools list based on scopes
 */
export const getToolsList = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { scopes } = body;

  if (!Array.isArray(scopes)) {
    return new Response(
      JSON.stringify({ error: "Invalid scopes parameter" }),
      { status: 400, headers: corsHeaders(request) }
    );
  }

  const accessibleTools = filterToolsByScopes(scopes);

  return new Response(
    JSON.stringify({ tools: accessibleTools }),
    { status: 200, headers: corsHeaders(request) }
  );
});

/**
 * Execute a tool with scope validation
 */
export const executeTool = httpAction(async (ctx, request) => {
  const body = await request.json();
  const { userId, keyId, scopes, toolName, toolArgs } = body;

  if (!userId || !toolName || !Array.isArray(scopes)) {
    return new Response(
      JSON.stringify({ error: "Missing required parameters" }),
      { status: 400, headers: corsHeaders(request) }
    );
  }

  // Validate tool access
  const accessCheck = validateToolAccess(toolName, scopes);
  if (!accessCheck.allowed) {
    return new Response(
      JSON.stringify({
        error: accessCheck.reason,
        missingScopes: accessCheck.missingScopes,
      }),
      { status: 403, headers: corsHeaders(request) }
    );
  }

  // Execute tool
  try {
    const result = await dispatchToolCall(ctx, userId, toolName, toolArgs || {});

    // Update last used timestamp (fire-and-forget)
    if (keyId) {
      ctx.runMutation(internal.functions.apiKeys.updateLastUsed, {
        id: keyId,
      }).catch(() => {
        /* ignore errors */
      });
    }

    return new Response(
      JSON.stringify({ result }),
      { status: 200, headers: corsHeaders(request) }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Tool execution failed" }),
      { status: 500, headers: corsHeaders(request) }
    );
  }
});

/**
 * Log audit entry
 */
export const logAuditEntry = httpAction(async (ctx, request) => {
  const body = await request.json();
  const {
    userId,
    keyId,
    method,
    toolName,
    success,
    errorCode,
    errorMessage,
    ipAddress,
    userAgent,
    requestDurationMs,
  } = body;

  if (!userId || !keyId || !method || typeof success !== "boolean") {
    return new Response(
      JSON.stringify({ error: "Missing required parameters" }),
      { status: 400, headers: corsHeaders(request) }
    );
  }

  try {
    await ctx.runMutation(internal.functions.mcpAudit.logRequest, {
      userId,
      keyId,
      method,
      toolName,
      success,
      errorCode,
      errorMessage,
      ipAddress,
      userAgent,
      requestDurationMs,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: corsHeaders(request) }
    );
  } catch (error: any) {
    // Don't fail the request if audit logging fails
    console.error("Failed to log audit entry:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: corsHeaders(request) }
    );
  }
});
