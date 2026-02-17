/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const API_URL = "https://shiny-dotterel-141.convex.cloud/api/mcp";
const API_KEY = "chq_c9db7a55958e2a1e264b416c26be2df7aa884a1d5f7f08dc04b20f894de02c93";
const CLAWD_DIR = "/Users/calvinmagezi/clawd";

async function createFile(name, title, fileName, description) {
  const content = fs.readFileSync(path.join(CLAWD_DIR, fileName), 'utf-8');
  
  const payload = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "systemFile_write",
      arguments: {
        name: name,
        title: title,
        content: content,
        description: description,
        changeSummary: "Initial import from filesystem"
      }
    },
    id: 1
  };
  
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (result.error) {
      console.error(`❌ ${name}: ${result.error.message}`);
      return false;
    }
    console.log(`✅ Created: ${name} (${content.length} chars)`);
    return true;
  } catch (e) {
    console.error(`❌ ${name}: ${e.message}`);
    return false;
  }
}

async function main() {
  console.log("Creating remaining system files...\n");
  
  await createFile("identity", "IDENTITY.md - Platform Metadata", "IDENTITY.md", "Name, platform, and basic metadata");
  await createFile("tools", "TOOLS.md - Environment Notes", "TOOLS.md", "Environment-specific tool notes and preferences");
  await createFile("heartbeat", "HEARTBEAT.md - Monitoring Configuration", "HEARTBEAT.md", "Proactive monitoring and alert configuration");
  await createFile("memory", "MEMORY.md - Long-Term Memory", "MEMORY.md", "Curated long-term memories and learnings");
  
  console.log("\n✅ All files created!");
}

main();
