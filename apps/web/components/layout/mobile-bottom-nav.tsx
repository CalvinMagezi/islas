"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Settings, Bot, BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileBottomNavProps {
  _onToggleHistory: () => void;
  onOpenSettings: () => void;
  _isHistoryOpen: boolean;
}

export function MobileBottomNav({
  _onToggleHistory,
  onOpenSettings,
  _isHistoryOpen,
}: MobileBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-area-bottom">
      <div className="flex items-stretch justify-around">
        {/* HQ */}
        <Link
          href="/"
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 text-[10px] font-display transition-colors",
            pathname === "/"
              ? "text-primary font-bold"
              : "text-muted-foreground/50 active:text-foreground"
          )}
        >
          <Bot className="h-5 w-5" />
          <span>HQ</span>
        </Link>

        {/* Dashboard */}
        <Link
          href="/dashboard"
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 text-[10px] font-display transition-colors",
            pathname === "/dashboard"
              ? "text-primary font-bold"
              : "text-muted-foreground/50 active:text-foreground"
          )}
        >
          <BarChart3 className="h-5 w-5" />
          <span>Dash</span>
        </Link>

        {/* Notebooks */}
        <Link
          href="/notebooks"
          className={cn(
            "flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 text-[10px] font-display transition-colors",
            pathname.startsWith("/notebooks")
              ? "text-primary font-bold"
              : "text-muted-foreground/50 active:text-foreground"
          )}
        >
          <BookOpen className="h-5 w-5" />
          <span>Notes</span>
        </Link>

        {/* Settings */}
        <button
          onClick={onOpenSettings}
          className="flex flex-1 flex-col items-center gap-0.5 py-2 pt-2.5 text-[10px] font-display text-muted-foreground/50 active:text-foreground transition-colors"
        >
          <Settings className="h-5 w-5" />
          <span>Settings</span>
        </button>
      </div>
    </nav>
  );
}
