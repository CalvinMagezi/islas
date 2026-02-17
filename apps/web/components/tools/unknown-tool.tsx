import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface UnknownToolProps {
  toolName: string;
  data: unknown;
}

export function UnknownTool({ toolName, data }: UnknownToolProps) {
  const [open, setOpen] = useState(false);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="w-full">
      <div className="glass rounded-xl p-3 animate-float-up text-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-chart-5" />
            <span>Unknown tool: <code className="font-mono text-xs">{toolName}</code></span>
          </div>
          <CollapsibleTrigger asChild>
            <button className="text-muted-foreground hover:text-foreground">
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <pre className="mt-3 max-h-60 overflow-auto rounded-lg bg-background/50 p-3 text-xs font-mono scrollbar-thin">
            {JSON.stringify(data, null, 2)}
          </pre>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
