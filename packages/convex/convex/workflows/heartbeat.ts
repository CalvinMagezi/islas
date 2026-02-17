import { internalMutation } from "../_generated/server";

const HEADER = "# Heartbeat";
const PLACEHOLDER = "_Add tasks below. HQ checks every 2 minutes and dispatches actionable items._";
const LOG_HEADING = "## Recently Processed";
const MAX_LOG_ENTRIES = 5;

/**
 * Runs every 2 minutes via cron.
 * Reads the "Heartbeat" system note. Any text written between the
 * placeholder and the "## Recently Processed" section is treated as
 * a pending task. Once dispatched, the task is moved to the log.
 */
export const processHeartbeat = internalMutation({
  args: {},
  handler: async (ctx) => {
    const userId = "local-user";
    const now = Date.now();

    // 1. Find the "System Notes" notebook
    const notebook = await ctx.db
      .query("notebooks")
      .withIndex("by_user_type", (q) =>
        q.eq("userId", userId).eq("type", "system")
      )
      .first();

    if (!notebook) {
      return { status: "HEARTBEAT_SKIP", reason: "No system notebook" };
    }

    // 2. Find the "Heartbeat" note
    const heartbeatNote = await ctx.db
      .query("notes")
      .withIndex("by_notebook", (q) => q.eq("notebookId", notebook._id))
      .filter((q) => q.eq(q.field("title"), "Heartbeat"))
      .first();

    if (!heartbeatNote) {
      return { status: "HEARTBEAT_SKIP", reason: "No heartbeat note" };
    }

    // 3. Parse the note into sections
    const raw = heartbeatNote.content;

    // Split off the log section if it exists
    const logSplitIndex = raw.indexOf(LOG_HEADING);
    const taskSection =
      logSplitIndex >= 0 ? raw.slice(0, logSplitIndex) : raw;
    const existingLog =
      logSplitIndex >= 0 ? raw.slice(logSplitIndex + LOG_HEADING.length) : "";

    // Extract actionable content (strip headings, placeholder, whitespace)
    const pendingText = taskSection
      .replace(/^#+\s+.*$/gm, "") // headings
      .replace(/^---+$/gm, "") // horizontal rules
      .replace(/_Add tasks below.*_/g, "") // placeholder
      .replace(/_Add actionable tasks here.*_/g, "") // old placeholder
      .trim();

    if (pendingText.length < 10) {
      return { status: "HEARTBEAT_OK", reason: "No actionable content" };
    }

    // 4. Check for an online + idle worker
    const sessions = await ctx.db.query("agentSessions").collect();
    const idleWorker = sessions.find((s) => s.status === "online");

    if (!idleWorker) {
      return {
        status: "HEARTBEAT_SKIP",
        reason: "No idle worker available",
      };
    }

    // 5. Dispatch as a background job
    await ctx.db.insert("agentJobs", {
      userId,
      instruction: `[HEARTBEAT] ${pendingText}`,
      type: "background",
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    // 6. Update the note: clear pending area, add to log
    const timestamp = new Date(now).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // Parse existing log entries and keep only the latest ones
    const existingEntries = existingLog
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .slice(0, MAX_LOG_ENTRIES - 1);

    const newEntry = `- **${timestamp}**: ${pendingText.split("\n")[0].slice(0, 80)}`;
    const logEntries = [newEntry, ...existingEntries];

    const updatedContent = [
      HEADER,
      "",
      PLACEHOLDER,
      "",
      "",
      LOG_HEADING,
      ...logEntries,
      "",
    ].join("\n");

    await ctx.db.patch(heartbeatNote._id, {
      content: updatedContent,
      updatedAt: now,
    });

    return { status: "HEARTBEAT_DISPATCHED" };
  },
});
