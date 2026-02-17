import { internalMutation } from "../_generated/server";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const HEARTBEAT_TIMEOUT_MS = 30_000;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 100;

/**
 * Runs every 5 minutes.
 * 1. Marks running jobs as failed if they've exceeded the 2-hour timeout.
 * 2. Marks non-offline worker sessions as offline if no heartbeat for 30s.
 */
export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // 1. Detect stuck running jobs
    const runningJobs = await ctx.db
      .query("agentJobs")
      .withIndex("by_status", (q) => q.eq("status", "running"))
      .collect();

    let stuckJobCount = 0;
    for (const job of runningJobs) {
      if (now - job.updatedAt > TWO_HOURS_MS) {
        await ctx.db.patch(job._id, {
          status: "failed",
          updatedAt: now,
        });
        await ctx.db.insert("jobLogs", {
          jobId: job._id,
          type: "error",
          content:
            "Marked failed by health check: exceeded 2-hour timeout",
          timestamp: now,
        });
        stuckJobCount++;
      }
    }

    // 2. Detect offline workers
    const allSessions = await ctx.db.query("agentSessions").collect();

    let offlineCount = 0;
    for (const session of allSessions) {
      if (
        session.status !== "offline" &&
        now - session.lastHeartbeat > HEARTBEAT_TIMEOUT_MS
      ) {
        await ctx.db.patch(session._id, { status: "offline" });
        offlineCount++;
      }
    }

    return {
      stuckJobsMarkedFailed: stuckJobCount,
      workersMarkedOffline: offlineCount,
    };
  },
});

/**
 * Runs every hour.
 * Deletes completed/failed jobs older than 7 days along with their logs.
 */
export const cleanupStaleJobs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const cutoff = now - SEVEN_DAYS_MS;

    // Find stale done jobs
    const doneJobs = await ctx.db
      .query("agentJobs")
      .withIndex("by_status", (q) => q.eq("status", "done"))
      .filter((q) => q.lt(q.field("updatedAt"), cutoff))
      .take(CLEANUP_BATCH_SIZE);

    // Find stale failed jobs
    const failedJobs = await ctx.db
      .query("agentJobs")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .filter((q) => q.lt(q.field("updatedAt"), cutoff))
      .take(CLEANUP_BATCH_SIZE);

    const staleJobs = [...doneJobs, ...failedJobs].slice(
      0,
      CLEANUP_BATCH_SIZE
    );

    let deletedJobs = 0;
    let deletedLogs = 0;

    for (const job of staleJobs) {
      // Delete all logs for this job
      const logs = await ctx.db
        .query("jobLogs")
        .withIndex("by_job", (q) => q.eq("jobId", job._id))
        .collect();

      for (const log of logs) {
        await ctx.db.delete(log._id);
        deletedLogs++;
      }

      // Delete the job itself
      await ctx.db.delete(job._id);
      deletedJobs++;
    }

    return { deletedJobs, deletedLogs };
  },
});
