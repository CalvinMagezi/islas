/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const CLAWD_DIR = "/Users/calvinmagezi/clawd";

const files = [
  {
    name: "soul",
    title: "SOUL.md - Who I Am",
    fileName: "SOUL.md",
    description: "My personality, boundaries, and core truths"
  },
  {
    name: "identity", 
    title: "IDENTITY.md - Platform Metadata",
    fileName: "IDENTITY.md",
    description: "Name, platform, and basic metadata"
  },
  {
    name: "tools",
    title: "TOOLS.md - Environment Notes", 
    fileName: "TOOLS.md",
    description: "Environment-specific tool notes and preferences"
  },
  {
    name: "heartbeat",
    title: "HEARTBEAT.md - Monitoring Configuration",
    fileName: "HEARTBEAT.md",
    description: "Proactive monitoring and alert configuration"
  },
  {
    name: "memory",
    title: "MEMORY.md - Long-Term Memory",
    fileName: "MEMORY.md",
    description: "Curated long-term memories and learnings"
  }
];

const filesToCreate = files.map(f => {
  const content = fs.readFileSync(path.join(CLAWD_DIR, f.fileName), 'utf-8');
  return {
    name: f.name,
    title: f.title,
    content: content,
    description: f.description
  };
});

console.log(JSON.stringify({ userId: "default", files: filesToCreate }));
