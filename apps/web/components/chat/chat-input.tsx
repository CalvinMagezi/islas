"use client";

import { useState, useRef, useCallback, useEffect, type KeyboardEvent } from "react";
import { useMutation } from "convex/react";
import { api } from "@repo/convex";
import { optimisticallySendMessage } from "@convex-dev/agent/react";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "lucide-react";

interface ChatInputProps {
  threadId: string | null;
  onEnsureThread: () => Promise<string>;
}

export function ChatInput({ threadId, onEnsureThread }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendMessage = useMutation(
    api.chat.sendMessage,
  ).withOptimisticUpdate(
    optimisticallySendMessage(api.chat.listThreadMessages),
  );

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [input]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;

    let currentThreadId = threadId;
    if (!currentThreadId) {
      currentThreadId = await onEnsureThread();
    }

    setInput("");
    await sendMessage({ threadId: currentThreadId, prompt: text });
  }, [input, threadId, onEnsureThread, sendMessage]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="border-t border-border/50 p-3 sm:p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2">
        <div className="glass flex-1 rounded-xl p-1 focus-within:neon-glow-cyan transition-shadow">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Islas..."
            className="w-full resize-none bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none disabled:opacity-50"
            rows={1}
            style={{ maxHeight: 200 }}
          />
        </div>
        <Button
          onClick={handleSend}
          disabled={!input.trim()}
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground transition-all hover:neon-glow-cyan disabled:opacity-30"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
      <p className="mt-1.5 text-center text-[10px] text-muted-foreground/40">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
