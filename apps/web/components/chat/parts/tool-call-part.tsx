"use client";

import { Loader2, AlertTriangle } from "lucide-react";

interface ToolCallPartProps {
  toolName: string;
  state: string;
}

const TOOL_LABELS: Record<string, string> = {
  showDashboard: "Loading dashboard",
  showMemories: "Fetching memories",
  showProjects: "Fetching projects",
  showProjectDetail: "Loading project",
  showSettings: "Loading settings",
  showUsageStats: "Loading usage stats",
  storeMemory: "Storing memory",
  recallMemory: "Searching memories",
  updateMemory: "Updating memory",
  deleteMemory: "Deleting memory",
  createProject: "Creating project",
  updateProject: "Updating project",
  setSetting: "Updating setting",
};

export function ToolCallPart({ toolName, state }: ToolCallPartProps) {
  if (state === "output-available") return null;

  const isError = state === "output-error";
  const label = TOOL_LABELS[toolName] || `Running ${toolName}`;

  return (
    <div className="glass animate-float-up flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm">
      {isError ? (
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
      ) : (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
      )}
      <span className={isError ? "text-destructive" : "text-muted-foreground"}>
        {isError ? `Failed: ${toolName}` : `${label}...`}
      </span>
      {!isError && (
        <div className="flex gap-0.5 ml-auto">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-pulse" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/40 animate-pulse [animation-delay:150ms]" />
          <span className="h-1.5 w-1.5 rounded-full bg-primary/20 animate-pulse [animation-delay:300ms]" />
        </div>
      )}
    </div>
  );
}
