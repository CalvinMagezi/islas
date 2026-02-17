"use client";

import { useState } from "react";
import { Plus, BookOpen, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface QuickCreateFabProps {
  onCreateNotebook: () => void;
  onCreateNote: () => void;
}

export function QuickCreateFab({ onCreateNotebook, onCreateNote }: QuickCreateFabProps) {
  const [isOpen, setIsOpen] = useState(false);

  const actions = [
    {
      label: "New Note",
      icon: FileText,
      onClick: () => {
        onCreateNote();
        setIsOpen(false);
      },
      color: "var(--primary)",
    },
    {
      label: "New Notebook",
      icon: BookOpen,
      onClick: () => {
        onCreateNotebook();
        setIsOpen(false);
      },
      color: "var(--neon-cyan)",
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />
        )}
      </AnimatePresence>

      {/* Action Buttons */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        <AnimatePresence>
          {isOpen && actions.map((action, index) => (
            <motion.button
              key={action.label}
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 20 }}
              transition={{ delay: index * 0.05 }}
              onClick={action.onClick}
              className="flex items-center gap-3 group"
            >
              {/* Label */}
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: index * 0.05 + 0.1 }}
                className="px-4 py-2 bg-background border-2 border-border rounded-full shadow-lg font-semibold text-sm whitespace-nowrap"
              >
                {action.label}
              </motion.span>

              {/* Button */}
              <div
                className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all group-hover:scale-110"
                style={{
                  backgroundColor: action.color,
                }}
              >
                <action.icon className="w-6 h-6 text-primary-foreground" />
              </div>
            </motion.button>
          ))}
        </AnimatePresence>

        {/* Main FAB */}
        <motion.button
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all",
            "bg-gradient-to-br from-primary to-neon-cyan",
            "hover:shadow-[0_8px_30px_oklch(0.55_0.2_230/0.5)]",
            "active:scale-95"
          )}
          whileTap={{ scale: 0.9 }}
        >
          <motion.div
            animate={{ rotate: isOpen ? 45 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <Plus className="w-8 h-8 text-primary-foreground" strokeWidth={2.5} />
          </motion.div>
        </motion.button>

        {/* Mobile hint (only shown on small screens) */}
        <AnimatePresence>
          {!isOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -top-16 right-0 px-4 py-2 bg-primary text-primary-foreground text-xs font-mono rounded-lg shadow-lg whitespace-nowrap md:hidden"
            >
              Quick Create
              <div className="absolute -bottom-2 right-4 w-3 h-3 bg-primary rotate-45" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}
