"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Zap, DollarSign, Activity, BarChart3 } from "lucide-react";

const PERIODS = [
  { key: "today", label: "Today", ms: 24 * 60 * 60 * 1000 },
  { key: "week", label: "7 Days", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "month", label: "30 Days", ms: 30 * 24 * 60 * 60 * 1000 },
  { key: "all", label: "All Time", ms: undefined },
] as const;

export function UsageDashboard() {
  const [periodIdx, setPeriodIdx] = useState(0);
  const period = PERIODS[periodIdx];

  const stats = useQuery(api.functions.usage.getStats, {
    periodMs: period.ms,
  });

  const isLoading = stats === undefined;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-neon-purple" />
        <h3 className="text-sm font-semibold">Usage & Costs</h3>
      </div>

      {/* Period selector */}
      <div className="flex gap-1 glass rounded-lg p-1">
        {PERIODS.map((p, i) => (
          <button
            key={p.key}
            onClick={() => setPeriodIdx(i)}
            className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition-all ${
              i === periodIdx
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-primary" />
        </div>
      ) : (
        <>
          {/* Hero stats */}
          <div className="grid grid-cols-2 gap-2">
            <StatCard
              icon={DollarSign}
              label="Total Cost"
              value={formatCost(stats.cost)}
              color="text-neon-cyan"
              glow="neon-glow-cyan"
            />
            <StatCard
              icon={Activity}
              label="Requests"
              value={String(stats.requestCount)}
              color="text-neon-purple"
              glow="neon-glow-purple"
            />
            <StatCard
              icon={Zap}
              label="Input Tokens"
              value={formatTokens(stats.promptTokens)}
              color="text-neon-blue"
            />
            <StatCard
              icon={Zap}
              label="Output Tokens"
              value={formatTokens(stats.completionTokens)}
              color="text-chart-4"
            />
          </div>

          {/* Total tokens summary */}
          <div className="glass rounded-xl px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium">
                Total Tokens
              </span>
              <span className="text-lg font-bold text-gradient-neon">
                {formatTokens(stats.totalTokens)}
              </span>
            </div>
            {/* Token ratio bar */}
            {stats.totalTokens > 0 && (
              <div className="mt-2 flex h-2 rounded-full overflow-hidden bg-black/20">
                <div
                  className="bg-neon-blue transition-all duration-500"
                  style={{
                    width: `${(stats.promptTokens / stats.totalTokens) * 100}%`,
                  }}
                  title={`Input: ${formatTokens(stats.promptTokens)}`}
                />
                <div
                  className="bg-neon-purple transition-all duration-500"
                  style={{
                    width: `${(stats.completionTokens / stats.totalTokens) * 100}%`,
                  }}
                  title={`Output: ${formatTokens(stats.completionTokens)}`}
                />
              </div>
            )}
            {stats.totalTokens > 0 && (
              <div className="mt-1.5 flex justify-between text-[10px] text-muted-foreground/50">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-neon-blue" />
                  Input ({Math.round((stats.promptTokens / stats.totalTokens) * 100)}%)
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-neon-purple" />
                  Output ({Math.round((stats.completionTokens / stats.totalTokens) * 100)}%)
                </span>
              </div>
            )}
          </div>

          {/* Model breakdown */}
          {stats.breakdown.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium px-1">
                By Model
              </p>
              <div className="space-y-1.5">
                {[...stats.breakdown]
                  .sort((a, b) => b.cost - a.cost)
                  .map((item) => {
                    const maxCost = Math.max(
                      ...stats.breakdown.map((b) => b.cost),
                    );
                    const barWidth =
                      maxCost > 0
                        ? Math.max(4, (item.cost / maxCost) * 100)
                        : 0;

                    return (
                      <div key={item.model} className="glass rounded-lg p-3">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-mono text-muted-foreground/70 truncate max-w-[55%]">
                            {shortModelName(item.model)}
                          </span>
                          <span className="text-xs font-semibold text-primary">
                            {formatCost(item.cost)}
                          </span>
                        </div>
                        {/* Cost proportion bar */}
                        <div className="h-1.5 rounded-full overflow-hidden bg-black/20">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-purple transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-muted-foreground/40">
                            {formatTokens(item.tokens)} tokens
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {stats.requestCount === 0 && (
            <div className="glass rounded-xl p-8 text-center">
              <BarChart3 className="mx-auto mb-2 h-8 w-8 text-muted-foreground/20" />
              <p className="text-sm text-muted-foreground/50">
                No usage data for this period
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  glow,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  color: string;
  glow?: string;
}) {
  return (
    <div className={`glass rounded-xl p-3 ${glow ?? ""}`}>
      <Icon className={`h-3.5 w-3.5 ${color} mb-1.5`} />
      <p className="text-lg font-bold tracking-tight">{value}</p>
      <p className="text-[10px] text-muted-foreground/60">{label}</p>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(cost: number): string {
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(3)}`;
  if (cost >= 0.001) return `$${cost.toFixed(4)}`;
  if (cost === 0) return "$0.00";
  return `$${cost.toFixed(5)}`;
}

/** Shorten long model identifiers for display */
function shortModelName(model: string): string {
  // Strip common prefixes like "openrouter/auto" or "anthropic/"
  const parts = model.split("/");
  return parts[parts.length - 1] || model;
}
