"use client";

import { MessageSquare, Clock } from "lucide-react";
import type { ToolResultProps } from "@/components/chat/tool-result-part";

export function ThreadListView({ data }: ToolResultProps) {
  const { threads = [] } = (data as { threads?: Array<{ _id: string; title?: string; _creationTime: number }> }) || {};

  if (threads.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center animate-float-up">
        <MessageSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No threads yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 w-full animate-float-up">
      {threads.map((thread, i: number) => (
        <div
          key={thread._id}
          className="glass rounded-xl flex items-center gap-3 p-3"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <MessageSquare className="h-4 w-4 shrink-0 text-primary/60" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">
              {thread.title || "Untitled thread"}
            </p>
            <p className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
              <Clock className="h-2.5 w-2.5" />
              {new Date(thread._creationTime).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
