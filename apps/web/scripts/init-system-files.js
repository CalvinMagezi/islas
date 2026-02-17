/* eslint-disable @typescript-eslint/no-require-imports */
// Initialize system files in islas (PRODUCTION)
// Usage: node scripts/init-system-files.js

const fs = require('fs');
const path = require('path');

// Production MCP endpoint (using site URL like dev)
const API_URL = "https://shiny-dotterel-141.convex.site/mcp";
const API_KEY = "chq_c9db7a55958e2a1e264b416c26be2df7aa884a1d5f7f08dc04b20f894de02c93";

// Read files from clawd directory
const CLAWD_DIR = "/Users/calvinmagezi/clawd";

const filesToCreate = [
  {
    name: "soul",
    title: "SOUL.md - Who I Am",
    fileName: "SOUL.md",
    description: "My personality, boundaries, and core truths"
  },
  {
    name: "memory",
    title: "MEMORY.md - Long-Term Memory",
    fileName: "MEMORY.md",
    description: "Curated long-term memories and learnings"
  },
  {
    name: "identity",
    title: "IDENTITY.md - Platform Metadata",
    fileName: "IDENTITY.md",
    description: "Name, platform, and basic metadata"
  },
  {
    name: "heartbeat",
    title: "HEARTBEAT.md - Monitoring Configuration",
    fileName: "HEARTBEAT.md",
    description: "Proactive monitoring and alert configuration"
  },
  {
    name: "tools",
    title: "TOOLS.md - Environment Notes",
    fileName: "TOOLS.md",
    description: "Environment-specific tool notes and preferences"
  }
];

async function createSystemFile(fileConfig) {
  const filePath = path.join(CLAWD_DIR, fileConfig.fileName);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipping ${fileConfig.name}: file not found at ${filePath}`);
    return null;
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  
  const payload = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: {
      name: "systemFile_write",
      arguments: {
        name: fileConfig.name,
        title: fileConfig.title,
        content: content,
        description: fileConfig.description,
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
      console.error(`❌ Failed to create ${fileConfig.name}:`, result.error.message);
      return null;
    }
    
    console.log(`✅ Created: ${fileConfig.name} (${content.length} characters)`);
    return result;
  } catch (error) {
    console.error(`❌ Error creating ${fileConfig.name}:`, error.message);
    return null;
  }
}

async function main() {
  console.log("=== Initializing Islas System Files ===\n");
  
  for (const fileConfig of filesToCreate) {
    await createSystemFile(fileConfig);
  }
  
  console.log("\n=== Done ===");
  console.log("Visit /system to view the files once Vercel deploys.");
}

main();
