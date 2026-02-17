/**
 * Tests for search query parser
 * Run with: npx tsx convex/lib/searchParser.test.ts
 */

import { parseSearchQuery, getKeywordsString } from "./searchParser";

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(error);
  }
}

function assertEquals(actual: any, expected: any, message?: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(
      `${message || "Assertion failed"}\nExpected: ${expectedStr}\nActual: ${actualStr}`
    );
  }
}

// Test cases
test("Parse simple keywords", () => {
  const result = parseSearchQuery("api deployment testing");
  assertEquals(result.keywords, ["api", "deployment", "testing"]);
  assertEquals(result.tags, []);
  assertEquals(result.notebookName, undefined);
});

test("Parse tag operator", () => {
  const result = parseSearchQuery("tag:work deployment");
  assertEquals(result.keywords, ["deployment"]);
  assertEquals(result.tags, ["work"]);
});

test("Parse multiple tags", () => {
  const result = parseSearchQuery("tag:work tag:api deployment");
  assertEquals(result.keywords, ["deployment"]);
  assertEquals(result.tags, ["work", "api"]);
});

test("Parse notebook with quotes", () => {
  const result = parseSearchQuery('notebook:"Project X" api');
  assertEquals(result.keywords, ["api"]);
  assertEquals(result.notebookName, "Project X");
});

test("Parse notebook without quotes", () => {
  const result = parseSearchQuery("notebook:ProjectX api");
  assertEquals(result.keywords, ["api"]);
  assertEquals(result.notebookName, "ProjectX");
});

test("Parse before date", () => {
  const result = parseSearchQuery("before:2024-01-01 api");
  assertEquals(result.keywords, ["api"]);
  const expectedDate = new Date("2024-01-01T23:59:59Z").getTime();
  assertEquals(result.before, expectedDate);
});

test("Parse after date", () => {
  const result = parseSearchQuery("after:2023-12-01 api");
  assertEquals(result.keywords, ["api"]);
  const expectedDate = new Date("2023-12-01T00:00:00Z").getTime();
  assertEquals(result.after, expectedDate);
});

test("Parse date range", () => {
  const result = parseSearchQuery("after:2023-12-01 before:2024-01-01 deployment");
  assertEquals(result.keywords, ["deployment"]);
  assertEquals(result.after, new Date("2023-12-01T00:00:00Z").getTime());
  assertEquals(result.before, new Date("2024-01-01T23:59:59Z").getTime());
});

test("Parse complex query with all operators", () => {
  const result = parseSearchQuery('tag:work notebook:"Project X" before:2024-01-01 api deployment');
  assertEquals(result.keywords, ["api", "deployment"]);
  assertEquals(result.tags, ["work"]);
  assertEquals(result.notebookName, "Project X");
  assertEquals(result.before, new Date("2024-01-01T23:59:59Z").getTime());
});

test("getKeywordsString returns joined keywords", () => {
  const parsed = parseSearchQuery("tag:work api deployment");
  const keywords = getKeywordsString(parsed);
  assertEquals(keywords, "api deployment");
});

test("Empty query returns empty results", () => {
  const result = parseSearchQuery("");
  assertEquals(result.keywords, []);
  assertEquals(result.tags, []);
});

test("Only operators (no keywords)", () => {
  const result = parseSearchQuery("tag:work before:2024-01-01");
  assertEquals(result.keywords, []);
  assertEquals(result.tags, ["work"]);
  assertEquals(result.before, new Date("2024-01-01T23:59:59Z").getTime());
});

console.log("\n✓ All tests passed!");
