"use client";

import { useState, useEffect } from "react";
import { useQuery, useAction } from "convex/react";
import { api } from "@repo/convex";
import { NotebooksSidebar } from "@/components/notebooks/notebooks-sidebar";
import { NotesGrid } from "@/components/notebooks/notes-grid";
import { NoteViewer } from "@/components/notebooks/note-viewer";
import { NotebooksHeader } from "@/components/notebooks/notebooks-header";
import { AdvancedFilters } from "@/components/notebooks/advanced-filters";
import { CreateNotebookCard } from "@/components/notebooks/create-notebook-card";
import { CreateNoteSheet } from "@/components/notebooks/create-note-sheet";
import { QuickCreateFab } from "@/components/notebooks/quick-create-fab";
import { Id, Doc } from "@repo/convex";
import { AnimatePresence } from "framer-motion";

export default function NotebooksPage() {
  const [selectedNotebookId, setSelectedNotebookId] = useState<Id<"notebooks"> | null>(null);
  const [selectedNoteId, setSelectedNoteId] = useState<Id<"notes"> | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dateAfter, setDateAfter] = useState<number | undefined>(undefined);
  const [dateBefore, setDateBefore] = useState<number | undefined>(undefined);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [noteSheetOpen, setNoteSheetOpen] = useState(false);
  const [notebookCardOpen, setNotebookCardOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<Doc<"notes"> & { score?: number }> | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  const notebooks = useQuery(api.notebooks.list, {});
  const notes = useQuery(
    api.notebooks.getNotes,
    selectedNotebookId ? { notebookId: selectedNotebookId } : {}
  );
  
  // Use hybrid search action
  const runHybridSearch = useAction(api.search.hybridSearch);

  // Check if any filters are active
  const hasActiveFilters = selectedTags.length > 0 || dateAfter !== undefined || dateBefore !== undefined;
  const isAdvancedSearch = searchQuery.includes("tag:") || searchQuery.includes("notebook:") || 
                          searchQuery.includes("before:") || searchQuery.includes("after:");

  // Run hybrid search when query or filters change
  useEffect(() => {
    if (searchQuery.length > 2 || hasActiveFilters || isAdvancedSearch) {
      // Small delay to avoid immediate setState in effect
      const timer = setTimeout(() => {
        setIsSearching(true);
        runHybridSearch({
          query: searchQuery,
          notebookId: selectedNotebookId || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          before: dateBefore,
          after: dateAfter,
          limit: 50,
        })
          .then((results) => {
            setSearchResults(results);
            setIsSearching(false);
          })
          .catch((error) => {
            console.error("Search error:", error);
            setSearchResults([]);
            setIsSearching(false);
          });
      }, 0);
      return () => clearTimeout(timer);
    } else {
      const timer = setTimeout(() => {
        setSearchResults(null);
        setIsSearching(false);
      }, 0);
      return () => clearTimeout(timer);
    }
    return () => {};
  }, [searchQuery, selectedNotebookId, selectedTags, dateAfter, dateBefore, hasActiveFilters, isAdvancedSearch, runHybridSearch]);

  const displayNotes = searchQuery.length > 2 || hasActiveFilters || isAdvancedSearch 
    ? (searchResults || []) 
    : (notes || []);

  // Get all unique tags from current notes
  const allTags: string[] = Array.from(
    new Set((notes || []).flatMap((note: Doc<"notes">) => note.tags) || [])
  );

  // Clear all filters
  const clearFilters = () => {
    setSelectedTags([]);
    setDateAfter(undefined);
    setDateBefore(undefined);
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-surface/50 to-background">
      {/* Responsive Header */}
      <NotebooksHeader
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onNewNote={() => setNoteSheetOpen(true)}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        selectedNotebookId={selectedNotebookId}
      />

      <div className="flex">
        {/* Sidebar - Table of Contents Style */}
        <NotebooksSidebar
          notebooks={notebooks || []}
          selectedNotebookId={selectedNotebookId}
          onSelectNotebook={setSelectedNotebookId}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden">
          {selectedNoteId ? (
            <NoteViewer
              noteId={selectedNoteId}
              onClose={() => setSelectedNoteId(null)}
            />
          ) : (
            <div className="h-[calc(100vh-4rem)] overflow-y-auto">
              <div className="mx-auto max-w-7xl p-6 lg:p-8">
                {/* Advanced Filters */}
                <AdvancedFilters
                  allTags={allTags}
                  selectedTags={selectedTags}
                  onTagsChange={setSelectedTags}
                  dateAfter={dateAfter}
                  dateBefore={dateBefore}
                  onDateAfterChange={setDateAfter}
                  onDateBeforeChange={setDateBefore}
                  onClearAll={clearFilters}
                  hasActiveFilters={hasActiveFilters}
                />

                {/* Notes Grid/List */}
                {isSearching ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-center">
                      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                      <p className="mt-4 text-sm text-muted-foreground">Searching...</p>
                    </div>
                  </div>
                ) : (
                  <NotesGrid
                    notes={displayNotes || []}
                    viewMode={viewMode}
                    onSelectNote={setSelectedNoteId}
                    onCreateNote={() => setNoteSheetOpen(true)}
                  />
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Create Note Sheet */}
      <CreateNoteSheet
        open={noteSheetOpen}
        onOpenChange={setNoteSheetOpen}
        notebookId={selectedNotebookId || undefined}
        onSuccess={() => {
          // Notes will auto-refresh via Convex reactivity
        }}
      />

      {/* Create Notebook Card */}
      <AnimatePresence>
        {notebookCardOpen && (
          <CreateNotebookCard
            onClose={() => setNotebookCardOpen(false)}
            onSuccess={() => {
              // Notebooks will auto-refresh via Convex reactivity
            }}
          />
        )}
      </AnimatePresence>

      {/* Quick Create FAB (mobile-friendly) */}
      <QuickCreateFab
        onCreateNote={() => setNoteSheetOpen(true)}
        onCreateNotebook={() => setNotebookCardOpen(true)}
      />
    </div>
  );
}
