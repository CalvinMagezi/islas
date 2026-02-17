"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Target, Layers, Crosshair } from "lucide-react";
import type { ToolResultProps } from "@/components/chat/tool-result-part";

export function ProjectDetail({ data, onAction }: ToolResultProps) {
  const { project, relatedMemories = [] } = (data as { 
    project?: { name: string; status: string; description?: string; currentFocus?: string; techStack?: string[]; goals?: string[] }; 
    relatedMemories?: Array<{ _id: string; content: string }> 
  }) || {};

  if (!project) {
    return (
      <div className="glass rounded-xl p-4 text-sm text-muted-foreground animate-float-up">
        Project not found
      </div>
    );
  }

  return (
    <div className="glass rounded-xl w-full animate-float-up overflow-hidden">
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold">{project.name}</h3>
          <Badge
            variant="outline"
            className="shrink-0 text-[10px] border-primary/30 text-primary"
          >
            {project.status}
          </Badge>
        </div>
        {project.description && (
          <p className="mt-1 text-sm text-muted-foreground/80">
            {project.description}
          </p>
        )}
      </div>

      <div className="space-y-3 px-4 pb-4">
        {project.currentFocus && (
          <div className="flex items-start gap-2">
            <Crosshair className="h-4 w-4 shrink-0 mt-0.5 text-neon-cyan" />
            <div>
              <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider">
                Current Focus
              </p>
              <p className="text-sm">{project.currentFocus}</p>
            </div>
          </div>
        )}

        {project.techStack && project.techStack.length > 0 && (
          <div className="flex items-start gap-2">
            <Layers className="h-4 w-4 shrink-0 mt-0.5 text-neon-blue" />
            <div>
              <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">
                Tech Stack
              </p>
              <div className="flex flex-wrap gap-1">
                {project.techStack.map((tech) => (
                  <Badge key={tech} variant="secondary" className="text-[10px] bg-secondary/50">
                    {tech}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {project.goals && project.goals.length > 0 && (
          <div className="flex items-start gap-2">
            <Target className="h-4 w-4 shrink-0 mt-0.5 text-neon-purple" />
            <div>
              <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-1">
                Goals
              </p>
              <ul className="space-y-1 text-sm">
                {project.goals.map((goal, i: number) => (
                  <li key={i} className="flex gap-2 text-muted-foreground/80">
                    <span className="text-primary">&#8226;</span>
                    {goal}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {relatedMemories.length > 0 && (
          <>
            <Separator className="opacity-30" />
            <div>
              <p className="text-[10px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2">
                Related Notes
              </p>
              <div className="space-y-1">
                {relatedMemories.map((memory) => (
                  <button
                    key={memory._id}
                    className="w-full cursor-pointer rounded-lg px-2.5 py-2 text-xs text-left text-muted-foreground/70 hover:bg-accent/30 hover:text-foreground transition-all"
                    onClick={() =>
                      onAction?.(`show note detail for ${memory._id}`)
                    }
                  >
                    {memory.content?.slice(0, 100)}
                    {memory.content?.length > 100 ? "..." : ""}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
