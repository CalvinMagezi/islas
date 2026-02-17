"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Id, Doc } from "@repo/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription
} from "@/components/ui/sheet";
import {
  X,
  Tag,
  Pin,
  Sparkles,
  CheckCircle2,
  User,
  Hash
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface CreateNoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId?: Id<"notes">;
  notebookId?: Id<"notebooks">;
  onSuccess?: () => void;
}

export function CreateNoteSheet({
  open,
  onOpenChange,
  noteId,
  notebookId,
  onSuccess,
}: CreateNoteSheetProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedNotebookId, setSelectedNotebookId] = useState<Id<"notebooks"> | null>(
    notebookId || null
  );

  const note = useQuery(
    api.notebooks.getNote,
    noteId ? { noteId } : "skip"
  );
  const notebooks = useQuery(api.notebooks.list, {});

  const createNote = useMutation(api.notebooks.createNote);
  const updateNote = useMutation(api.notebooks.updateNote);

  const isEditing = !!noteId;

  // Load note data when editing
  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setTags(note.tags);
      setPinned(note.pinned);
      setSelectedNotebookId(note.notebookId);
    }
  }, [note]);

  // Set default notebook when creating
  useEffect(() => {
    if (!isEditing && notebooks && notebooks.length > 0 && !selectedNotebookId) {
      setSelectedNotebookId(notebooks[0]._id);
    }
  }, [notebooks, isEditing, selectedNotebookId]);

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;

    setSaving(true);
    try {
      if (isEditing && noteId) {
        await updateNote({
          noteId,
          title: title.trim(),
          content: content.trim(),
          tags,
          pinned,
        });
      } else {
        if (!selectedNotebookId) {
          throw new Error("Please select a notebook");
        }
        await createNote({
          notebookId: selectedNotebookId,
          title: title.trim(),
          content: content.trim(),
          tags,
          pinned,
        });
      }
      onSuccess?.();
      handleClose();
    } catch (error) {
      console.error("Failed to save note:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setTitle("");
    setContent("");
    setTags([]);
    setTagInput("");
    setPinned(false);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col bg-gradient-to-br from-background to-surface"
      >
        {/* Header */}
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/50 bg-background/50 backdrop-blur-sm">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <SheetTitle className="font-serif text-3xl font-bold text-foreground">
                {isEditing ? "Edit Note" : "New Note"}
              </SheetTitle>
              <SheetDescription className="font-mono text-sm text-muted-foreground">
                {isEditing ? "Update your thoughts" : "Capture your ideas"}
              </SheetDescription>
            </div>
          </div>

          {/* User Attribution Badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="mt-4 flex items-center gap-2 p-2.5 bg-primary/10 border border-primary/20 rounded-lg"
          >
            <User className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono font-medium text-primary">
              User-Created Content
            </span>
            <div className="ml-auto flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-mono text-muted-foreground">
                Auto-vectorized
              </span>
            </div>
          </motion.div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Notebook Selector */}
          {!isEditing && notebooks && notebooks.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="space-y-2"
            >
              <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Notebook
              </Label>
              <div className="relative">
                <select
                  value={selectedNotebookId || ""}
                  onChange={(e) => setSelectedNotebookId(e.target.value as Id<"notebooks">)}
                  className="w-full px-4 py-3 pr-10 bg-background border-2 border-border rounded-xl font-medium appearance-none cursor-pointer hover:border-[#8B2635]/50 transition-colors"
                >
                  {notebooks.map((nb: Doc<"notebooks">) => (
                    <option key={nb._id} value={nb._id}>
                      {nb.icon} {nb.name}
                    </option>
                  ))}
                </select>
                <Hash className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
              </div>
            </motion.div>
          )}

          {/* Title */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-2"
          >
            <Label htmlFor="title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give your note a title..."
              className="text-xl font-serif font-bold border-2 h-14 rounded-xl"
              autoFocus
            />
          </motion.div>

          {/* Content */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-2"
          >
            <Label htmlFor="content" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Content
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Start writing... (Markdown supported)"
              className="min-h-[280px] font-mono text-sm leading-relaxed resize-none border-2 rounded-xl"
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" />
              Markdown formatting supported • Will be vectorized for AI context
            </p>
          </motion.div>

          {/* Tags */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <Label htmlFor="tags" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tags
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="tags"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Add tags..."
                  className="pl-9 border-2 rounded-xl"
                />
                <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              </div>
              <Button
                type="button"
                onClick={handleAddTag}
                variant="outline"
                className="px-6 border-2 rounded-xl"
              >
                Add
              </Button>
            </div>
            <AnimatePresence mode="popLayout">
              {tags.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap gap-2"
                >
                  {tags.map((tag, index) => (
                    <motion.div
                      key={tag}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <Badge
                        variant="secondary"
                        className="pl-3 pr-2 py-1.5 gap-2 rounded-full bg-neon-amber/20 border border-neon-amber/30 hover:bg-neon-amber/30"
                      >
                        <span className="font-mono text-xs">{tag}</span>
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="p-0.5 rounded-full hover:bg-background/50 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Pin Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <button
              type="button"
              onClick={() => setPinned(!pinned)}
              className={cn(
                "flex items-center gap-3 w-full p-4 rounded-xl border-2 transition-all",
                pinned
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/30"
              )}
            >
              <div className={cn(
                "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
                pinned ? "border-primary bg-primary" : "border-border"
              )}>
                <AnimatePresence>
                  {pinned && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-white" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex-1 text-left">
                <div className="font-semibold text-sm flex items-center gap-2">
                  <Pin className={cn("w-4 h-4", pinned && "text-primary")} />
                  Pin this note
                </div>
                <div className="text-xs text-muted-foreground">
                  Pinned notes appear first and are prioritized for AI context
                </div>
              </div>
            </button>
          </motion.div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/50 bg-background/80 backdrop-blur-sm space-y-3">
          {/* Vectorization Info */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono">Vectorization Status:</span>
            </div>
            <span className="font-medium text-foreground">
              Will be embedded after save
            </span>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="flex gap-3"
          >
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saving}
              className="flex-1 h-12 border-2 rounded-xl font-semibold"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim() || !content.trim() || saving}
              className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl font-semibold"
            >
              {saving ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                  </motion.div>
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  {isEditing ? "Update" : "Create"} Note
                </>
              )}
            </Button>
          </motion.div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
