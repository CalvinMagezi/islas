/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CLAWD_DIR = "/Users/calvinmagezi/clawd";

const files = [
  { name: "identity", title: "IDENTITY.md - Platform Metadata", file: "IDENTITY.md", desc: "Name, platform, and basic metadata" },
  { name: "tools", title: "TOOLS.md - Environment Notes", file: "TOOLS.md", desc: "Environment-specific tool notes" },
  { name: "heartbeat", title: "HEARTBEAT.md - Monitoring Configuration", file: "HEARTBEAT.md", desc: "Proactive monitoring configuration" },
  { name: "memory", title: "MEMORY.md - Long-Term Memory", file: "MEMORY.md", desc: "Curated long-term memories" },
];

console.log("Creating remaining system files...\n");

for (const f of files) {
  const content = fs.readFileSync(path.join(CLAWD_DIR, f.file), 'utf-8');
  
  const payload = JSON.stringify({
    userId: "default",
    name: f.name,
    title: f.title,
    content: content,
    description: f.desc,
    changeSummary: "Initial creation"
  });
  
  try {
    execSync(`cd "/Users/calvinmagezi/Documents/Side Projects/islas" && npx convex run --prod systemFiles:write '${payload.replace(/'/g, "'\"'\"'")}'`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    console.log(`✅ Created: ${f.name}`);
  } catch (e) {
    console.error(`❌ Failed: ${f.name} - ${e.message}`);
  }
}

console.log("\nDone!");
