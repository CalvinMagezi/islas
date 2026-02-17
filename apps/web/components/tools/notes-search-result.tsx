"use client";

import { BookOpen, Tag } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ToolResultProps } from "../chat/tool-result-part";

interface NoteResult {
  title: string;
  notebook: string;
  snippet: string;
  noteId: string;
  tags: string[];
}

export function NotesSearchResult({ data, status }: ToolResultProps) {
  const { found, results = [] } = (data as { found?: boolean; results?: NoteResult[] }) || {};

  if (status === "partial") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <BookOpen className="h-4 w-4 animate-pulse" />
        Searching notes...
      </div>
    );
  }

  if (!found || results.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">
          No notes found for your query.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <BookOpen className="h-4 w-4" />
        Search Results from Notes ({results.length})
      </div>
      
      {results.map((note: NoteResult, i: number) => (
        <Card key={i} className="p-4 border-l-4 border-l-primary">
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="text-xs text-muted-foreground mb-1">
                  {note.notebook}
                </div>
                <div className="font-medium">{note.title}</div>
              </div>
            </div>
            
            <div className="text-sm text-muted-foreground">
              {note.snippet}
            </div>
            
            {note.tags && note.tags.length > 0 && (
              <div className="flex items-center gap-1 flex-wrap">
                <Tag className="h-3 w-3 text-muted-foreground" />
                {note.tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
            
            <a
              href={`/notebooks?noteId=${note.noteId}`}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              target="_blank"
              rel="noopener noreferrer"
            >
              View full note →
            </a>
          </div>
        </Card>
      ))}
    </div>
  );
}
