"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import type { ToolResultProps } from "@/components/chat/tool-result-part";

export function ActionConfirmation({ data }: ToolResultProps) {
  const { success = true, message } = (data as { success?: boolean; message?: string }) || {};

  return (
    <div className="glass animate-float-up flex items-center gap-2.5 rounded-xl px-4 py-3">
      {success ? (
        <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-green-400" />
      ) : (
        <XCircle className="h-4.5 w-4.5 shrink-0 text-destructive" />
      )}
      <span className="text-sm text-muted-foreground/90">
        {message || "Action completed"}
      </span>
    </div>
  );
}
