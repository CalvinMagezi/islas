"use client";

import { Badge } from "@/components/ui/badge";
import { Brain } from "lucide-react";
import type { ToolResultProps } from "@/components/chat/tool-result-part";

const CATEGORY_COLORS: Record<string, string> = {
  learning: "border-neon-cyan/30 text-neon-cyan bg-neon-cyan/10",
  preference: "border-neon-purple/30 text-neon-purple bg-neon-purple/10",
  fact: "border-neon-blue/30 text-neon-blue bg-neon-blue/10",
  project_context: "border-chart-4/30 text-chart-4 bg-chart-4/10",
  decision: "border-chart-5/30 text-chart-5 bg-chart-5/10",
};

export function MemoryList({ data, onAction }: ToolResultProps) {
  const { memories = [], total } = (data as { memories?: Array<{ _id: string; content: string; category: string; tags?: string[]; importance?: number }>; total?: number }) || {};

  if (memories.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center animate-float-up">
        <Brain className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No notes found</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 w-full animate-float-up">
      <p className="text-[11px] text-muted-foreground/60 uppercase tracking-wider font-medium px-1">
        {total ?? memories.length} notes
      </p>
      <div className="grid gap-1.5">
        {memories.map((memory, i: number) => (
          <button
            key={memory._id}
            onClick={() => onAction?.(`show note detail for ${memory._id}`)}
            className="group glass rounded-xl p-3 text-left transition-all hover:neon-glow-cyan w-full"
            style={{ animationDelay: `${i * 40}ms` }}
          >
            <p className="text-sm line-clamp-2 group-hover:text-foreground transition-colors">
              {memory.content}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className={`text-[10px] ${CATEGORY_COLORS[memory.category] || ""}`}
              >
                {memory.category}
              </Badge>
              {memory.tags?.slice(0, 3).map((tag: string) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="text-[10px] cursor-pointer hover:bg-accent/50"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAction?.(`show notes tagged ${tag}`);
                  }}
                >
                  {tag}
                </Badge>
              ))}
              {memory.importance != null && (
                <span className="ml-auto text-[10px] text-muted-foreground/50">
                  {Math.round(memory.importance * 100)}%
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
