"use client";

import { User, Sparkles, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type EmbeddingStatus = "pending" | "processing" | "embedded" | "failed" | undefined;

interface UserAttributionBadgeProps {
  embeddingStatus?: EmbeddingStatus;
  compact?: boolean;
  className?: string;
}

export function UserAttributionBadge({
  embeddingStatus,
  compact = false,
  className,
}: UserAttributionBadgeProps) {
  const status = embeddingStatus || "pending";

  const statusConfig = {
    pending: {
      icon: Clock,
      label: "Queued",
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
      borderColor: "border-amber-200 dark:border-amber-800",
      description: "Waiting for vectorization",
    },
    processing: {
      icon: Sparkles,
      label: "Processing",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      borderColor: "border-blue-200 dark:border-blue-800",
      description: "Generating embeddings",
    },
    embedded: {
      icon: CheckCircle2,
      label: "Vectorized",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
      borderColor: "border-emerald-200 dark:border-emerald-800",
      description: "Available for AI context",
    },
    failed: {
      icon: AlertCircle,
      label: "Failed",
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950/20",
      borderColor: "border-red-200 dark:border-red-800",
      description: "Vectorization error",
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  if (compact) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono",
          config.bgColor,
          config.borderColor,
          config.color,
          className
        )}
      >
        <User className="w-3 h-3" />
        <span className="font-semibold">User</span>
        <div className="w-px h-3 bg-current opacity-30" />
        <StatusIcon className={cn("w-3 h-3", status === "processing" && "animate-spin")} />
        <span>{config.label}</span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border",
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      {/* User Icon */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
        <User className="w-4 h-4 text-primary" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-primary">
            User-Created Content
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          This note is marked as user-authored for AI agent attribution
        </p>
      </div>

      {/* Vectorization Status */}
      <div className={cn(
        "flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono",
        config.bgColor,
        config.borderColor,
        config.color
      )}>
        <StatusIcon className={cn("w-3 h-3", status === "processing" && "animate-spin")} />
        <span className="font-semibold">{config.label}</span>
      </div>
    </motion.div>
  );
}

interface VectorizationStatusIndicatorProps {
  status: EmbeddingStatus;
  className?: string;
}

export function VectorizationStatusIndicator({
  status = "pending",
  className,
}: VectorizationStatusIndicatorProps) {
  const statusConfig = {
    pending: {
      icon: Clock,
      label: "Queued for vectorization",
      color: "text-amber-600",
      bgColor: "bg-amber-50 dark:bg-amber-950/20",
      pulse: false,
    },
    processing: {
      icon: Sparkles,
      label: "Generating embeddings...",
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950/20",
      pulse: true,
    },
    embedded: {
      icon: CheckCircle2,
      label: "Vectorized • AI Context Ready",
      color: "text-emerald-600",
      bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
      pulse: false,
    },
    failed: {
      icon: AlertCircle,
      label: "Vectorization failed",
      color: "text-red-600",
      bgColor: "bg-red-50 dark:bg-red-950/20",
      pulse: false,
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1.5 rounded-full",
        config.bgColor,
        config.color,
        className
      )}
    >
      <div className="relative">
        <StatusIcon className={cn("w-4 h-4", status === "processing" && "animate-spin")} />
        {config.pulse && (
          <motion.div
            animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0"
          >
            <div className={cn("w-4 h-4 rounded-full", config.bgColor)} />
          </motion.div>
        )}
      </div>
      <span className="text-xs font-mono font-semibold">
        {config.label}
      </span>
    </motion.div>
  );
}
