"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Calendar, Pin, ExternalLink } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ToolResultProps } from "@/components/chat/tool-result-part";


interface Note {
  _id: string;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  notebookId: string;
}

export function NoteDetail({ data, status }: ToolResultProps) {
  const { note } = (data as { note?: Note }) || {};

  if (status === "partial") {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <FileText className="h-4 w-4 animate-pulse" />
          Loading note...
        </div>
      </Card>
    );
  }

  if (!note) {
    return (
      <Card className="p-6">
        <div className="text-sm text-muted-foreground">
          Note not found or access denied.
        </div>
      </Card>
    );
  }

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(note.createdAt));

  const updatedDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(note.updatedAt));

  return (
    <Card className="overflow-hidden border-l-4 border-l-primary">
      {/* Header */}
      <div className="border-b bg-muted/30 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold leading-tight">
              {note.pinned && (
                <Pin className="inline h-4 w-4 mr-2 text-primary rotate-45" />
              )}
              {note.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Created {formattedDate}
              </span>
              {note.createdAt !== note.updatedAt && (
                <span className="text-muted-foreground/60">
                  Updated {updatedDate}
                </span>
              )}
            </div>
          </div>
          <a
            href={`/notebooks?noteId=${note._id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
          >
            <ExternalLink className="h-3 w-3" />
            Open
          </a>
        </div>

        {/* Tags */}
        {note.tags && note.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="prose prose-sm max-w-none text-foreground">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h1 className="text-xl font-bold mt-4 mb-2 text-foreground">{children}</h1>
              ),
              h2: ({ children }) => (
                <h2 className="text-lg font-semibold mt-3 mb-2 text-foreground">{children}</h2>
              ),
              h3: ({ children }) => (
                <h3 className="text-base font-semibold mt-3 mb-1 text-foreground">{children}</h3>
              ),
              p: ({ children }) => (
                <p className="leading-relaxed mb-3 text-foreground">{children}</p>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              code: ({ className, children }) => {
                const isInline = !className;
                return isInline ? (
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                    {children}
                  </code>
                ) : (
                  <pre className="overflow-x-auto rounded bg-muted p-3 text-xs text-foreground">
                    <code className={className}>{children}</code>
                  </pre>
                );
              },
              blockquote: ({ children }) => (
                <blockquote className="border-l-2 border-primary/30 pl-3 italic text-muted-foreground my-3">
                  {children}
                </blockquote>
              ),
              ul: ({ children }) => (
                <ul className="list-disc pl-5 space-y-1 my-3 text-foreground">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal pl-5 space-y-1 my-3 text-foreground">{children}</ol>
              ),
              li: ({ children }) => <li className="leading-relaxed text-foreground">{children}</li>,
              hr: () => <hr className="my-4 border-t border-border" />,
              table: ({ children }) => (
                <div className="overflow-x-auto my-3">
                  <table className="w-full text-sm border-collapse text-foreground">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-border bg-muted px-3 py-2 text-left font-medium text-foreground">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-border px-3 py-2 text-foreground">{children}</td>
              ),
            }}
          >
            {note.content}
          </ReactMarkdown>
        </div>
      </div>
    </Card>
  );
}
