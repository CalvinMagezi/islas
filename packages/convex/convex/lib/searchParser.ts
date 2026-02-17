/**
 * Search Query Parser
 * 
 * Parses advanced search operators from query strings.
 * 
 * Examples:
 *   "tag:work deployment" → { keywords: ["deployment"], tags: ["work"] }
 *   'notebook:"Project X" api' → { keywords: ["api"], notebookName: "Project X" }
 *   "before:2024-01-01 after:2023-12-01 api" → { keywords: ["api"], before: timestamp, after: timestamp }
 */

export interface ParsedQuery {
  keywords: string[];
  tags: string[];
  notebookName?: string;
  before?: number; // Unix timestamp
  after?: number;  // Unix timestamp
}

/**
 * Parse a search query with operators
 */
export function parseSearchQuery(query: string): ParsedQuery {
  const result: ParsedQuery = {
    keywords: [],
    tags: [],
  };

  // Regex patterns for operators
  const tagPattern = /tag:(\S+)/g;
  const notebookPattern = /notebook:"([^"]+)"|notebook:(\S+)/g;
  const beforePattern = /before:(\d{4}-\d{2}-\d{2})/g;
  const afterPattern = /after:(\d{4}-\d{2}-\d{2})/g;

  let cleanedQuery = query;

  // Extract tags
  let match;
  while ((match = tagPattern.exec(query)) !== null) {
    result.tags.push(match[1]);
    cleanedQuery = cleanedQuery.replace(match[0], "");
  }

  // Extract notebook (quoted or unquoted)
  while ((match = notebookPattern.exec(query)) !== null) {
    result.notebookName = match[1] || match[2]; // quoted or unquoted
    cleanedQuery = cleanedQuery.replace(match[0], "");
  }

  // Extract before date
  while ((match = beforePattern.exec(query)) !== null) {
    const date = new Date(match[1] + "T23:59:59Z"); // End of day UTC
    if (!isNaN(date.getTime())) {
      result.before = date.getTime();
    }
    cleanedQuery = cleanedQuery.replace(match[0], "");
  }

  // Extract after date
  while ((match = afterPattern.exec(query)) !== null) {
    const date = new Date(match[1] + "T00:00:00Z"); // Start of day UTC
    if (!isNaN(date.getTime())) {
      result.after = date.getTime();
    }
    cleanedQuery = cleanedQuery.replace(match[0], "");
  }

  // Extract remaining keywords (split by whitespace, filter empty)
  result.keywords = cleanedQuery
    .split(/\s+/)
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  return result;
}

/**
 * Convert a parsed query back to a simple keyword string for semantic search
 */
export function getKeywordsString(parsed: ParsedQuery): string {
  return parsed.keywords.join(" ");
}
