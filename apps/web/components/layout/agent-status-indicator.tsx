"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function AgentStatusIndicator() {
  const workerStatus = useQuery(api.agent.getWorkerStatus);
  const pendingApprovals = useQuery(api.approvals.pendingApprovalCount);

  const status = workerStatus?.status ?? "offline";
  const lastHeartbeat = workerStatus?.lastHeartbeat;

  const statusConfig: Record<string, { color: string; label: string; pulse: boolean }> = {
    online: { color: "bg-emerald-500", label: "Online", pulse: true },
    busy: { color: "bg-amber-500", label: "Busy", pulse: true },
    offline: { color: "bg-neutral-500", label: "Offline", pulse: false },
  };

  const config = statusConfig[status] || statusConfig.offline;

  const timeAgo = lastHeartbeat
    ? formatTimeAgo(lastHeartbeat)
    : "never";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-muted/20 border border-border/30 cursor-default">
            <span className="relative flex h-2 w-2">
              {config.pulse && (
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full rounded-full animate-heartbeat-ring",
                    config.color,
                  )}
                />
              )}
              <span
                className={cn(
                  "relative inline-flex rounded-full h-2 w-2",
                  config.color,
                )}
              />
            </span>
            <span className="text-[10px] font-display font-bold uppercase tracking-wider text-muted-foreground/60 hidden sm:inline">
              AGENT
            </span>
            {(pendingApprovals ?? 0) > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-amber px-1 text-[9px] font-bold text-black">
                {pendingApprovals! > 99 ? "99+" : pendingApprovals}
              </span>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs glass">
          <div className="space-y-1">
            <div className="font-display text-[11px] font-bold">Islas Agent: {config.label}</div>
            <div className="text-muted-foreground text-[10px]">Last heartbeat: {timeAgo}</div>
            {workerStatus?.workerId && (
              <div className="text-muted-foreground font-mono text-[9px]">
                {workerStatus.workerId}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
