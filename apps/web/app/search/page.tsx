"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "@repo/convex";
import { Id, Doc } from "@repo/convex";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Sparkles, Loader2, ArrowLeft, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [selectedNotebookId, setSelectedNotebookId] = useState<Id<"notebooks"> | undefined>();
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<Array<Doc<"notes"> & { score?: number }>>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const notebooks = useQuery(api.notebooks.list, {});
  const semanticSearch = useAction(api.search.semanticSearch);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setHasSearched(true);

    try {
      const searchResults = await semanticSearch({
        query: query.trim(),
        notebookId: selectedNotebookId,
        limit: 20,
      });
      setResults(searchResults || []);
    } catch (error) {
      console.error("Search failed:", error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const highlightText = (text: string) => {
    const excerpt = text
      .replace(/^#+\s/gm, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .substring(0, 200);
    return excerpt;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b-2 border-foreground/10 bg-card/50 backdrop-blur-sm">
        <div className="mx-auto max-w-5xl px-6 py-6">
          <div className="mb-6 flex items-center gap-4">
            <Link
              href="/notebooks"
              className="rounded-lg p-2 transition-colors hover:bg-accent"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-serif text-3xl font-bold tracking-tight">
                Semantic Search
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Find notes by meaning, not just keywords
              </p>
            </div>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What are you looking for?"
                className="h-16 border-2 pl-14 pr-6 text-lg font-medium placeholder:text-muted-foreground/50"
                disabled={isSearching}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Notebook Filter */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedNotebookId || "all"}
                  onValueChange={(value) =>
                    setSelectedNotebookId(value === "all" ? undefined : value as Id<"notebooks">)
                  }
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="All notebooks" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All notebooks</SelectItem>
                    {notebooks?.map((notebook: Doc<"notebooks">) => (
                      <SelectItem key={notebook._id} value={notebook._id}>
                        {notebook.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                disabled={isSearching || !query.trim()}
                className="gap-2"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Search
                  </>
                )}
              </Button>

              {query && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setQuery("");
                    setResults([]);
                    setHasSearched(false);
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
          </form>
        </div>
      </header>

      {/* Results */}
      <main className="mx-auto max-w-5xl px-6 py-8">
        {!hasSearched && (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <div className="mb-4 text-6xl opacity-20">🔍</div>
              <p className="text-lg font-medium text-muted-foreground">
                Start your search
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Use natural language to find notes by meaning
              </p>
            </div>
          </div>
        )}

        {isSearching && (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" />
              <p className="mt-4 text-lg font-medium text-muted-foreground">
                Searching...
              </p>
            </div>
          </div>
        )}

        {hasSearched && !isSearching && results.length === 0 && (
          <div className="flex min-h-[400px] items-center justify-center">
            <div className="text-center">
              <div className="mb-4 text-6xl opacity-20">🤷</div>
              <p className="text-lg font-medium text-muted-foreground">
                No results found
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try a different search query
              </p>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 border-b-2 border-foreground/10 pb-3">
              <h2 className="font-serif text-xl font-bold tracking-tight">
                {results.length} {results.length === 1 ? "Result" : "Results"}
              </h2>
              <div className="h-px flex-1 bg-gradient-to-r from-foreground/10 to-transparent" />
            </div>

            <div className="space-y-4">
              {results.map((note, index) => {
                const formattedDate = new Intl.DateTimeFormat("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }).format(new Date(note.createdAt));

                 const excerpt = highlightText(note.content);
                const notebookName = notebooks?.find(
                  (nb: Doc<"notebooks">) => nb._id === note.notebookId
                )?.name;

                return (
                  <Card
                    key={note._id}
                    className="group overflow-hidden border-2 transition-all hover:border-foreground/20 hover:shadow-lg"
                    style={{
                      animationDelay: `${index * 50}ms`,
                      animation: "float-up 0.5s ease-out forwards",
                      opacity: 0,
                    }}
                  >
                    <Link
                      href={`/notebooks?noteId=${note._id}`}
                      className="block p-6"
                    >
                      {/* Metadata */}
                      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {notebookName && (
                          <Badge variant="outline" className="rounded-full">
                            {notebookName}
                          </Badge>
                        )}
                        <span>•</span>
                        <time dateTime={new Date(note.createdAt).toISOString()}>
                          {formattedDate}
                        </time>
                      </div>

                      {/* Title */}
                      <h3 className="mb-2 font-serif text-2xl font-bold tracking-tight text-foreground transition-colors group-hover:text-primary">
                        {note.title}
                      </h3>

                      {/* Excerpt */}
                      <p className="mb-4 line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                        {excerpt}...
                      </p>

                      {/* Tags */}
                      {note.tags && note.tags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {note.tags.map((tag: string) => (
                            <Badge
                              key={tag}
                              variant="secondary"
                              className="rounded-full text-xs font-normal"
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </Link>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
