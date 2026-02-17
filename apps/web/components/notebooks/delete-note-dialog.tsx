"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@repo/convex";
import { Id } from "@repo/convex";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteNoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  noteId: Id<"notes">;
  noteTitle: string;
  onSuccess?: () => void;
}

export function DeleteNoteDialog({
  open,
  onOpenChange,
  noteId,
  noteTitle,
  onSuccess,
}: DeleteNoteDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const deleteNote = useMutation(api.notebooks.deleteNote);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteNote({ noteId });
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to delete note:", error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">Delete Note</DialogTitle>
          <DialogDescription className="pt-2">
            Are you sure you want to delete <strong>&quot;{noteTitle}&quot;</strong>? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
