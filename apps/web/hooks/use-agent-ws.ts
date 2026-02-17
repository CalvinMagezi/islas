/**
 * React hook for WebSocket connection to the local HQ agent.
 * Provides real-time chat with streaming deltas and graceful fallback.
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type {
  WsRequest,
  WsResponse,
  WsEvent,
  WsFrame,
  ChatDeltaPayload,
  ChatFinalPayload,
  ChatErrorPayload,
  ChatToolPayload,
  ChatBusyPayload,
  StatusPayload,
} from "@/lib/ws-protocol";

export interface UseAgentWsOptions {
  /** WebSocket URL. Default: ws://localhost:5678 */
  url?: string;
  /** Called on each streaming text delta (accumulated, not incremental) */
  onDelta?: (text: string) => void;
  /** Called when the full response is ready */
  onFinal?: (text: string) => void;
  /** Called on chat errors */
  onError?: (message: string) => void;
  /** Called when busy state changes */
  onBusy?: (busy: boolean) => void;
  /** Called on tool execution events */
  onToolEvent?: (name: string, status: "start" | "end") => void;
}

export interface UseAgentWsReturn {
  /** Whether the WebSocket is connected to the agent */
  connected: boolean;
  /** Whether the agent is currently processing a message */
  busy: boolean;
  /** Send a chat message to the agent */
  send: (text: string) => Promise<boolean>;
  /** Abort the current chat processing */
  abort: () => Promise<boolean>;
  /** Reset the chat session */
  reset: () => Promise<boolean>;
  /** Get agent status */
  getStatus: () => Promise<StatusPayload | null>;
}

const DEFAULT_URL = "ws://localhost:5678";
const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 16000;
const MAX_RECONNECT_ATTEMPTS = 10;
const REQUEST_TIMEOUT_MS = 60000;

type PendingRequest = {
  resolve: (value: WsResponse) => void;
  reject: (reason: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export function useAgentWs(options?: UseAgentWsOptions): UseAgentWsReturn {
  const [connected, setConnected] = useState(false);
  const [busy, setBusy] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef<Map<string, PendingRequest>>(new Map());
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmountedRef = useRef(false);
  const connectRef = useRef<(() => void) | null>(null);

  // Store callbacks in refs to avoid reconnecting on every options change
  const optionsRef = useRef(options);

  // Update optionsRef in an effect to avoid accessing ref during render
  useEffect(() => {
    optionsRef.current = options;
  });

  const url = options?.url || process.env.NEXT_PUBLIC_AGENT_WS_URL || DEFAULT_URL;

  // ── Send a request and wait for its response ──────────────

  const sendRequest = useCallback(
    (method: string, params?: Record<string, unknown>): Promise<WsResponse> => {
      return new Promise((resolve, reject) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new Error("WebSocket not connected"));
          return;
        }

        const id = crypto.randomUUID();
        const req: WsRequest = { type: "req", id, method: method as WsRequest["method"], params };

        const timer = setTimeout(() => {
          pendingRef.current.delete(id);
          reject(new Error(`Request ${method} timed out`));
        }, REQUEST_TIMEOUT_MS);

        pendingRef.current.set(id, { resolve, reject, timer });

        try {
          ws.send(JSON.stringify(req));
        } catch (err) {
          clearTimeout(timer);
          pendingRef.current.delete(id);
          reject(err);
        }
      });
    },
    [],
  );

  // ── Public API ────────────────────────────────────────────

  const send = useCallback(
    async (text: string): Promise<boolean> => {
      try {
        const res = await sendRequest("chat.send", { text });
        return res.ok;
      } catch {
        return false;
      }
    },
    [sendRequest],
  );

  const abort = useCallback(async (): Promise<boolean> => {
    try {
      const res = await sendRequest("chat.abort");
      return res.ok;
    } catch {
      return false;
    }
  }, [sendRequest]);

  const reset = useCallback(async (): Promise<boolean> => {
    try {
      const res = await sendRequest("chat.reset");
      return res.ok;
    } catch {
      return false;
    }
  }, [sendRequest]);

  const getStatus = useCallback(async (): Promise<StatusPayload | null> => {
    try {
      const res = await sendRequest("status");
      return res.ok ? (res.payload as StatusPayload) : null;
    } catch {
      return null;
    }
  }, [sendRequest]);

  // ── WebSocket lifecycle ───────────────────────────────────

  const connect = useCallback(() => {
    if (unmountedRef.current) return;
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) return;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        if (unmountedRef.current) {
          ws.close();
          return;
        }
        setConnected(true);
        reconnectAttemptRef.current = 0;
      };

      ws.onmessage = (event) => {
        // Ignore messages from stale connections (React strict mode)
        if (wsRef.current !== ws) return;

        try {
          const frame = JSON.parse(event.data as string) as WsFrame;

          if (frame.type === "res") {
            // Match response to pending request
            const pending = pendingRef.current.get(frame.id);
            if (pending) {
              clearTimeout(pending.timer);
              pendingRef.current.delete(frame.id);
              pending.resolve(frame as WsResponse);
            }
          } else if (frame.type === "event") {
            const evt = frame as WsEvent;
            const opts = optionsRef.current;

            switch (evt.event) {
              case "chat.delta": {
                opts?.onDelta?.((evt.payload as ChatDeltaPayload).text);
                break;
              }
              case "chat.final": {
                opts?.onFinal?.((evt.payload as ChatFinalPayload).text);
                break;
              }
              case "chat.error": {
                opts?.onError?.((evt.payload as ChatErrorPayload).message);
                break;
              }
              case "chat.tool": {
                const tool = evt.payload as ChatToolPayload;
                opts?.onToolEvent?.(tool.name, tool.status);
                break;
              }
              case "chat.busy": {
                const busyPayload = evt.payload as ChatBusyPayload;
                setBusy(busyPayload.busy);
                opts?.onBusy?.(busyPayload.busy);
                break;
              }
            }
          }
        } catch {
          // Malformed frame, ignore
        }
      };

      ws.onclose = () => {
        // Only handle cleanup/reconnect if THIS ws is still the active one.
        // Prevents React strict mode stale closures from triggering extra reconnects.
        if (wsRef.current !== ws) return;

        wsRef.current = null;
        setConnected(false);
        setBusy(false);

        // Reject all pending requests
        for (const [, pending] of pendingRef.current) {
          clearTimeout(pending.timer);
          pending.reject(new Error("WebSocket closed"));
        }
        pendingRef.current.clear();

        // Reconnect with exponential backoff
        if (!unmountedRef.current && reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = Math.min(
            RECONNECT_BASE_MS * Math.pow(2, reconnectAttemptRef.current),
            RECONNECT_MAX_MS,
          );
          reconnectAttemptRef.current++;
          reconnectTimerRef.current = setTimeout(() => connectRef.current?.(), delay);
        }
      };

      ws.onerror = () => {
        // onclose will fire after this, which handles reconnection
      };

      wsRef.current = ws;
    } catch {
      // Connection failed, onclose handler will attempt reconnection
    }
  }, [url]);

  // Store connect function in ref for use in callbacks
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    unmountedRef.current = false;
    connect();

    return () => {
      unmountedRef.current = true;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }

      // Clean up pending requests
      for (const [, pending] of pendingRef.current) {
        clearTimeout(pending.timer);
      }
      pendingRef.current.clear();
    };
  }, [connect]);

  return { connected, busy, send, abort, reset, getStatus };
}
