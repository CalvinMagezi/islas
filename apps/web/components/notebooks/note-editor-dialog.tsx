"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Id, Doc } from "@repo/convex";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";

interface NoteEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId?: Id<"notes">;
  notebookId?: Id<"notebooks">;
  onSuccess?: () => void;
}

export function NoteEditorDialog({
  open,
  onOpenChange,
  noteId,
  notebookId,
  onSuccess,
}: NoteEditorDialogProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);

  const note = useQuery(
    api.notebooks.getNote,
    noteId ? { noteId } : "skip"
  );
  const notebooks = useQuery(api.notebooks.list, {});
  const [selectedNotebookId, setSelectedNotebookId] = useState<Id<"notebooks"> | null>(
    notebookId || null
  );

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
    const tag = tagInput.trim();
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-2xl">
            {isEditing ? "Edit Note" : "New Note"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Notebook Selector (only for new notes) */}
          {!isEditing && notebooks && notebooks.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="notebook">Notebook</Label>
              <select
                id="notebook"
                value={selectedNotebookId || ""}
                onChange={(e) => setSelectedNotebookId(e.target.value as Id<"notebooks">)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {notebooks.map((nb: Doc<"notebooks">) => (
                  <option key={nb._id} value={nb._id}>
                    {nb.icon} {nb.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter note title..."
              className="font-serif text-lg"
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note in markdown..."
              className="min-h-[300px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Supports Markdown formatting
            </p>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
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
                placeholder="Add a tag..."
                className="flex-1"
              />
              <Button type="button" onClick={handleAddTag} variant="outline">
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge
                    key={tag}
                    variant="secondary"
                    className="gap-1 rounded-full"
                  >
                    {tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="rounded-full hover:bg-background/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Pin checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="pinned"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor="pinned" className="cursor-pointer">
              Pin this note
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!title.trim() || !content.trim() || saving}
          >
            {saving ? "Saving..." : isEditing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
