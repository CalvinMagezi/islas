import { cronJobs } from "convex/server";

const crons = cronJobs();

// Import internal API with type suppression — TS2589 (excessively deep type
// instantiation) occurs when Convex component types are deeply nested.
// @ts-ignore — TS2589
import { internal } from "./_generated/api";
// @ts-ignore — TS2589
const i: any = internal;

// Detect stuck jobs (>2hr) and offline workers (no heartbeat >30s)
crons.interval("health check", { minutes: 5 }, i.workflows.healthCheck.run);

// Clean up old completed/failed jobs + their logs (>7 days)
crons.interval("stale job cleanup", { hours: 1 }, i.workflows.healthCheck.cleanupStaleJobs);

// Read "Heartbeat" system note and dispatch as job if actionable
crons.interval("heartbeat processing", { minutes: 2 }, i.workflows.heartbeat.processHeartbeat);

// Expire stale approval requests (>expiresAt) every minute
crons.interval("expire approvals", { minutes: 1 }, i.functions.approvals.expirePendingApprovals);

// Daily memory consolidation — analyze recent notes and generate insights
crons.cron("daily memory consolidation", "0 3 * * *", i.workflows.memoryConsolidation.dailyConsolidate);

export default crons;
