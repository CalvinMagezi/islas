"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@repo/convex";
import { cn } from "@/lib/utils";
import {
    Book,
    StickyNote,
    ChevronRight,
    ChevronDown,
    FolderKanban,
    Search,
    Star
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import type { Doc } from "@repo/convex";

interface ResourceSidebarProps {
    onSelectInternalLink?: (link: string) => void;
}

export function ResourceSidebar({ onSelectInternalLink }: ResourceSidebarProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedNotebooks, setExpandedNotebooks] = useState<Record<string, boolean>>({});

    const notebooks = useQuery(api.functions.notebooks.listNotebooks, { status: "active" });

    // We can't search notes effectively purely on client side if we have many, 
    // but for V1 let's just use the list and client filter, or use the search API if query exists.
    // For the sidebar, browsing hierarchy is usually preferred.

    const toggleNotebook = (id: string) => {
        setExpandedNotebooks(prev => ({
            ...prev,
            [id]: !prev[id]
        }));
    };

    const filteredNotebooks = notebooks?.filter(nb =>
        nb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        nb.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="flex h-full w-80 flex-col border-l border-border/50 bg-sidebar/50 backdrop-blur-xl">
            <div className="flex flex-col gap-3 p-4 border-b border-border/50">
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Book className="h-4 w-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">
                        Notebooks & Notes
                    </span>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/50" />
                    <Input
                        placeholder="Filter notebooks..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-8 bg-background/50 border-border/50 text-xs focus-visible:ring-1 focus-visible:ring-primary/20"
                    />
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="p-3 space-y-3">
                    {filteredNotebooks === undefined ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50 text-xs">
                            Loading...
                        </div>
                    ) : filteredNotebooks.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-muted-foreground/50 gap-2">
                            <FolderKanban className="h-8 w-8 opacity-20" />
                            <p className="text-xs">No notebooks found</p>
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {filteredNotebooks.map((notebook) => (
                                <NotebookItem
                                    key={notebook._id}
                                    notebook={notebook}
                                    isExpanded={!!expandedNotebooks[notebook._id]}
                                    onToggle={() => toggleNotebook(notebook._id)}
                                    onSelectNote={(noteId) => onSelectInternalLink?.(`show note detail for ${noteId}`)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}

function NotebookItem({
    notebook,
    isExpanded,
    onToggle,
    onSelectNote
}: {
    notebook: Doc<"notebooks">;
    isExpanded: boolean;
    onToggle: () => void;
    onSelectNote: (noteId: string) => void;
}) {
    const notes = useQuery(api.functions.notebooks.listNotes, {
        notebookId: isExpanded ? notebook._id : undefined,
        limit: 20
    });

    return (
        <div className="space-y-0.5">
            <button
                onClick={onToggle}
                className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors hover:bg-accent/50 group",
                    isExpanded && "bg-accent/30"
                )}
            >
                <div className="relative shrink-0 text-muted-foreground/70 group-hover:text-primary transition-colors">
                    {notebook.type === "project" ? (
                        <FolderKanban className="h-4 w-4" />
                    ) : (
                        <Book className="h-4 w-4" />
                    )}
                    {notebook.status === "archived" && (
                        <div className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-muted-foreground ring-1 ring-background" />
                    )}
                </div>

                <span className="truncate flex-1 text-left font-medium text-[13px] text-foreground/90">
                    {notebook.name}
                </span>

                {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/50" />
                ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
            </button>

            {isExpanded && (
                <div className="ml-4 pl-2 border-l border-border/30 space-y-0.5 animate-in slide-in-from-top-2 fade-in duration-200">
                    {notes === undefined ? (
                        <div className="py-2 pl-3 text-[10px] text-muted-foreground">Loading notes...</div>
                    ) : notes.length === 0 ? (
                        <div className="py-2 pl-3 text-[10px] text-muted-foreground italic">Empty</div>
                    ) : (
                        notes.map((note: Doc<"notes">) => (
                            <button
                                key={note._id}
                                onClick={() => onSelectNote(note._id)}
                                className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors text-left group/note"
                            >
                                <div className="shrink-0 mt-0.5">
                                    {note.pinned ? (
                                        <Star className="h-3 w-3 text-neon-yellow fill-neon-yellow/10" />
                                    ) : (
                                        <StickyNote className="h-3 w-3 text-muted-foreground/40 group-hover/note:text-primary/70 transition-colors" />
                                    )}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <p className="truncate line-clamp-1">{note.title}</p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
