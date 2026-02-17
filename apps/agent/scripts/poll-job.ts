
import { ConvexClient } from "convex/browser";
import { api } from "@repo/convex/agent";
import dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env.local") });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const API_KEY = process.env.ISLAS_API_KEY;

if (!CONVEX_URL || !API_KEY) process.exit(1);

const client = new ConvexClient(CONVEX_URL);
const JOB_ID: any = "md7a4enh6ab2gk7szqejeh3cqd80wzcv";

async function main() {
    console.log(`Polling job ${JOB_ID}...`);
    let attempts = 0;
    while (attempts < 30) {
        // We need a way to get job status. 
        // We can't query by ID directly without a custom query.
        // But we can invoke `getPendingJob` or check logs? No.
        // Let's rely on agent logs instead.
        // Or cleaner: modify agent.ts to add `getJob` query.
        // But we don't want to modify backend for testing script too much.

        // Actually, we can use `api.agent.getPendingJob` and see if it returns it?
        // If it returns it, it's pending. If not, it's done (or doesn't exist).
        // But getPendingJob only returns *valid* pending jobs.

        console.log("Waiting...");
        await new Promise(r => setTimeout(r, 1000));
        attempts++;
    }
}
// Abort script.
console.log("Use agent logs.");
