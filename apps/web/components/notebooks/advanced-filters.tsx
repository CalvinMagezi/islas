"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Calendar, Tag } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AdvancedFiltersProps {
  allTags: string[];
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
  dateAfter?: number;
  dateBefore?: number;
  onDateAfterChange: (date: number | undefined) => void;
  onDateBeforeChange: (date: number | undefined) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
}

export function AdvancedFilters({
  allTags,
  selectedTags,
  onTagsChange,
  dateAfter,
  dateBefore,
  onDateAfterChange,
  onDateBeforeChange,
  onClearAll,
  hasActiveFilters,
}: AdvancedFiltersProps) {
  const toggleTag = (tag: string) => {
    onTagsChange(
      selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag]
    );
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const parseInputDate = (dateString: string): number | undefined => {
    if (!dateString) return undefined;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? undefined : date.getTime();
  };

  if (allTags.length === 0 && !hasActiveFilters) {
    return null;
  }

  return (
    <div className="mb-6 space-y-3">
      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Tags Dropdown */}
        {allTags.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 border-dashed"
              >
                <Tag className="h-3.5 w-3.5" />
                Tags
                {selectedTags.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-1 h-5 rounded-sm px-1.5 font-mono text-xs"
                  >
                    {selectedTags.length}
                  </Badge>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Filter by tags</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {allTags.map((tag) => (
                <DropdownMenuCheckboxItem
                  key={tag}
                  checked={selectedTags.includes(tag)}
                  onCheckedChange={() => toggleTag(tag)}
                >
                  {tag}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Date Range Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-2 border-dashed"
            >
              <Calendar className="h-3.5 w-3.5" />
              Date Range
              {(dateAfter || dateBefore) && (
                <Badge
                  variant="secondary"
                  className="ml-1 h-5 rounded-sm px-1.5 font-mono text-xs"
                >
                  1
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-80 p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date-after" className="text-xs font-medium">
                  Created After
                </Label>
                <Input
                  id="date-after"
                  type="date"
                  value={dateAfter ? new Date(dateAfter).toISOString().split("T")[0] : ""}
                  onChange={(e) => onDateAfterChange(parseInputDate(e.target.value))}
                  className="h-8"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-before" className="text-xs font-medium">
                  Created Before
                </Label>
                <Input
                  id="date-before"
                  type="date"
                  value={dateBefore ? new Date(dateBefore).toISOString().split("T")[0] : ""}
                  onChange={(e) => onDateBeforeChange(parseInputDate(e.target.value))}
                  className="h-8"
                />
              </div>
              {(dateAfter || dateBefore) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onDateAfterChange(undefined);
                    onDateBeforeChange(undefined);
                  }}
                  className="w-full h-8"
                >
                  Clear dates
                </Button>
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear All Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-8 gap-2 text-muted-foreground"
          >
            Clear all
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Active filters:
          </span>
          {selectedTags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 pr-1 font-normal"
            >
              <Tag className="h-3 w-3" />
              {tag}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => toggleTag(tag)}
                className="h-4 w-4 p-0 hover:bg-transparent"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          ))}
          {dateAfter && (
            <Badge
              variant="secondary"
              className="gap-1 pr-1 font-normal"
            >
              <Calendar className="h-3 w-3" />
              After {formatDate(dateAfter)}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDateAfterChange(undefined)}
                className="h-4 w-4 p-0 hover:bg-transparent"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
          {dateBefore && (
            <Badge
              variant="secondary"
              className="gap-1 pr-1 font-normal"
            >
              <Calendar className="h-3 w-3" />
              Before {formatDate(dateBefore)}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDateBeforeChange(undefined)}
                className="h-4 w-4 p-0 hover:bg-transparent"
              >
                <X className="h-3 w-3" />
              </Button>
            </Badge>
          )}
        </div>
      )}

      {/* Operator Syntax Hint */}
      <div className="text-xs text-muted-foreground">
        <span className="font-medium">Search operators:</span>{" "}
        <code className="rounded bg-muted px-1 py-0.5">tag:work</code>{" "}
        <code className="rounded bg-muted px-1 py-0.5">before:2024-01-01</code>{" "}
        <code className="rounded bg-muted px-1 py-0.5">after:2023-12-01</code>{" "}
        <code className="rounded bg-muted px-1 py-0.5">notebook:&quot;Project X&quot;</code>
      </div>
    </div>
  );
}
