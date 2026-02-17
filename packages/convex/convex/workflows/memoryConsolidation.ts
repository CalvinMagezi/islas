import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { internal } from "../_generated/api";

// Self-reference helper — memoryConsolidation won't exist in generated types
// until codegen runs. This cast breaks the circular inference.
const selfRef = (internal.workflows as any).memoryConsolidation as {
  getRecentNotes: any;
  getRecentInsights: any;
  storeInsight: any;
};

const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;
const INSIGHTS_NOTEBOOK_NAME = "Insights";
const MIN_NOTES_FOR_CONSOLIDATION = 3;

// ── Query: Get notes updated in the last N milliseconds ──────────────

export const getRecentNotes = internalQuery({
  args: { sinceMs: v.number() },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - args.sinceMs;
    const userId = "local-user";

    const notes = await ctx.db
      .query("notes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Filter to recent notes and limit to 50
    return notes
      .filter((n) => n.updatedAt >= cutoff)
      .slice(0, 50)
      .map((n) => ({
        id: n._id,
        title: n.title,
        content: n.content.substring(0, 500),
        tags: n.tags,
        noteType: n.noteType,
        notebookId: n.notebookId,
        updatedAt: n.updatedAt,
      }));
  },
});

// ── Query: Get existing insight notes for deduplication ───────────────

export const getRecentInsights = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = "local-user";
    // Find the Insights notebook
    const notebook = await ctx.db
      .query("notebooks")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", userId).eq("type", "system"),
      )
      .filter((q) => q.eq(q.field("name"), INSIGHTS_NOTEBOOK_NAME))
      .first();

    if (!notebook) return [];

    // Get last 10 insights
    return ctx.db
      .query("notes")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebook._id))
      .order("desc")
      .take(10);
  },
});

// ── Mutation: Store a generated insight ───────────────────────────────

export const storeInsight = internalMutation({
  args: {
    content: v.string(),
    date: v.string(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = "local-user";
    const now = Date.now();

    // Find or create "Insights" system notebook
    let notebook = await ctx.db
      .query("notebooks")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", userId).eq("type", "system"),
      )
      .filter((q) => q.eq(q.field("name"), INSIGHTS_NOTEBOOK_NAME))
      .first();

    if (!notebook) {
      const id = await ctx.db.insert("notebooks", {
        userId,
        name: INSIGHTS_NOTEBOOK_NAME,
        description: "Auto-generated insights from memory consolidation",
        tags: ["system", "insights"],
        type: "system",
        status: "active",
        color: "#8b5cf6", // Purple
        icon: "💡",
        generatedBy: "workflow",
        createdAt: now,
        updatedAt: now,
      });
      notebook = (await ctx.db.get(id))!;
    }

    // Insert insight note
    const noteId = await ctx.db.insert("notes", {
      notebookId: notebook._id,
      userId,
      title: `Daily Insights — ${args.date}`,
      content: args.content,
      tags: [...args.tags, "insight", "auto-generated"],
      noteType: "report",
      source: "memory-consolidation",
      generatedBy: "workflow",
      pinned: false,
      createdAt: now,
      updatedAt: now,
    });

    return { noteId, notebookId: notebook._id };
  },
});

// ── Action: Daily consolidation (cron target) ────────────────────────

export const dailyConsolidate = internalAction({
  args: {},
  handler: async (ctx) => {
    // 1. Get recent notes (last 24h)
    const recentNotes: Array<{
      id: string;
      title: string;
      content: string;
      tags: string[];
      noteType: string | undefined;
      notebookId: string;
      updatedAt: number;
    }> = await ctx.runQuery(
      selfRef.getRecentNotes,
      { sinceMs: TWENTY_FOUR_HOURS_MS },
    );

    if (recentNotes.length < MIN_NOTES_FOR_CONSOLIDATION) {
      console.log(
        `Memory consolidation: Only ${recentNotes.length} recent notes, skipping (need ${MIN_NOTES_FOR_CONSOLIDATION}+)`,
      );
      return { status: "skipped", reason: "not_enough_notes" };
    }

    // 2. Get existing insight summaries for context
    const existingInsights: Array<{ title: string; content: string }> = await ctx.runQuery(
      selfRef.getRecentInsights,
      {},
    );

    // 3. Build prompt for LLM
    const noteSummaries = recentNotes
      .map(
        (n, i) =>
          `[${i + 1}] "${n.title}" (tags: ${n.tags.join(", ")})\n${n.content}`,
      )
      .join("\n\n");

    const existingContext =
      existingInsights.length > 0
        ? `\n\nPrevious insights (avoid repeating):\n${existingInsights.map((ins) => `- ${ins.title}: ${ins.content.substring(0, 100)}`).join("\n")}`
        : "";

    const prompt = `You are the memory consolidation engine for Islas, an AI agent hub. Analyze the following ${recentNotes.length} notes from the last 24 hours and generate a brief insight report.

NOTES:
${noteSummaries}
${existingContext}

Generate a concise insight report with:
1. **Patterns**: Recurring themes or connections between notes
2. **Contradictions**: Any conflicting information found
3. **Key Takeaways**: 3-5 actionable insights or facts worth remembering
4. **Suggestions**: Recommendations for organizing or acting on this information

Be concise. Focus on connections between notes, not individual summaries. Format in markdown.`;

    // 4. Call OpenRouter LLM
    const apiKey = process.env.OPENROUTER_API_KEY;
    const model = process.env.DEFAULT_MODEL || "anthropic/claude-sonnet-4-5-20250929";

    if (!apiKey) {
      console.error("Memory consolidation: OPENROUTER_API_KEY not set");
      return { status: "error", reason: "no_api_key" };
    }

    let insightText: string;
    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error(`Memory consolidation LLM error: ${response.status} ${text}`);
        return { status: "error", reason: "llm_error" };
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      insightText = data.choices[0]?.message?.content || "";

      if (!insightText) {
        return { status: "error", reason: "empty_response" };
      }
    } catch (err: any) {
      console.error("Memory consolidation LLM call failed:", err.message);
      return { status: "error", reason: err.message };
    }

    // 5. Extract tags from note data
    const allTags = new Set<string>();
    for (const note of recentNotes) {
      for (const tag of note.tags) {
        allTags.add(tag);
      }
    }
    const topTags = Array.from(allTags).slice(0, 5);

    // 6. Store the insight
    const date = new Date().toISOString().split("T")[0];
    await ctx.runMutation(
      selfRef.storeInsight,
      { content: insightText, date, tags: topTags },
    );

    console.log(
      `✨ Memory consolidation complete: analyzed ${recentNotes.length} notes, generated insight for ${date}`,
    );

    return {
      status: "completed",
      notesAnalyzed: recentNotes.length,
      date,
    };
  },
});
