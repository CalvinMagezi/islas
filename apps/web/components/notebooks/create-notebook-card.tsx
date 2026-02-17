"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@repo/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BookOpen, Sparkles, X, Check } from "lucide-react";
import { motion } from "framer-motion";

const NOTEBOOK_TYPES = [
  { value: "personal", label: "Personal", icon: "📔", description: "Your private notes" },
  { value: "project", label: "Project", icon: "🚀", description: "Project documentation" },
  { value: "digest", label: "Digest", icon: "📰", description: "Curated summaries" },
] as const;

const COLORS = [
  { name: "Cyan", value: "oklch(0.8 0.15 195)" },
  { name: "Blue", value: "oklch(0.55 0.2 255)" },
  { name: "Purple", value: "oklch(0.6 0.22 295)" },
  { name: "Amber", value: "oklch(0.8 0.16 80)" },
  { name: "Teal", value: "oklch(0.65 0.17 195)" },
  { name: "Violet", value: "oklch(0.7 0.15 295)" },
];

interface CreateNotebookCardProps {
  onClose: () => void;
  onSuccess?: () => void;
}

export function CreateNotebookCard({ onClose, onSuccess }: CreateNotebookCardProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<"personal" | "project" | "digest">("personal");
  const [color, setColor] = useState(COLORS[0].value);
  const [icon, setIcon] = useState("📔");
  const [saving, setSaving] = useState(false);

  const createNotebook = useMutation(api.notebooks.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await createNotebook({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
        color,
        icon,
        tags: [],
      });
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error("Failed to create notebook:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 20 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl bg-background rounded-2xl shadow-2xl border-2 border-border overflow-hidden"
      >
        {/* Header with gradient accent */}
        <div className="relative px-8 pt-8 pb-6 bg-gradient-to-br from-primary/10 to-transparent">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 rounded-lg hover:bg-black/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h2 className="font-serif text-4xl font-bold text-foreground mb-2">
              New Notebook
            </h2>
            <p className="text-muted-foreground font-mono text-sm">
              Create a space for your thoughts
            </p>
          </motion.div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-6">
          {/* Name & Icon */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <Label htmlFor="name" className="text-sm font-semibold uppercase tracking-wide">
              Notebook Name
            </Label>
            <div className="flex gap-3">
              <Input
                id="icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                className="w-16 text-2xl text-center"
                maxLength={2}
              />
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Brilliant Ideas"
                className="flex-1 text-lg font-medium"
                autoFocus
              />
            </div>
          </motion.div>

          {/* Description */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="space-y-3"
          >
            <Label htmlFor="description" className="text-sm font-semibold uppercase tracking-wide">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What will you capture here?"
              className="min-h-[80px] resize-none"
            />
          </motion.div>

          {/* Type Selection */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="space-y-3"
          >
            <Label className="text-sm font-semibold uppercase tracking-wide">
              Type
            </Label>
            <div className="grid grid-cols-3 gap-3">
              {NOTEBOOK_TYPES.map((t, index) => (
                <motion.button
                  key={t.value}
                  type="button"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4 + index * 0.05 }}
                  onClick={() => {
                    setType(t.value);
                    setIcon(t.icon);
                  }}
                  className={`
                    relative p-4 rounded-xl border-2 transition-all duration-200
                    ${type === t.value
                      ? 'border-primary bg-primary/5 shadow-lg'
                      : 'border-border hover:border-primary/50'
                    }
                  `}
                >
                  <div className="text-3xl mb-2">{t.icon}</div>
                  <div className="font-semibold text-sm">{t.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{t.description}</div>
                  {type === t.value && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                    >
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Color Selection */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-3"
          >
            <Label className="text-sm font-semibold uppercase tracking-wide">
              Accent Color
            </Label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c, index) => (
                <motion.button
                  key={c.value}
                  type="button"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + index * 0.03 }}
                  onClick={() => setColor(c.value)}
                  className={`
                    relative w-12 h-12 rounded-full transition-all duration-200
                    ${color === c.value ? 'ring-4 ring-offset-2 ring-primary' : 'hover:scale-110'}
                  `}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                >
                  {color === c.value && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute inset-0 flex items-center justify-center"
                    >
                      <Check className="w-5 h-5 text-primary-foreground drop-shadow-lg" />
                    </motion.div>
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex gap-3 pt-4"
          >
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
              className="flex-1 h-12 font-semibold"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || saving}
              className="flex-1 h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {saving ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                  </motion.div>
                  Creating...
                </>
              ) : (
                <>
                  <BookOpen className="w-5 h-5 mr-2" />
                  Create Notebook
                </>
              )}
            </Button>
          </motion.div>
        </form>

        {/* User Attribution Banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="px-8 pb-6"
        >
          <div className="flex items-center gap-2 p-3 bg-neon-amber/10 border border-neon-amber/30 rounded-lg">
            <div className="w-2 h-2 rounded-full bg-neon-amber animate-pulse" />
            <p className="text-xs font-mono text-muted-foreground">
              <span className="font-semibold text-foreground">Agent Context:</span> This notebook will be marked as user-created for AI attribution
            </p>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
