"use client";

import { Settings } from "lucide-react";
import type { ToolResultProps } from "@/components/chat/tool-result-part";

export function SettingsPanel({ data }: ToolResultProps) {
  const { settings = [] } = (data as { settings?: Array<{ _id: string; key: string; value: string }> }) || {};

  if (settings.length === 0) {
    return (
      <div className="glass rounded-xl p-8 text-center animate-float-up">
        <Settings className="mx-auto mb-3 h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No settings configured</p>
        <p className="mt-1 text-[11px] text-muted-foreground/50">
          Try &quot;set theme to dark&quot; or &quot;set timezone to UTC&quot;
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl w-full overflow-hidden animate-float-up divide-y divide-border/30">
      {settings.map((setting) => (
        <div
          key={setting._id}
          className="flex items-center justify-between px-4 py-3"
        >
          <span className="text-sm font-medium text-muted-foreground/80">
            {setting.key}
          </span>
          <span className="text-sm font-mono text-primary">
            {setting.value}
          </span>
        </div>
      ))}
    </div>
  );
}
