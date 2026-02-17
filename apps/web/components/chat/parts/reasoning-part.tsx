"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface ReasoningPartProps {
  text: string;
}

export function ReasoningPart({ text }: ReasoningPartProps) {
  const [open, setOpen] = useState(false);

  if (!text) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="glass rounded-xl overflow-hidden animate-float-up">
        <CollapsibleTrigger asChild>
          <button className="flex w-full items-center gap-2 px-3.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <Brain className="h-3.5 w-3.5 text-neon-purple" />
            <span className="font-medium">Reasoning</span>
            {open ? (
              <ChevronDown className="ml-auto h-3 w-3" />
            ) : (
              <ChevronRight className="ml-auto h-3 w-3" />
            )}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border/50 px-3.5 py-2.5 text-xs text-muted-foreground/80 whitespace-pre-wrap leading-relaxed">
            {text}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
