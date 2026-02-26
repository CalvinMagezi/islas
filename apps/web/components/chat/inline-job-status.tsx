"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Id } from "@repo/convex";
import { cn } from "@/lib/utils";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  Download,
} from "lucide-react";

interface InlineJobStatusProps {
  jobId: Id<"agentJobs">;
  className?: string;
}

export function InlineJobStatus({ jobId, className }: InlineJobStatusProps) {
  const job = useQuery(api.agent.getJob, { jobId });
  const files = useQuery(
    api.agent.listJobFiles,
    job?.status === "done" ? { jobId } : "skip"
  );

  if (!job) {
    return null;
  }

  const statusConfig = {
    pending: {
      icon: Clock,
      label: "Job queued...",
      color: "text-muted-foreground",
      bgColor: "bg-muted/30",
      borderColor: "border-muted",
    },
    running: {
      icon: Loader2,
      label: "Executing...",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/30",
    },
    waiting_for_user: {
      icon: MessageSquare,
      label: "Waiting for your response",
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      borderColor: "border-amber-500/30",
    },
    done: {
      icon: CheckCircle2,
      label: "Completed",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/30",
    },
    failed: {
      icon: XCircle,
      label: "Failed",
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/30",
    },
    cancelled: {
      icon: XCircle,
      label: "Cancelled",
      color: "text-neutral-500",
      bgColor: "bg-neutral-500/10",
      borderColor: "border-neutral-500/30",
    },
  };

  const config = statusConfig[job.status as keyof typeof statusConfig] || statusConfig.pending;
  const Icon = config.icon;

  // Get the most recent agent response for preview
  const streamingPreview = job.streamingText
    ? job.streamingText.slice(0, 100) + (job.streamingText.length > 100 ? "..." : "")
    : null;

  // For completed jobs, show result summary
  const resultSummary = job.status === "done" && job.result
    ? typeof job.result === "string"
      ? job.result.slice(0, 100) + (job.result.length > 100 ? "..." : "")
      : "Task completed successfully"
    : null;

  // For failed jobs, show error
  const errorMessage = job.status === "failed" && job.result
    ? typeof job.result === "string"
      ? job.result.slice(0, 100) + (job.result.length > 100 ? "..." : "")
      : "Task failed"
    : null;

  return (
    <div
      className={cn(
        "group relative rounded-lg border p-3 transition-all",
        config.bgColor,
        config.borderColor,
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Status Icon */}
        <div className={cn("flex-shrink-0 mt-0.5", config.color)}>
          <Icon className={cn("h-4 w-4", job.status === "running" && "animate-spin")} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-medium", config.color)}>
              {config.label}
            </span>
            {job.workerId && (
              <span className="text-[10px] font-mono text-muted-foreground/60">
                {job.workerId.slice(0, 8)}
              </span>
            )}
          </div>

          {/* Show streaming preview for running jobs */}
          {job.status === "running" && streamingPreview && (
            <p className="text-xs text-muted-foreground line-clamp-2 font-mono">
              {streamingPreview}
            </p>
          )}

          {/* Show result for completed jobs */}
          {job.status === "done" && resultSummary && (
            <p className="text-xs text-muted-foreground/80 line-clamp-2">
              {resultSummary}
            </p>
          )}

          {/* Show error for failed jobs */}
          {job.status === "failed" && errorMessage && (
            <p className="text-xs text-red-500/80 line-clamp-2 font-mono">
              {errorMessage}
            </p>
          )}

        </div>
      </div>

      {/* Stats badge for completed jobs */}
      {job.status === "done" && job.stats && (
        <div className="mt-2 pt-2 border-t border-border/30 flex items-center gap-3 text-[10px] text-muted-foreground/60">
          <span>{job.stats.toolCalls} tool calls</span>
          <span className="text-muted-foreground/30">•</span>
          <span>{job.stats.tokens.total.toLocaleString()} tokens</span>
          {job.stats.cost > 0 && (
            <>
              <span className="text-muted-foreground/30">•</span>
              <span>${job.stats.cost.toFixed(4)}</span>
            </>
          )}
        </div>
      )}

      {/* Published files for completed jobs */}
      {job.status === "done" && files && files.length > 0 && (
        <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
          {files.map((file) => (
            <a
              key={file._id}
              href={`/api/workspace/${file.path}`}
              download={file.name}
              className="flex items-center gap-2 text-xs text-emerald-500 hover:text-emerald-400 transition-colors"
            >
              <Download className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{file.name}</span>
              <span className="text-muted-foreground/50 flex-shrink-0">
                {(file.size / 1024).toFixed(1)} KB
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
