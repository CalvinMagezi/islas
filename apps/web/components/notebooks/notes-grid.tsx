"use client";

import { useMutation } from "convex/react";
import { api } from "@repo/convex";
import { Id } from "@repo/convex";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { CopyIdButton } from "./copy-id-button";
import { UserAttributionBadge } from "./user-attribution-badge";
import { motion } from "framer-motion";

interface Note {
  _id: Id<"notes">;
  title: string;
  content: string;
  tags: string[];
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  embeddingStatus?: "pending" | "processing" | "embedded" | "failed";
  embeddingError?: string;
}

interface NotesGridProps {
  notes: Note[];
  viewMode: "grid" | "list";
  onSelectNote: (id: Id<"notes">) => void;
  onCreateNote?: () => void;
}

export function NotesGrid({ notes, viewMode, onSelectNote, onCreateNote }: NotesGridProps) {
  const togglePin = useMutation(api.notebooks.togglePin);

  if (!notes || notes.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex min-h-[400px] items-center justify-center"
      >
        <div className="text-center max-w-md">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-6 text-8xl opacity-20"
          >
            📝
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl font-serif font-bold text-foreground mb-2"
          >
            No notes yet
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-sm text-muted-foreground mb-6"
          >
            Start capturing your thoughts and ideas. Your notes will be automatically vectorized for AI context.
          </motion.p>
          {onCreateNote && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onCreateNote}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-primary to-neon-cyan text-primary-foreground font-semibold shadow-lg hover:shadow-xl transition-all"
            >
              Create Your First Note
            </motion.button>
          )}
        </div>
      </motion.div>
    );
  }

  // Separate pinned and unpinned notes
  const pinnedNotes = notes.filter((note) => note.pinned);
  const unpinnedNotes = notes.filter((note) => !note.pinned);

  const renderNote = (note: Note, index: number) => {
    const excerpt = note.content
      .replace(/^#+\s/gm, "") // Remove markdown headers
      .replace(/\*\*/g, "") // Remove bold
      .replace(/\*/g, "") // Remove italic
      .substring(0, 150);

    const formattedDate = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(note.createdAt));

    return (
      <motion.article
        key={note._id}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.05, duration: 0.4 }}
        className={cn(
          "group relative overflow-hidden rounded-2xl border-2 transition-all duration-300",
          "bg-gradient-to-br from-card via-card to-surface/30",
          "border-border/50 hover:border-primary/30",
          "hover:shadow-2xl hover:shadow-primary/10",
          viewMode === "list" ? "flex gap-6" : ""
        )}
      >
        <button
          onClick={() => onSelectNote(note._id)}
          className="w-full p-6 text-left"
        >
          {/* User Attribution Badge */}
          <div className="mb-3">
            <UserAttributionBadge
              embeddingStatus={note.embeddingStatus}
              compact
            />
          </div>

          {/* Pin indicator */}
          {note.pinned && (
            <div className="mb-3 flex items-center gap-2 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-full w-fit">
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="currentColor"
                className="rotate-45 text-primary"
              >
                <path d="M6 0L7.5 4.5H12L8.5 7.5L10 12L6 9L2 12L3.5 7.5L0 4.5H4.5L6 0Z" />
              </svg>
              <span className="text-xs font-mono font-semibold text-primary">Pinned</span>
            </div>
          )}

          {/* Title */}
          <h3
            className={cn(
              "font-serif font-bold tracking-tight transition-colors",
              "text-foreground group-hover:text-primary",
              viewMode === "list" ? "text-xl" : "text-2xl md:text-3xl"
            )}
          >
            {note.title}
          </h3>

          {/* Date */}
          <div className="mt-2 flex items-center gap-2">
            <time className="text-xs font-mono text-muted-foreground" dateTime={new Date(note.createdAt).toISOString()}>
              {formattedDate}
            </time>
          </div>

          {/* Excerpt */}
          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
            {excerpt}...
          </p>

          {/* Tags */}
          {note.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {note.tags.map((tag, tagIndex) => (
                <motion.div
                  key={tag}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 + tagIndex * 0.03 }}
                >
                  <Badge
                    variant="secondary"
                    className="rounded-full text-xs font-mono bg-neon-amber/20 border border-neon-amber/30 hover:bg-neon-amber/30 transition-colors"
                  >
                    {tag}
                  </Badge>
                </motion.div>
              ))}
            </div>
          )}
        </button>

        {/* Action buttons */}
        <div className="absolute right-4 top-4 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
          {/* Copy ID button */}
          <div onClick={(e) => e.stopPropagation()}>
            <CopyIdButton id={note._id} label="Copy Note ID" variant="secondary" size="icon" />
          </div>
          
          {/* Pin toggle button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              togglePin({ noteId: note._id });
            }}
            className="rounded-full bg-background/80 p-2 backdrop-blur-sm transition-colors hover:bg-accent"
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill={note.pinned ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.5"
              className={cn(
                "transition-transform",
                note.pinned ? "rotate-45 text-primary" : "text-muted-foreground"
              )}
            >
              <path d="M8 2L10 6H14L10.5 9.5L12 14L8 11L4 14L5.5 9.5L2 6H6L8 2Z" />
            </svg>
          </button>
        </div>

        {/* Decorative corner accent */}
        <div className="absolute -bottom-4 -right-4 h-24 w-24 rounded-full bg-gradient-to-br from-primary/10 to-neon-cyan/10 blur-2xl transition-all duration-500 group-hover:from-primary/20 group-hover:to-neon-cyan/20" />
      </motion.article>
    );
  };

  return (
    <div className="space-y-8">
      {/* Pinned Notes Section */}
      {pinnedNotes.length > 0 && (
        <section>
          <div className="mb-4 flex items-center gap-3 border-b-2 border-foreground/10 pb-2">
            <h2 className="font-serif text-lg font-bold uppercase tracking-wider text-foreground">
              Pinned
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-foreground/10 to-transparent" />
          </div>
          <div
            className={cn(
              "gap-6",
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                : "flex flex-col"
            )}
          >
            {pinnedNotes.map((note, index) => renderNote(note, index))}
          </div>
        </section>
      )}

      {/* Regular Notes Section */}
      {unpinnedNotes.length > 0 && (
        <section>
          {pinnedNotes.length > 0 && (
            <div className="mb-4 flex items-center gap-3 border-b-2 border-foreground/10 pb-2">
              <h2 className="font-serif text-lg font-bold uppercase tracking-wider text-foreground">
                Notes
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-foreground/10 to-transparent" />
            </div>
          )}
          <div
            className={cn(
              "gap-6",
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                : "flex flex-col"
            )}
          >
            {unpinnedNotes.map((note, index) =>
              renderNote(note, pinnedNotes.length + index)
            )}
          </div>
        </section>
      )}
    </div>
  );
}
