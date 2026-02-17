"use client";

import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { useState, useMemo, useEffect } from "react";
import {
  Activity, Zap, Clock, CheckCircle2, XCircle,
  CircleStop, Wrench, Brain, Terminal, Cpu, BarChart3,
  Loader2, Sparkles, AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ResponsiveHeader } from "@/components/layout/responsive-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SettingsDialog } from "@/components/settings/settings-dialog";

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatCost(cost: number): string {
  if (cost === 0) return "$0.00";
  if (cost < 0.01) return "<$0.01";
  return `$${cost.toFixed(2)}`;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
  return tokens.toString();
}

export default function DashboardPage() {
  const [notificationPanelOpen, setNotificationPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [, setTick] = useState(0);

  // Re-render every 10s to update relative timestamps
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  const workerStatus = useQuery(api.agent.getWorkerStatus, {});
  const userJobs = useQuery(api.agent.listUserJobs, { limit: 100 });
  const skills = useQuery(api.agent.getSkills, {});

  // Worker stats (need workerId)
  const workerStats = useQuery(
    api.agent.getWorkerStats,
    workerStatus?.workerId ? { workerId: workerStatus.workerId } : "skip"
  );

  // Compute job status breakdown
  const jobBreakdown = useMemo(() => {
    if (!userJobs) return null;

    const breakdown = { pending: 0, running: 0, done: 0, failed: 0, cancelled: 0, waiting_for_user: 0 };
    let totalCost = 0;
    let totalTokens = 0;
    let totalToolCalls = 0;

    for (const job of userJobs) {
      const status = job.status as keyof typeof breakdown;
      if (status in breakdown) breakdown[status]++;
      if (job.stats) {
        totalCost += job.stats.cost;
        totalTokens += job.stats.tokens.total;
        totalToolCalls += job.stats.toolCalls;
      }
    }

    return { ...breakdown, totalCost, totalTokens, totalToolCalls, total: userJobs.length };
  }, [userJobs]);

  // Recent jobs (last 10)
  const recentJobs = useMemo(() => {
    if (!userJobs) return [];
    return userJobs.slice(0, 10);
  }, [userJobs]);

  const statusColor = workerStatus?.status === "online" ? "emerald" : workerStatus?.status === "busy" ? "amber" : "neutral";

  return (
    <div className="flex h-screen bg-background overflow-hidden flex-col">
      <ResponsiveHeader
        notificationPanelOpen={notificationPanelOpen}
        onToggleNotificationPanel={() => setNotificationPanelOpen(!notificationPanelOpen)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      <main className="flex-1 overflow-y-auto bg-dot-pattern scrollbar-thin">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 space-y-6">
          {/* Page Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold tracking-tight flex items-center gap-2.5">
                <BarChart3 className="h-5 w-5 text-primary/60" />
                Dashboard
              </h1>
              <p className="text-sm text-muted-foreground/50 mt-0.5">
                System health, job analytics, and agent overview
              </p>
            </div>
          </div>

          {/* Top Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Worker Status */}
            <Card className="glass p-4 space-y-3 animate-scale-in">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-display font-bold uppercase tracking-widest text-muted-foreground/50">
                  Agent
                </span>
                <div className="relative">
                  <span className={cn(
                    "h-2.5 w-2.5 rounded-full inline-block",
                    statusColor === "emerald" ? "bg-emerald-400" :
                    statusColor === "amber" ? "bg-amber-400" :
                    "bg-muted-foreground/30"
                  )} />
                  {workerStatus?.status === "online" && (
                    <span className="absolute inset-0 h-2.5 w-2.5 rounded-full bg-emerald-400 animate-heartbeat-ring" />
                  )}
                </div>
              </div>
              <div>
                <p className={cn(
                  "text-2xl font-bold tracking-tight capitalize",
                  statusColor === "emerald" ? "text-emerald-400" :
                  statusColor === "amber" ? "text-amber-400" :
                  "text-muted-foreground"
                )}>
                  {workerStatus?.status || "Offline"}
                </p>
                {workerStatus?.lastHeartbeat && (
                  <p className="text-[11px] text-muted-foreground/40 font-display mt-1">
                    Heartbeat {formatTimeAgo(workerStatus.lastHeartbeat)}
                  </p>
                )}
              </div>
            </Card>

            {/* Total Jobs */}
            <Card className="glass p-4 space-y-3 animate-scale-in" style={{ animationDelay: "50ms" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-display font-bold uppercase tracking-widest text-muted-foreground/50">
                  Jobs
                </span>
                <Terminal className="h-4 w-4 text-muted-foreground/30" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">
                  {jobBreakdown?.total ?? "—"}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {(jobBreakdown?.running ?? 0) > 0 && (
                    <span className="text-[10px] font-display text-neon-cyan flex items-center gap-0.5">
                      <Loader2 className="h-2.5 w-2.5 animate-spin" /> {jobBreakdown?.running} active
                    </span>
                  )}
                  {(jobBreakdown?.pending ?? 0) > 0 && (
                    <span className="text-[10px] font-display text-muted-foreground/50">
                      {jobBreakdown?.pending} queued
                    </span>
                  )}
                </div>
              </div>
            </Card>

            {/* Tokens Used */}
            <Card className="glass p-4 space-y-3 animate-scale-in" style={{ animationDelay: "100ms" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-display font-bold uppercase tracking-widest text-muted-foreground/50">
                  Tokens
                </span>
                <Zap className="h-4 w-4 text-muted-foreground/30" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight">
                  {jobBreakdown ? formatTokens(jobBreakdown.totalTokens) : "—"}
                </p>
                <p className="text-[11px] text-muted-foreground/40 font-display mt-1">
                  {jobBreakdown ? `${jobBreakdown.totalToolCalls} tool calls` : "—"}
                </p>
              </div>
            </Card>

            {/* Total Cost */}
            <Card className="glass p-4 space-y-3 animate-scale-in" style={{ animationDelay: "150ms" }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-display font-bold uppercase tracking-widest text-muted-foreground/50">
                  Cost
                </span>
                <Activity className="h-4 w-4 text-muted-foreground/30" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-gradient-neon">
                  {jobBreakdown ? formatCost(jobBreakdown.totalCost) : "—"}
                </p>
                {workerStats && workerStats.totalJobs > 0 && (
                  <p className="text-[11px] text-muted-foreground/40 font-display mt-1">
                    {Math.round(workerStats.successRate * 100)}% success rate
                  </p>
                )}
              </div>
            </Card>
          </div>

          {/* Main Content: Two Column */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left Column: Job Status + Recent Jobs */}
            <div className="lg:col-span-2 space-y-4">
              {/* Job Status Breakdown */}
              <Card className="glass p-5 space-y-4">
                <h3 className="text-xs font-display font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5" />
                  Job Status Breakdown
                </h3>

                {jobBreakdown && (
                  <div className="space-y-3">
                    {/* Visual bar */}
                    <div className="flex h-3 rounded-full overflow-hidden bg-muted/30">
                      {jobBreakdown.done > 0 && (
                        <div
                          className="bg-emerald-400/60 transition-all duration-500"
                          style={{ width: `${(jobBreakdown.done / jobBreakdown.total) * 100}%` }}
                        />
                      )}
                      {jobBreakdown.running > 0 && (
                        <div
                          className="bg-neon-cyan/60 animate-progress-stripe transition-all duration-500"
                          style={{ width: `${(jobBreakdown.running / jobBreakdown.total) * 100}%` }}
                        />
                      )}
                      {jobBreakdown.pending > 0 && (
                        <div
                          className="bg-muted-foreground/20 transition-all duration-500"
                          style={{ width: `${(jobBreakdown.pending / jobBreakdown.total) * 100}%` }}
                        />
                      )}
                      {jobBreakdown.failed > 0 && (
                        <div
                          className="bg-destructive/50 transition-all duration-500"
                          style={{ width: `${(jobBreakdown.failed / jobBreakdown.total) * 100}%` }}
                        />
                      )}
                      {jobBreakdown.cancelled > 0 && (
                        <div
                          className="bg-muted-foreground/15 transition-all duration-500"
                          style={{ width: `${(jobBreakdown.cancelled / jobBreakdown.total) * 100}%` }}
                        />
                      )}
                    </div>

                    {/* Legend */}
                    <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                      {[
                        { label: "Done", count: jobBreakdown.done, color: "bg-emerald-400" },
                        { label: "Running", count: jobBreakdown.running, color: "bg-neon-cyan" },
                        { label: "Pending", count: jobBreakdown.pending, color: "bg-muted-foreground/40" },
                        { label: "Failed", count: jobBreakdown.failed, color: "bg-destructive" },
                        { label: "Cancelled", count: jobBreakdown.cancelled, color: "bg-muted-foreground/25" },
                      ].filter(item => item.count > 0).map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <span className={cn("h-2 w-2 rounded-full", item.color)} />
                          <span className="text-[11px] font-display text-muted-foreground/60">
                            {item.label}
                          </span>
                          <span className="text-[11px] font-display font-bold text-foreground/80">
                            {item.count}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>

              {/* Recent Jobs Table */}
              <Card className="glass overflow-hidden">
                <div className="px-5 py-4 border-b border-border/30">
                  <h3 className="text-xs font-display font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5" />
                    Recent Jobs
                  </h3>
                </div>

                <div className="divide-y divide-border/20">
                  {recentJobs.map((job) => {
                    const statusMap: Record<string, { icon: typeof CheckCircle2; color: string }> = {
                      done: { icon: CheckCircle2, color: "text-emerald-400" },
                      running: { icon: Loader2, color: "text-neon-cyan" },
                      pending: { icon: Clock, color: "text-muted-foreground/50" },
                      failed: { icon: XCircle, color: "text-destructive" },
                      cancelled: { icon: CircleStop, color: "text-muted-foreground/40" },
                      waiting_for_user: { icon: AlertTriangle, color: "text-neon-amber" },
                    };
                    const { icon: StatusIcon, color } = statusMap[job.status] || statusMap.pending;

                    return (
                      <div key={job._id} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/10 transition-colors">
                        <StatusIcon className={cn("h-3.5 w-3.5 shrink-0", color, job.status === "running" && "animate-spin")} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm truncate text-foreground/80">
                            {job.instruction}
                          </p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          {job.stats && (
                            <span className="text-[10px] font-display text-muted-foreground/40">
                              {formatCost(job.stats.cost)}
                            </span>
                          )}
                          {job.securityProfile && job.securityProfile !== "standard" && (
                            <span className={cn(
                              "text-[9px] font-display uppercase tracking-wider px-1.5 py-0.5 rounded",
                              job.securityProfile === "admin" ? "bg-destructive/10 text-destructive" :
                              job.securityProfile === "minimal" ? "bg-blue-500/10 text-blue-400" :
                              "bg-amber-500/10 text-amber-400"
                            )}>
                              {job.securityProfile}
                            </span>
                          )}
                          <span className="text-[10px] font-display text-muted-foreground/30 w-16 text-right">
                            {formatTimeAgo(job.createdAt)}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {recentJobs.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 gap-2">
                      <Terminal className="h-8 w-8 text-muted-foreground/15" />
                      <p className="text-[11px] font-display text-muted-foreground/30">No jobs yet</p>
                    </div>
                  )}
                </div>
              </Card>
            </div>

            {/* Right Column: Worker Details + Skills */}
            <div className="space-y-4">
              {/* Worker Detail Card */}
              <Card className="glass p-5 space-y-4">
                <h3 className="text-xs font-display font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-2">
                  <Cpu className="h-3.5 w-3.5" />
                  Worker
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground/50">Status</span>
                    <span className={cn(
                      "text-[11px] font-display font-bold uppercase tracking-wider",
                      statusColor === "emerald" ? "text-emerald-400" :
                      statusColor === "amber" ? "text-amber-400" :
                      "text-muted-foreground/50"
                    )}>
                      {workerStatus?.status || "offline"}
                    </span>
                  </div>

                  {workerStatus?.workerId && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground/50">Worker ID</span>
                      <span className="text-[10px] font-mono text-muted-foreground/40 truncate max-w-[150px]">
                        {workerStatus.workerId}
                      </span>
                    </div>
                  )}

                  {workerStatus?.metadata?.folderName && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground/50">Directory</span>
                      <span className="text-[10px] font-mono text-muted-foreground/40 truncate max-w-[150px]">
                        {workerStatus.metadata.folderName}
                      </span>
                    </div>
                  )}

                  {workerStatus?.lastHeartbeat && (
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground/50">Heartbeat</span>
                      <span className="text-[10px] font-display text-muted-foreground/40">
                        {formatTimeAgo(workerStatus.lastHeartbeat)}
                      </span>
                    </div>
                  )}

                  {workerStats && (
                    <>
                      <div className="h-px bg-border/30 my-1" />
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground/50">Success Rate</span>
                        <span className={cn(
                          "text-[11px] font-display font-bold",
                          workerStats.successRate >= 0.9 ? "text-emerald-400" :
                          workerStats.successRate >= 0.7 ? "text-amber-400" :
                          "text-destructive"
                        )}>
                          {Math.round(workerStats.successRate * 100)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground/50">Total Cost</span>
                        <span className="text-[11px] font-display text-foreground/70">
                          {formatCost(workerStats.totalCost)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </Card>

              {/* Skills Registry */}
              <Card className="glass p-5 space-y-4">
                <h3 className="text-xs font-display font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Skills
                  {skills && (
                    <span className="text-[10px] font-display text-muted-foreground/30 ml-auto">
                      {skills.length}
                    </span>
                  )}
                </h3>

                <div className="space-y-1.5">
                  {skills?.map((skill) => (
                    <div key={skill._id} className="flex items-start gap-2 py-1.5">
                      <Wrench className="h-3 w-3 text-muted-foreground/30 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[12px] font-medium text-foreground/80 truncate">
                          {skill.name}
                        </p>
                        {skill.description && (
                          <p className="text-[10px] text-muted-foreground/40 truncate">
                            {skill.description}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {(!skills || skills.length === 0) && (
                    <p className="text-[11px] text-muted-foreground/30 font-display py-4 text-center">
                      No skills registered
                    </p>
                  )}
                </div>
              </Card>

              {/* Quick Info */}
              <Card className="glass p-5 space-y-3">
                <h3 className="text-xs font-display font-bold uppercase tracking-widest text-muted-foreground/50 flex items-center gap-2">
                  <Brain className="h-3.5 w-3.5" />
                  Quick Stats
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 rounded-lg bg-muted/15">
                    <p className="text-xl font-bold text-foreground/80">
                      {jobBreakdown?.done ?? 0}
                    </p>
                    <p className="text-[9px] font-display text-muted-foreground/40 uppercase tracking-widest mt-0.5">
                      Completed
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/15">
                    <p className="text-xl font-bold text-foreground/80">
                      {jobBreakdown?.failed ?? 0}
                    </p>
                    <p className="text-[9px] font-display text-muted-foreground/40 uppercase tracking-widest mt-0.5">
                      Failed
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/15">
                    <p className="text-xl font-bold text-foreground/80">
                      {skills?.length ?? 0}
                    </p>
                    <p className="text-[9px] font-display text-muted-foreground/40 uppercase tracking-widest mt-0.5">
                      Skills
                    </p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/15">
                    <p className="text-xl font-bold text-foreground/80">
                      {jobBreakdown ? formatTokens(jobBreakdown.totalTokens) : "0"}
                    </p>
                    <p className="text-[9px] font-display text-muted-foreground/40 uppercase tracking-widest mt-0.5">
                      Tokens
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>

      <MobileBottomNav
        _onToggleHistory={() => {}}
        onOpenSettings={() => setSettingsOpen(true)}
        _isHistoryOpen={false}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}
