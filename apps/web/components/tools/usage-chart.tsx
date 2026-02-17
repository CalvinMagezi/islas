"use client";

import { Zap, DollarSign } from "lucide-react";
import type { ToolResultProps } from "@/components/chat/tool-result-part";

export function UsageChart({ data, onAction }: ToolResultProps) {
  const { 
    totalTokens = 0, 
    promptTokens = 0, 
    completionTokens = 0, 
    cost = 0, 
    requestCount = 0, 
    breakdown = [], 
    period = "today" 
  } = (data as { 
    totalTokens?: number; 
    promptTokens?: number; 
    completionTokens?: number; 
    cost?: number; 
    requestCount?: number; 
    breakdown?: Array<{ model: string; tokens: number; cost: number }>; 
    period?: string 
  }) || {};

  return (
    <div className="glass rounded-xl w-full overflow-hidden animate-float-up">
      {/* Cost hero */}
      <div className="px-4 pt-4 pb-3 border-b border-border/30">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign className="h-4 w-4 text-neon-cyan" />
          <span className="text-sm font-semibold">Spending</span>
          <span className="text-[10px] text-muted-foreground/50 uppercase ml-auto">
            {period}
          </span>
        </div>
        <p className="text-3xl font-bold text-gradient-neon">
          {formatCost(cost)}
        </p>
        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
          {requestCount} request{requestCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Token breakdown */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-3.5 w-3.5 text-neon-purple" />
          <span className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            Tokens
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="glass rounded-lg p-2.5">
            <p className="text-lg font-bold">{formatTokens(totalTokens)}</p>
            <p className="text-[10px] text-muted-foreground/60">Total</p>
          </div>
          <div className="glass rounded-lg p-2.5">
            <p className="text-lg font-bold">{formatTokens(promptTokens)}</p>
            <p className="text-[10px] text-muted-foreground/60">Input</p>
          </div>
          <div className="glass rounded-lg p-2.5">
            <p className="text-lg font-bold">{formatTokens(completionTokens)}</p>
            <p className="text-[10px] text-muted-foreground/60">Output</p>
          </div>
        </div>
      </div>

      {/* Model breakdown with cost */}
      {breakdown.length > 0 && (
        <div className="border-t border-border/30 px-4 py-3">
          <p className="mb-2 text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
            By Model
          </p>
          <div className="space-y-1.5">
            {breakdown.map((item) => (
              <div
                key={item.model}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-xs text-muted-foreground/70 font-mono truncate max-w-[45%]">
                  {item.model}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-muted-foreground/50">
                    {formatTokens(item.tokens)}
                  </span>
                  <span className="text-xs font-medium text-primary">
                    {formatCost(item.cost)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Period selector */}
      <div className="flex justify-center gap-2 border-t border-border/30 p-3">
        {["today", "week", "month", "all"].map((p) => (
          <button
            key={p}
            onClick={() => onAction?.(`show usage stats for ${p === "all" ? "all time" : `last ${p}`}`)}
            className={`glass rounded-full px-3.5 py-1 text-[11px] transition-all capitalize ${
              p === period
                ? "text-primary neon-glow-cyan"
                : "text-muted-foreground hover:text-foreground hover:neon-glow-cyan"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
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
