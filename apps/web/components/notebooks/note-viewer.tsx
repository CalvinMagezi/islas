"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@repo/convex";
import { Id } from "@repo/convex";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NoteEditorDialog } from "./note-editor-dialog";
import { DeleteNoteDialog } from "./delete-note-dialog";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pencil, Trash2 } from "lucide-react";

interface NoteViewerProps {
  noteId: Id<"notes">;
  onClose: () => void;
}

export function NoteViewer({ noteId, onClose }: NoteViewerProps) {
  const note = useQuery(api.notebooks.getNote, { noteId });
  const togglePin = useMutation(api.notebooks.togglePin);
  const [editorOpen, setEditorOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (!note) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-6xl opacity-20">⌛</div>
          <p className="text-lg font-medium text-muted-foreground">Loading note...</p>
        </div>
      </div>
    );
  }

  const formattedCreatedDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(note.createdAt));

  const formattedUpdatedDate = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(note.updatedAt));

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto bg-background">
      <article className="mx-auto max-w-4xl px-6 py-12 lg:px-8">
        {/* Header */}
        <header className="mb-12 border-b-2 border-foreground/10 pb-8">
          <div className="mb-6 flex items-start justify-between">
            <button
              onClick={onClose}
              className="group flex items-center gap-2 rounded-lg p-2 transition-colors hover:bg-accent"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                className="text-muted-foreground transition-transform group-hover:-translate-x-1 group-hover:text-foreground"
              >
                <path
                  d="M12 4L6 10L12 16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
                Back
              </span>
            </button>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setEditorOpen(true)}
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
                title="Edit note"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteDialogOpen(true)}
                className="h-9 w-9 text-muted-foreground hover:text-destructive"
                title="Delete note"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
              <button
                onClick={() => togglePin({ noteId })}
                className={cn(
                  "rounded-full p-2.5 transition-all hover:bg-accent",
                  note.pinned && "bg-primary/10"
                )}
                aria-label={note.pinned ? "Unpin note" : "Pin note"}
              >
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill={note.pinned ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className={cn(
                    "transition-transform",
                    note.pinned ? "rotate-45 text-primary" : "text-muted-foreground"
                  )}
                >
                  <path d="M10 2.5L12.5 7.5H17.5L13.125 11.875L15 17.5L10 13.75L5 17.5L6.875 11.875L2.5 7.5H7.5L10 2.5Z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Title */}
          <h1 className="font-serif text-5xl font-bold leading-tight tracking-tight text-foreground">
            {note.title}
          </h1>

          {/* Metadata */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <path
                  d="M8 4V8L11 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              <time dateTime={new Date(note.createdAt).toISOString()}>
                {formattedCreatedDate}
              </time>
            </div>

            {note.createdAt !== note.updatedAt && (
              <>
                <span className="text-foreground/20">•</span>
                <div className="flex items-center gap-2">
                  <span>Updated {formattedUpdatedDate}</span>
                </div>
              </>
            )}
          </div>

          {/* Tags */}
          {note.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {note.tags.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="rounded-full">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </header>

        {/* Content */}
        <div className="prose prose-lg prose-neutral max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => (
                <h2 className="font-serif text-4xl font-bold tracking-tight">
                  {children}
                </h2>
              ),
              h2: ({ children }) => (
                <h3 className="font-serif text-3xl font-bold tracking-tight">
                  {children}
                </h3>
              ),
              h3: ({ children }) => (
                <h4 className="font-serif text-2xl font-semibold tracking-tight">
                  {children}
                </h4>
              ),
              p: ({ children }) => (
                <p className="leading-relaxed text-foreground/90">{children}</p>
              ),
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {children}
                </a>
              ),
              code: ({ className, children }) => {
                const isInline = !className;
                return isInline ? (
                  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground">
                    {children}
                  </code>
                ) : (
                  <code className={className}>{children}</code>
                );
              },
              pre: ({ children }) => (
                <pre className="overflow-x-auto rounded-xl border-2 border-foreground/10 bg-muted p-4 font-mono text-sm">
                  {children}
                </pre>
              ),
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-primary pl-6 italic text-muted-foreground">
                  {children}
                </blockquote>
              ),
              ul: ({ children }) => (
                <ul className="space-y-2 [&>li]:pl-2">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="space-y-2 [&>li]:pl-2">{children}</ol>
              ),
              hr: () => <hr className="my-8 border-t-2 border-foreground/10" />,
              table: ({ children }) => (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border-2 border-foreground/10">
                    {children}
                  </table>
                </div>
              ),
              th: ({ children }) => (
                <th className="border border-foreground/10 bg-muted px-4 py-2 text-left font-semibold">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="border border-foreground/10 px-4 py-2">
                  {children}
                </td>
              ),
            }}
          >
            {note.content}
          </ReactMarkdown>
        </div>

        {/* Footer metadata */}
        {note.metadata && (
          <footer className="mt-12 border-t-2 border-foreground/10 pt-8">
            <dl className="space-y-4 text-sm">
              {note.metadata.source && (
                <div>
                  <dt className="font-medium uppercase tracking-wider text-muted-foreground">
                    Source
                  </dt>
                  <dd className="mt-1 text-foreground">{note.metadata.source}</dd>
                </div>
              )}
              {note.metadata.context && (
                <div>
                  <dt className="font-medium uppercase tracking-wider text-muted-foreground">
                    Context
                  </dt>
                  <dd className="mt-1 text-foreground">{note.metadata.context}</dd>
                </div>
              )}
              {note.metadata.references && note.metadata.references.length > 0 && (
                <div>
                  <dt className="font-medium uppercase tracking-wider text-muted-foreground">
                    References
                  </dt>
                  <dd className="mt-1 space-y-1">
                    {note.metadata.references.map((ref: string, index: number) => (
                      <div key={index} className="text-foreground">
                        {ref}
                      </div>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </footer>
        )}
      </article>

      {/* Edit Note Dialog */}
      <NoteEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        noteId={noteId}
        onSuccess={() => {
          // Note will auto-refresh via Convex reactivity
        }}
      />

      {/* Delete Note Dialog */}
      <DeleteNoteDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        noteId={noteId}
        noteTitle={note.title}
        onSuccess={() => {
          onClose(); // Close the viewer after deletion
        }}
      />
    </div>
  );
}
