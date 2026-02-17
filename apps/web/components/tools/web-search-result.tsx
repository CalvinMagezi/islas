"use client";

import { Globe, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { ToolResultProps } from "../chat/tool-result-part";

interface WebResult {
  title: string;
  url: string;
  description: string;
  age?: string;
}

export function WebSearchResult({ data, status }: ToolResultProps) {
  const { found, results = [] } = (data as { found?: boolean; results?: WebResult[] }) || {};

  if (status === "partial") {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Globe className="h-4 w-4 animate-pulse" />
        Searching web...
      </div>
    );
  }

  if (!found || results.length === 0) {
    return (
      <Card className="p-4">
        <div className="text-sm text-muted-foreground">
          No web results found for your query.
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Globe className="h-4 w-4" />
        Web Search Results ({results.length})
      </div>
      
      {results.map((result: WebResult, i: number) => (
        <Card key={i} className="p-4 border-l-4 border-l-blue-500">
          <div className="space-y-2">
            <a
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-start gap-1"
            >
              {result.title}
              <ExternalLink className="h-3 w-3 mt-1 flex-shrink-0" />
            </a>
            
            <div className="text-sm text-muted-foreground">
              {result.description}
            </div>
            
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{new URL(result.url).hostname}</span>
              {result.age && (
                <>
                  <span>•</span>
                  <span>{result.age}</span>
                </>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
