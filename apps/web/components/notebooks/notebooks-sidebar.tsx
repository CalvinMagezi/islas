"use client";

import { Id } from "@repo/convex";
import { cn } from "@/lib/utils";

interface Notebook {
  _id: Id<"notebooks">;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  tags: string[];
  updatedAt: number;
}

interface NotebooksSidebarProps {
  notebooks: Notebook[];
  selectedNotebookId: Id<"notebooks"> | null;
  onSelectNotebook: (id: Id<"notebooks"> | null) => void;
  isOpen: boolean;
  onClose: () => void;
}

export function NotebooksSidebar({
  notebooks,
  selectedNotebookId,
  onSelectNotebook,
  isOpen,
  onClose,
}: NotebooksSidebarProps) {
  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 z-50 w-72 border-r-2 border-foreground/10 bg-background transition-transform duration-200 md:relative md:z-auto md:translate-x-0",
          "top-[6.5rem] h-[calc(100vh-6.5rem)]", // Mobile: below two-row header (56px + 48px)
          "md:top-16 md:h-[calc(100vh-4rem)]", // Desktop: below single header
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Sidebar Header */}
          <div className="border-b border-foreground/10 p-6">
            <h2 className="font-serif text-lg font-semibold text-foreground">
              Collections
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {notebooks.length} {notebooks.length === 1 ? "notebook" : "notebooks"}
            </p>
          </div>

          {/* All Notes Button */}
          <div className="border-b border-foreground/10 p-4">
            <button
              onClick={() => onSelectNotebook(null)}
              className={cn(
                "group w-full rounded-lg p-3 text-left transition-all",
                selectedNotebookId === null
                  ? "bg-foreground text-background"
                  : "hover:bg-accent"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors",
                    selectedNotebookId === null
                      ? "bg-background/10"
                      : "bg-muted group-hover:bg-accent"
                  )}
                >
                  📚
                </div>
                <div className="flex-1 overflow-hidden">
                  <div
                    className={cn(
                      "truncate font-medium",
                      selectedNotebookId === null
                        ? "text-background"
                        : "text-foreground"
                    )}
                  >
                    All Notes
                  </div>
                  <div
                    className={cn(
                      "text-xs",
                      selectedNotebookId === null
                        ? "text-background/60"
                        : "text-muted-foreground"
                    )}
                  >
                    Everything
                  </div>
                </div>
              </div>
            </button>
          </div>

          {/* Notebooks List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2 pb-4">
              {notebooks.map((notebook) => (
                <button
                  key={notebook._id}
                  onClick={() => onSelectNotebook(notebook._id)}
                  className={cn(
                    "group w-full rounded-lg p-3 text-left transition-all",
                    selectedNotebookId === notebook._id
                      ? "bg-foreground text-background shadow-sm"
                      : "hover:bg-accent"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-xl transition-colors"
                      style={{
                        backgroundColor:
                          selectedNotebookId === notebook._id
                            ? "rgba(255, 255, 255, 0.1)"
                            : notebook.color || "var(--muted)",
                      }}
                    >
                      {notebook.icon || "📓"}
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <div
                        className={cn(
                          "truncate font-medium",
                          selectedNotebookId === notebook._id
                            ? "text-background"
                            : "text-foreground"
                        )}
                      >
                        {notebook.name}
                      </div>
                      {notebook.description && (
                        <div
                          className={cn(
                            "truncate text-xs",
                            selectedNotebookId === notebook._id
                              ? "text-background/60"
                              : "text-muted-foreground"
                          )}
                        >
                          {notebook.description}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {notebook.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {notebook.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            selectedNotebookId === notebook._id
                              ? "bg-background/20 text-background/80"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {tag}
                        </span>
                      ))}
                      {notebook.tags.length > 3 && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-xs",
                            selectedNotebookId === notebook._id
                              ? "bg-background/20 text-background/80"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          +{notebook.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
