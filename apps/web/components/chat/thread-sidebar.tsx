"use client";

import { MessageSquare, Plus, Clock, MoreHorizontal, Archive, Trash2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ThreadFilter } from "@/hooks/use-thread";

interface Thread {
  _id: string;
  title?: string;
  _creationTime: number;
}

interface ThreadSidebarProps {
  threads: Thread[];
  activeThreadId: string | null;
  filter: ThreadFilter;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onSetFilter: (filter: ThreadFilter) => void;
  onArchiveThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onRestoreThread: (id: string) => void;
}

export function ThreadSidebar({
  threads,
  activeThreadId,
  filter,
  onSelectThread,
  onNewThread,
  onSetFilter,
  onArchiveThread,
  onDeleteThread,
  onRestoreThread,
}: ThreadSidebarProps) {
  return (
    <div className="flex h-full w-72 flex-col border-r border-border/50 bg-sidebar">
      <div className="flex items-center justify-between p-3 border-b border-border/50">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Threads
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNewThread}
          className="h-7 w-7 text-muted-foreground hover:text-primary"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-border/50">
        <button
          onClick={() => onSetFilter("active")}
          className={cn(
            "flex-1 py-2 text-[11px] font-medium uppercase tracking-wider transition-colors",
            filter === "active"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground/60 hover:text-muted-foreground",
          )}
        >
          Active
        </button>
        <button
          onClick={() => onSetFilter("archived")}
          className={cn(
            "flex-1 py-2 text-[11px] font-medium uppercase tracking-wider transition-colors",
            filter === "archived"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground/60 hover:text-muted-foreground",
          )}
        >
          Archived
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-0.5">
        {threads.map((thread, index) => (
          <div
            key={thread._id}
            className={cn(
              "group flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all",
              "hover:bg-accent/50",
              activeThreadId === thread._id
                ? "bg-primary/10 text-foreground border border-primary/20"
                : "text-muted-foreground hover:text-foreground border border-transparent",
            )}
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <button
              onClick={() => onSelectThread(thread._id)}
              className="flex items-center gap-2.5 min-w-0 flex-1"
            >
              <MessageSquare
                className={cn(
                  "h-4 w-4 shrink-0 transition-colors",
                  activeThreadId === thread._id
                    ? "text-primary"
                    : "text-muted-foreground/60 group-hover:text-muted-foreground",
                )}
              />
              <div className="flex flex-col items-start min-w-0 flex-1">
                <span className="truncate w-full text-left text-[13px]">
                  {thread.title || "New conversation"}
                </span>
                <span className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                  <Clock className="h-2.5 w-2.5" />
                  {formatDate(thread._creationTime)}
                </span>
              </div>
            </button>

            {/* Thread action menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-accent/60 focus:opacity-100"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {filter === "active" ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => onArchiveThread(thread._id)}
                      className="text-xs"
                    >
                      <Archive className="mr-2 h-3.5 w-3.5" />
                      Archive
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDeleteThread(thread._id)}
                      className="text-xs text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem
                      onClick={() => onRestoreThread(thread._id)}
                      className="text-xs"
                    >
                      <RotateCcw className="mr-2 h-3.5 w-3.5" />
                      Restore
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => onDeleteThread(thread._id)}
                      className="text-xs text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" />
                      Delete
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        {threads.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-3 py-12 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground/60">
              {filter === "active"
                ? "No threads yet"
                : "No archived threads"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
