"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Button } from "@/components/ui/button";
import { Download, Loader2 } from "lucide-react";
import { Id } from "@repo/convex";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportButtonProps {
  notebookId: Id<"notebooks"> | null;
  variant?: "default" | "ghost" | "outline";
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportButton({ notebookId, variant = "ghost", size = "default" }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportData = useQuery(
    api.export.exportNotebook,
    notebookId ? { notebookId, format: "markdown" } : "skip"
  );

  const handleExport = async (format: "markdown" | "json") => {
    if (!notebookId || !exportData) return;

    setIsExporting(true);
    try {
      // Re-fetch with the correct format
      const data = await fetch(`/api/export/notebook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, format }),
      }).then(res => res.json()).catch(() => exportData); // Fallback to cached data

      // Create download
      const blob = new Blob([data.content || exportData.content], { 
        type: format === "json" ? "application/json" : "text/markdown" 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = data.filename || exportData.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setIsExporting(false);
    }
  };

  if (!notebookId) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant={variant} 
          size={size}
          disabled={isExporting || !exportData}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Download className="h-4 w-4" />
              {size !== "icon" && <span className="ml-2">Export</span>}
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport("markdown")}>
          Export as Markdown
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport("json")}>
          Export as JSON
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
