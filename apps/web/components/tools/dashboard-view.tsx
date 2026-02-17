"use client";

import { Brain, FolderKanban, Zap, DollarSign } from "lucide-react";
import type { ToolResultProps } from "@/components/chat/tool-result-part";

export function DashboardView({ data, onAction }: ToolResultProps) {
  const { memoryCount = 0, projectCount = 0, costToday = 0, tokensToday = 0 } = (data as { memoryCount?: number; projectCount?: number; costToday?: number; tokensToday?: number }) || {};

  const stats = [
    {
      label: "Notes",
      value: memoryCount,
      icon: Brain,
      action: "show my notes",
      color: "text-neon-cyan",
      glow: "group-hover:neon-glow-cyan",
    },
    {
      label: "Notebooks",
      value: projectCount,
      icon: FolderKanban,
      action: "show my notebooks",
      color: "text-neon-blue",
      glow: "group-hover:neon-glow-blue",
    },
    {
      label: "Cost Today",
      value: formatCost(costToday),
      icon: DollarSign,
      action: "show usage stats for today",
      color: "text-neon-purple",
      glow: "group-hover:neon-glow-purple",
    },
    {
      label: "Tokens Today",
      value: formatNumber(tokensToday),
      icon: Zap,
      action: "show usage stats for today",
      color: "text-neon-cyan",
      glow: "group-hover:neon-glow-cyan",
    },
  ];

  return (
    <div className="grid w-full grid-cols-2 gap-2 animate-float-up">
      {stats.map((stat, i) => (
        <button
          key={stat.label}
          onClick={() => onAction?.(stat.action)}
          className={`group glass rounded-xl p-4 text-left transition-all ${stat.glow}`}
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <stat.icon className={`h-5 w-5 ${stat.color} mb-2`} />
          <p className="text-2xl font-bold tracking-tight">{stat.value}</p>
          <p className="text-[11px] text-muted-foreground">{stat.label}</p>
        </button>
      ))}
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(cost: number): string {
  if (cost >= 1) return `$${cost.toFixed(2)}`;
  if (cost >= 0.01) return `$${cost.toFixed(3)}`;
  if (cost === 0) return "$0.00";
  return `$${cost.toFixed(4)}`;
}
