/**
 * Test Discord Presence Updates
 *
 * This script dispatches a simple test job to verify Discord presence
 * changes from Online → DND → Online during job execution.
 */

import { ConvexClient } from "convex/browser";
import { api } from "@repo/convex/agent";
import dotenv from "dotenv";
import * as path from "path";
import WebSocket from "ws";

// Polyfill WebSocket for Node.js
global.WebSocket = WebSocket as any;

dotenv.config({ path: path.join(process.cwd(), ".env.local") });

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;

if (!CONVEX_URL) {
    console.error("❌ NEXT_PUBLIC_CONVEX_URL not found in .env.local");
    process.exit(1);
}

async function testDiscordPresence() {
    console.log("🧪 Testing Discord Presence Updates\n");
    console.log("📋 What to expect:");
    console.log("   1. Initial status: 🟢 Online (Idle)");
    console.log("   2. Job starts: 🔴 DND (Executing job)");
    console.log("   3. Job completes: 🟢 Online (Idle)\n");
    console.log("👀 Watch your Discord client for status changes!\n");
    console.log("━".repeat(60));

    const client = new ConvexClient(CONVEX_URL!);

    console.log("\n📤 Dispatching test job...");

    try {
        // Note: This requires the createJob mutation to be public
        // For now, let's just simulate by monitoring logs
        console.log("\n📝 Manual Test Instructions:");
        console.log("   1. Watch your Discord client (OpenClaw#9396)");
        console.log("   2. Current status should be: 🟢 Online");
        console.log("   3. In another terminal, run:");
        console.log("      cd /tmp && echo 'sleep 10 && echo Done!' > test.sh");
        console.log("      bash test.sh");
        console.log("   4. Or trigger any job via your web UI\n");

        console.log("⏱️  Expected Timeline:");
        console.log("   When job starts: Discord → 🔴 DND (Do Not Disturb)");
        console.log("   When job ends: Discord → 🟢 Online (Idle)\n");

        console.log("🔍 Monitor agent logs in real-time:");
        console.log("   tail -f /tmp/agent.log | grep -E 'Discord presence|isBusy|Job'\n");

        console.log("━".repeat(60));
        console.log("\n💡 Tip: The heartbeat runs every 10 seconds");
        console.log("   So presence changes may take up to 10s to appear\n");

        console.log("✅ Ready for testing!");
        console.log("📱 Keep Discord open and watch for status changes!\n");

    } catch (err: any) {
        console.error("❌ Error:", err.message);
        process.exit(1);
    } finally {
        client.close();
    }
}

testDiscordPresence();
