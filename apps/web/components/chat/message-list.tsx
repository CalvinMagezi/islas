"use client";

import { useEffect, useRef } from "react";
import { useUIMessages } from "@convex-dev/agent/react";
import { api } from "@repo/convex";
import { MessageRenderer } from "./message-renderer";
import { Loader2 } from "lucide-react";

interface MessageListProps {
  threadId: string;
  onAction: (prompt: string) => void;
}

export function MessageList({ threadId, onAction }: MessageListProps) {
  const { results, status, loadMore } = useUIMessages(
    api.chat.listThreadMessages,
    { threadId },
    { initialNumItems: 50, stream: true },
  );

  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [results]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto scrollbar-thin"
    >
      <div className="mx-auto flex max-w-3xl flex-col py-4">
        {status === "CanLoadMore" && (
          <button
            onClick={() => loadMore(20)}
            className="mx-auto mb-4 rounded-full glass px-4 py-1.5 text-xs text-muted-foreground transition-all hover:text-foreground hover:neon-glow-cyan"
          >
            Load older messages
          </button>
        )}
        {status === "LoadingMore" && (
          <div className="mx-auto mb-4">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
        {results.map((message) => (
          <MessageRenderer
            key={message.key}
            message={message}
            onAction={onAction}
          />
        ))}
        <div ref={bottomRef} className="h-1" />
      </div>
    </div>
  );
}
