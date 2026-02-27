#!/usr/bin/env bun
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

console.log("🌱 Starting Oakstone POC Data Seeding...");

// Change to the convex package directory
const convexDir = path.join(__dirname, "../packages/convex");

if (!fs.existsSync(convexDir)) {
    console.error("❌ Error: packages/convex directory not found.");
    process.exit(1);
}

try {
    console.log("Running Convex mutation `functions/seed:seedOakstone`...");
    // Admin key authentication allows running internal functions
    execSync("bunx convex run functions/seed:seedOakstone", {
        cwd: convexDir,
        stdio: "inherit",
    });
    console.log("✅ Seed complete! Mock deals and documents have been inserted into the database.");
} catch (error) {
    console.error("❌ Failed to run seed mutation:", error);
    process.exit(1);
}
