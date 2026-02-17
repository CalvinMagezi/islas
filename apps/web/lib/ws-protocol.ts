/**
 * WebSocket protocol types shared between the agent WS server and web UI client.
 * Simple JSON frames inspired by OpenClaw.
 */

/** Client → Server request */
export interface WsRequest {
  type: "req";
  id: string;
  method: "chat.send" | "chat.abort" | "chat.reset" | "status";
  params?: Record<string, unknown>;
}

/** Server → Client response to a specific request */
export interface WsResponse {
  type: "res";
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: string;
}

/** Server → Client pushed event */
export interface WsEvent {
  type: "event";
  event:
    | "chat.delta"
    | "chat.final"
    | "chat.error"
    | "chat.tool"
    | "chat.busy";
  payload: unknown;
}

export type WsFrame = WsRequest | WsResponse | WsEvent;

// ── Payload types ─────────────────────────────────────────────

export interface ChatDeltaPayload {
  text: string;
}

export interface ChatFinalPayload {
  text: string;
}

export interface ChatErrorPayload {
  message: string;
}

export interface ChatToolPayload {
  name: string;
  status: "start" | "end";
}

export interface ChatBusyPayload {
  busy: boolean;
}

export interface StatusPayload {
  agent: "online" | "busy" | "offline";
  targetDir: string;
  workerId: string;
}
