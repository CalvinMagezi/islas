"use client";

import { Pin, BookOpen } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ToolResultProps } from "../chat/tool-result-part";

interface PinnedNote {
  notebook: string;
  title: string;
  content: string;
  tags: string[];
}

export function ContextLoaded({ data, status }: ToolResultProps) {
  const { loaded, count = 0, pinnedNotes = [] } = (data as { loaded?: boolean; count?: number; pinnedNotes?: PinnedNote[] }) || {};

  if (status === "partial") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-sm">
        <Pin className="h-4 w-4 animate-pulse" />
        Loading context...
      </div>
    );
  }

  if (!loaded || count === 0) {
    return (
      <Card className="p-3 bg-muted/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Pin className="h-4 w-4" />
          No pinned notes found. Pin important notes to have them loaded automatically in future conversations.
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 border-l-4 border-l-amber-500 bg-amber-50 dark:bg-amber-950/20">
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Pin className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          <span className="text-amber-900 dark:text-amber-100">
            Context Loaded ({count} pinned note{count > 1 ? 's' : ''})
          </span>
        </div>
        
        <div className="text-sm text-amber-800 dark:text-amber-200">
          I&apos;m now aware of your pinned notes and will use this context throughout our conversation.
        </div>
        
        <div className="space-y-2">
          {pinnedNotes.map((note: PinnedNote, i: number) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <BookOpen className="h-3 w-3 mt-0.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
              <div className="flex-1">
                <span className="text-amber-700 dark:text-amber-300 font-medium">
                  {note.title}
                </span>
                <span className="text-amber-600 dark:text-amber-400 ml-1">
                  ({note.notebook})
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
