"use client";

import { Badge } from "@/components/ui/badge";
import { FolderKanban } from "lucide-react";
import type { ToolResultProps } from "@/components/chat/tool-result-part";

const STATUS_STYLES: Record<string, string> = {
  active: "border-green-500/30 text-green-400 bg-green-500/10",
  completed: "border-neon-cyan/30 text-neon-cyan bg-neon-cyan/10",
  archived: "border-muted-foreground/30 text-muted-foreground bg-muted/50",
};

export function ProjectList({ data, onAction }: ToolResultProps) {
  const { projects = [] } = (data as { projects?: Array<{ _id: string; name: string; description?: string; status: string; techStack?: string[] }> }) || {};

  if (projects.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center animate-float-up">
        <FolderKanban className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No notebooks found</p>
      </div>
    );
  }

  return (
    <div className="grid gap-1.5 w-full animate-float-up">
      {projects.map((project, i: number) => (
        <button
          key={project._id}
          onClick={() => onAction?.(`show notebook detail for ${project._id}`)}
          className="group glass rounded-xl p-3 text-left transition-all hover:neon-glow-blue w-full"
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-medium text-sm group-hover:text-foreground transition-colors">
                {project.name}
              </p>
              {project.description && (
                <p className="mt-0.5 text-xs text-muted-foreground/70 line-clamp-2">
                  {project.description}
                </p>
              )}
            </div>
            <Badge
              variant="outline"
              className={`shrink-0 text-[10px] ${STATUS_STYLES[project.status] || ""}`}
            >
              {project.status}
            </Badge>
          </div>
          {project.techStack && project.techStack.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {project.techStack.map((tech) => (
                <Badge
                  key={tech}
                  variant="secondary"
                  className="text-[10px] bg-secondary/50"
                >
                  {tech}
                </Badge>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
