"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Calendar, Pin, FileText, ExternalLink } from "lucide-react";
import type { ToolResultProps } from "@/components/chat/tool-result-part";


interface Note {
  _id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

interface Notebook {
  _id: string;
  name: string;
  description?: string;
  tags: string[];
  type?: string;
  status: string;
  color?: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

export function NotebookDetail({ data, status, onAction }: ToolResultProps) {
  const { notebook, notes = [] } = (data as { notebook?: Notebook; notes?: Note[] }) || {};

  if (status === "partial") {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BookOpen className="h-4 w-4 animate-pulse" />
          Loading notebook...
        </div>
      </Card>
    );
  }

  if (!notebook) {
    return (
      <Card className="p-6">
        <div className="text-sm text-muted-foreground">
          Notebook not found or access denied.
        </div>
      </Card>
    );
  }

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(notebook.createdAt));

  const updatedDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(notebook.updatedAt));

  // Separate pinned and unpinned notes
  const pinnedNotes = notes.filter((note) => note.pinned);
  const unpinnedNotes = notes.filter((note) => !note.pinned);

  const renderNote = (note: Note) => (
    <Card
      key={note._id}
      className="p-3 cursor-pointer transition-colors hover:bg-accent/50"
      onClick={() => onAction?.(`show note ${note._id}`)}
    >
      <div className="flex items-start gap-2">
        {note.pinned && <Pin className="h-3 w-3 text-primary rotate-45 shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm truncate">{note.title}</h4>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
            {note.content
              .replace(/^#+\s/gm, "")
              .replace(/\*\*/g, "")
              .replace(/\*/g, "")
              .substring(0, 100)}
            ...
          </p>
          <div className="mt-2 flex items-center gap-2">
            {note.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
            <span className="text-[10px] text-muted-foreground ml-auto">
              {new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
              }).format(new Date(note.createdAt))}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Notebook Header */}
      <Card className="border-l-4 border-l-primary">
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl">{notebook.icon || "📓"}</span>
                <h2 className="text-xl font-semibold">{notebook.name}</h2>
              </div>
              {notebook.description && (
                <p className="text-sm text-muted-foreground mb-2">
                  {notebook.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Created {formattedDate}
                </span>
                {notebook.createdAt !== notebook.updatedAt && (
                  <span className="text-muted-foreground/60">
                    Updated {updatedDate}
                  </span>
                )}
                {notebook.type && (
                  <Badge variant="outline" className="text-[10px]">
                    {notebook.type}
                  </Badge>
                )}
                <Badge variant={notebook.status === "active" ? "default" : "secondary"} className="text-[10px]">
                  {notebook.status}
                </Badge>
              </div>
            </div>
            <a
              href={`/notebooks?notebookId=${notebook._id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
            >
              <ExternalLink className="h-3 w-3" />
              Open
            </a>
          </div>

          {/* Tags */}
          {notebook.tags && notebook.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {notebook.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* Notes Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Notes ({notes.length})
          </h3>
        </div>

        {notes.length === 0 ? (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted-foreground">No notes in this notebook yet.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {/* Pinned Notes */}
            {pinnedNotes.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
                  Pinned
                </p>
                {pinnedNotes.map(renderNote)}
              </div>
            )}

            {/* Regular Notes */}
            {unpinnedNotes.length > 0 && (
              <div className="space-y-2">
                {pinnedNotes.length > 0 && (
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">
                    Notes
                  </p>
                )}
                {unpinnedNotes.map(renderNote)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
