/**
 * Secure MCP Gateway with Scoped Permissions
 *
 * This Next.js API route acts as a proxy that calls Convex HTTP actions
 * to enforce OAuth-style scope-based permissions, tool allowlisting,
 * and audit logging.
 *
 * JSON-RPC 2.0 Methods:
 * - initialize: Returns server info
 * - tools/list: Returns tools accessible with current scopes
 * - tools/call: Executes a tool (if permitted)
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * JSON-RPC 2.0 Types
 */
interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * CORS configuration
 */
const ALLOWED_ORIGINS = [
  "https://claude.ai",
  "https://console.anthropic.com",
  process.env.NEXT_PUBLIC_VERCEL_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
    : null,
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : null,
  process.env.NODE_ENV === "development" ? "http://localhost:3001" : null,
].filter((origin): origin is string => origin !== null);

function getCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };

  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Access-Control-Allow-Credentials"] = "true";
  } else {
    headers["Access-Control-Allow-Origin"] = "*";
  }

  return headers;
}

/**
 * JSON-RPC 2.0 error codes
 */
const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

/**
 * Get Convex deployment URL for HTTP actions
 * HTTP actions use .convex.site, not .convex.cloud
 */
function getConvexUrl(): string {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
  }
  // Convert .convex.cloud to .convex.site for HTTP actions
  return url.replace(".convex.cloud", ".convex.site");
}

/**
 * Call Convex HTTP action
 */
async function callConvexAction(
  path: string,
  body: Record<string, unknown>,
  headers: Record<string, string> = {}
): Promise<Response> {
  const convexUrl = getConvexUrl();
  const url = `${convexUrl}${path}`;

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/**
 * POST handler for JSON-RPC 2.0 requests
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // 1. Parse JSON-RPC request
    let body: JsonRpcRequest;
    try {
      body = await req.json() as JsonRpcRequest;
    } catch {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          error: {
            code: JSON_RPC_ERRORS.PARSE_ERROR,
            message: "Parse error: Invalid JSON",
          },
          id: null,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    const { jsonrpc, method, params, id } = body;

    // Validate JSON-RPC 2.0 format
    if (jsonrpc !== "2.0" || !method) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          error: {
            code: JSON_RPC_ERRORS.INVALID_REQUEST,
            message: "Invalid request: Must be valid JSON-RPC 2.0",
          },
          id: id ?? null,
        },
        { status: 400, headers: corsHeaders }
      );
    }

    // 2. Validate API key via Convex
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          error: {
            code: JSON_RPC_ERRORS.INVALID_REQUEST,
            message: "Missing Authorization header",
          },
          id: id ?? null,
        },
        { status: 401, headers: corsHeaders }
      );
    }

    console.log("[MCP Gateway] Validating key:", authHeader.substring(0, 20) + "...");
    console.log("[MCP Gateway] Convex URL:", getConvexUrl());

    const validateRes = await callConvexAction(
      "/gateway/mcp/validate-key",
      {},
      { Authorization: authHeader }
    );

    console.log("[MCP Gateway] Validate response status:", validateRes.status);

    if (!validateRes.ok) {
      let errorData: Record<string, unknown> = {};
      const text = await validateRes.text();
      try {
        errorData = text ? JSON.parse(text) as Record<string, unknown> : {};
      } catch (_e) {
        errorData = { error: text || "Unknown error" };
      }

      // Handle rate limit
      if (validateRes.status === 429) {
        return NextResponse.json(
          {
            jsonrpc: "2.0",
            error: {
              code: 429,
              message: errorData.error || "Rate limit exceeded",
              data: {
                retryAfterMs: errorData.retryAfterMs,
              },
            },
            id: id ?? null,
          },
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Retry-After": validateRes.headers.get("Retry-After") || "60",
            },
          }
        );
      }

      return NextResponse.json(
        {
          jsonrpc: "2.0",
          error: {
            code: JSON_RPC_ERRORS.INVALID_REQUEST,
            message: errorData.error || "Invalid API key",
          },
          id: id ?? null,
        },
        { status: 401, headers: corsHeaders }
      );
    }

    let userData: Record<string, unknown> = {};
    const text = await validateRes.text();
    try {
      userData = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch (_e) {
      console.error("Failed to parse validateRes JSON:", text);
      return NextResponse.json(
        {
          jsonrpc: "2.0",
          error: {
            code: JSON_RPC_ERRORS.INTERNAL_ERROR,
            message: "Failed to parse API key validation response",
          },
          id: id ?? null,
        },
        { status: 500, headers: corsHeaders }
      );
    }

    const { userId, keyId, scopes } = userData;

    // 3. Handle JSON-RPC methods
    switch (method) {
      case "initialize": {
        // Log audit entry (fire-and-forget)
        callConvexAction("/gateway/mcp/audit-log", {
          userId,
          keyId,
          method: "initialize",
          success: true,
          ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip"),
          userAgent: req.headers.get("user-agent"),
          requestDurationMs: Date.now() - startTime,
        }).catch(() => {});

        return NextResponse.json(
          {
            jsonrpc: "2.0",
            result: {
              protocolVersion: "2024-11-05",
              capabilities: {
                tools: {},
              },
              serverInfo: {
                name: "islas-gateway",
                version: "1.0.0",
              },
            },
            id,
          },
          { headers: corsHeaders }
        );
      }

      case "tools/list": {
        const toolsRes = await callConvexAction("/gateway/mcp/tools-list", {
          scopes,
        });

        if (!toolsRes.ok) {
          const errorData = await toolsRes.json();
          return NextResponse.json(
            {
              jsonrpc: "2.0",
              error: {
                code: JSON_RPC_ERRORS.INTERNAL_ERROR,
                message: errorData.error || "Failed to get tools list",
              },
              id,
            },
            { status: 500, headers: corsHeaders }
          );
        }

        const { tools } = await toolsRes.json();

        // Log audit entry (fire-and-forget)
        callConvexAction("/gateway/mcp/audit-log", {
          userId,
          keyId,
          method: "tools/list",
          success: true,
          ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip"),
          userAgent: req.headers.get("user-agent"),
          requestDurationMs: Date.now() - startTime,
        }).catch(() => {});

        return NextResponse.json(
          {
            jsonrpc: "2.0",
            result: {
              tools,
            },
            id,
          },
          { headers: corsHeaders }
        );
      }

      case "tools/call": {
        const { name: toolName, arguments: toolArgs } = params || {};

        if (!toolName) {
          // Log audit entry (fire-and-forget)
          callConvexAction("/gateway/mcp/audit-log", {
            userId,
            keyId,
            method: "tools/call",
            success: false,
            errorCode: JSON_RPC_ERRORS.INVALID_PARAMS,
            errorMessage: "Missing tool name",
            ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip"),
            userAgent: req.headers.get("user-agent"),
            requestDurationMs: Date.now() - startTime,
          }).catch(() => {});

          return NextResponse.json(
            {
              jsonrpc: "2.0",
              error: {
                code: JSON_RPC_ERRORS.INVALID_PARAMS,
                message: "Missing required parameter: name",
              },
              id,
            },
            { status: 400, headers: corsHeaders }
          );
        }

        const executeRes = await callConvexAction("/gateway/mcp/execute-tool", {
          userId,
          keyId,
          scopes,
          toolName,
          toolArgs: toolArgs || {},
        });

        const executeData = await executeRes.json();

        if (!executeRes.ok) {
          // Log audit entry (fire-and-forget)
          callConvexAction("/gateway/mcp/audit-log", {
            userId,
            keyId,
            method: "tools/call",
            toolName,
            success: false,
            errorCode: executeRes.status === 403 ? JSON_RPC_ERRORS.INVALID_PARAMS : JSON_RPC_ERRORS.INTERNAL_ERROR,
            errorMessage: executeData.error,
            ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip"),
            userAgent: req.headers.get("user-agent"),
            requestDurationMs: Date.now() - startTime,
          }).catch(() => {});

          return NextResponse.json(
            {
              jsonrpc: "2.0",
              error: {
                code: executeRes.status === 403 ? JSON_RPC_ERRORS.INVALID_PARAMS : JSON_RPC_ERRORS.INTERNAL_ERROR,
                message: executeData.error || "Tool execution failed",
                data: {
                  missingScopes: executeData.missingScopes,
                },
              },
              id,
            },
            { status: executeRes.status, headers: corsHeaders }
          );
        }

        // Log audit entry (fire-and-forget)
        callConvexAction("/gateway/mcp/audit-log", {
          userId,
          keyId,
          method: "tools/call",
          toolName,
          success: true,
          ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip"),
          userAgent: req.headers.get("user-agent"),
          requestDurationMs: Date.now() - startTime,
        }).catch(() => {});

        return NextResponse.json(
          {
            jsonrpc: "2.0",
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(executeData.result, null, 2),
                },
              ],
            },
            id,
          },
          { headers: corsHeaders }
        );
      }

      default: {
        // Log audit entry (fire-and-forget)
        callConvexAction("/gateway/mcp/audit-log", {
          userId,
          keyId,
          method,
          success: false,
          errorCode: JSON_RPC_ERRORS.METHOD_NOT_FOUND,
          errorMessage: `Unknown method: ${method}`,
          ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0].trim() || req.headers.get("x-real-ip"),
          userAgent: req.headers.get("user-agent"),
          requestDurationMs: Date.now() - startTime,
        }).catch(() => {});

        return NextResponse.json(
          {
            jsonrpc: "2.0",
            error: {
              code: JSON_RPC_ERRORS.METHOD_NOT_FOUND,
              message: `Method not found: ${method}`,
            },
            id,
          },
          { status: 404, headers: corsHeaders }
        );
      }
    }
  } catch (error: unknown) {
    console.error("MCP Gateway error:", error);

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        error: {
          code: JSON_RPC_ERRORS.INTERNAL_ERROR,
          message: "Internal server error",
          data: {
            details: process.env.NODE_ENV === "development" ? errorMessage : undefined,
          },
        },
        id: null,
      },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}
