"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UserButton } from "@/components/auth/user-button";
import { SearchBar } from "./search-bar";
import { ExportButton } from "./export-button";
import { BookOpen, Plus, LayoutGrid, List, ArrowLeft } from "lucide-react";
import { Id } from "@repo/convex";

interface NotebooksHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (mode: "grid" | "list") => void;
  onNewNote: () => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  selectedNotebookId?: Id<"notebooks"> | null;
}

export function NotebooksHeader({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  onNewNote,
  onToggleSidebar,
  selectedNotebookId,
}: NotebooksHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b-2 border-foreground/10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      {/* Mobile Layout */}
      <div className="md:hidden">
        {/* Top Row: Back + Title + Sidebar Toggle + New Note */}
        <div className="flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-1">
            {/* Back to Chat */}
            <Link href="/">
              <Button
                size="icon"
                variant="ghost"
                className="h-9 w-9 shrink-0 text-muted-foreground"
                title="Back to Chat"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            {/* Toggle Notebooks Sidebar */}
            <Button
              size="icon"
              variant="ghost"
              onClick={onToggleSidebar}
              className="h-9 w-9 shrink-0"
              title="Toggle notebooks"
            >
              <BookOpen className="h-5 w-5" />
            </Button>
            <h1 className="font-serif text-lg font-bold tracking-tight text-foreground">
              Archive
            </h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Export Button (mobile) */}
            {selectedNotebookId && (
              <ExportButton notebookId={selectedNotebookId} variant="ghost" size="icon" />
            )}

            {/* New Note Button */}
            <Button
              size="icon"
              onClick={onNewNote}
              className="h-9 w-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
            </Button>

            {/* User Button */}
            <UserButton />
          </div>
        </div>

        {/* Bottom Row: Search + View Toggle */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-foreground/5">
          <SearchBar
            value={searchQuery}
            onChange={onSearchChange}
            placeholder="Search notes..."
            className="flex-1"
          />
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onViewModeChange(viewMode === "grid" ? "list" : "grid")}
            className="h-9 w-9 shrink-0 text-muted-foreground"
            title={`Switch to ${viewMode === "grid" ? "list" : "grid"} view`}
          >
            {viewMode === "grid" ? (
              <List className="h-4 w-4" />
            ) : (
              <LayoutGrid className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Desktop Layout */}
      <div className="hidden md:flex h-16 items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onToggleSidebar}
            className="rounded-lg p-2 transition-colors hover:bg-accent lg:hidden"
            aria-label="Toggle sidebar"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 20 20"
              fill="none"
              className="text-foreground"
            >
              <path
                d="M3 5h14M3 10h14M3 15h14"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
            Archive
          </h1>

          {/* Desktop Navigation */}
          <nav className="ml-6 flex items-center gap-3">
            <Link href="/">
              <Button
                variant="ghost"
                className="h-8 gap-2 text-muted-foreground hover:text-foreground"
              >
                <span>Chat</span>
              </Button>
            </Link>
            <div className="h-6 w-px bg-border/50" />
            <Link href="/notebooks">
              <Button
                variant="ghost"
                className="h-8 gap-2 bg-accent text-foreground"
              >
                <BookOpen className="h-4 w-4" />
                <span>Notebooks</span>
              </Button>
            </Link>
          </nav>
        </div>

        <SearchBar
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search notes..."
        />

        <div className="flex items-center gap-2">
          {selectedNotebookId && (
            <ExportButton notebookId={selectedNotebookId} variant="ghost" size="default" />
          )}
          <Button
            onClick={onNewNote}
            className="h-9 gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span>New Note</span>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={() => onViewModeChange(viewMode === "grid" ? "list" : "grid")}
            className="h-9 w-9 text-muted-foreground hover:text-foreground"
            title={`Switch to ${viewMode === "grid" ? "list" : "grid"} view`}
          >
            {viewMode === "grid" ? (
              <List className="h-4 w-4" />
            ) : (
              <LayoutGrid className="h-4 w-4" />
            )}
          </Button>
          <UserButton />
        </div>
      </div>
    </header>
  );
}
