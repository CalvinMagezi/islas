
import { ConvexClient } from "convex/browser";
import { api } from "@repo/convex/agent";
import dotenv from "dotenv";
import * as path from "path";

// Load env from apps/agent/.env.local
dotenv.config({ path: path.join(__dirname, "../.env.local") });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const API_KEY = process.env.ISLAS_API_KEY;

if (!CONVEX_URL || !API_KEY) {
    console.error("Missing env vars");
    process.exit(1);
}

const client = new ConvexClient(CONVEX_URL);

async function main() {
    console.log("Injecting test job...");
    const jobId = await client.mutation(api.agent.createJob, {
        instruction: "Calculate 2 + 2 and explain your reasoning.", // Simple task
        type: "background",
        apiKey: API_KEY
    });
    console.log(`Job created: ${jobId}`);
}

main().catch(console.error);
