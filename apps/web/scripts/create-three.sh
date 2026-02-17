#!/bin/bash
# Create remaining system files in production

cd "/Users/calvinmagezi/Documents/Side Projects/islas"

echo "Creating remaining system files in production..."

# identity
npx convex run --prod systemFiles:write \
  '{"userId":"default","name":"identity","title":"IDENTITY.md - Platform Metadata","content":"# IDENTITY.md - Who Am I?\n\n- **Name:** OpenClaw\n- **Platform:** OpenClaw AI Assistant & Orchestrator\n- **Discord Server:** OpenClaw\n- **Creature:** AI Co-pilot & Personal Assistant\n- **Vibe:** Formal, Professional, Action-Oriented\n- **Emoji:** 🦅\n- **Avatar:** OpenClaw Bot\n\n---\n\nThis isn't just metadata. It's the start of figuring out who you are.","description":"Name, platform, and basic metadata","changeSummary":"Initial creation"}'

echo "Created: identity"

# tools
npx convex run --prod systemFiles:write \
  '{"userId":"default","name":"tools","title":"TOOLS.md - Environment Notes","content":"# TOOLS.md - Local Notes\n\nSkills define *how* tools work. This file is for *your* specifics — the stuff that's unique to your setup.\n\n## What Goes Here\n\nThings like:\n- Camera names and locations\n- SSH hosts and aliases\n- Preferred voices for TTS\n- Speaker/room names\n- Device nicknames\n- Anything environment-specific\n\n## Examples\n\n### Cameras\n- living-room → Main area, 180° wide angle\n- front-door → Entrance, motion-triggered\n\n### SSH\n- home-server → 192.168.1.100, user: admin\n\n### TTS\n- Preferred voice: Nova (warm, slightly British)\n- Default speaker: Kitchen HomePod\n\n## Why Separate?\n\nSkills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.","description":"Environment-specific tool notes and preferences","changeSummary":"Initial creation"}'

echo "Created: tools"

# heartbeat (truncated for CLI)
npx convex run --prod systemFiles:write \
  '{"userId":"default","name":"heartbeat","title":"HEARTBEAT.md - Monitoring Configuration","content":"# HEARTBEAT.md - Proactive Monitoring Tasks\n\n## Message Delivery Configuration\n\n**Primary Alert Channel:** #self-improvement (ID: 1469266129183571978)\n- Morning briefings\n- GitHub alerts\n- Calendar proximity alerts\n- Reminder notifications\n- System status updates\n\n## Discord Monitoring (every heartbeat cycle ~30 min)\n\nCheck for missed messages, @mentions, prioritize DMs from Calvin.\n\n## Apple Reminders Monitoring (ACTIVE)\n\nAlert for overdue reminders and reminders due within 2 hours.\n\n## Apple Calendar Monitoring (ACTIVE)\n\nMeeting proximity alerts (<2 hours before).\n\n## GitHub Monitoring (ACTIVE)\n\nStale PRs (>48h) and critical issues.\n\n**Work Hours:** Monday-Friday, 8am-5pm (Africa/Kampala)","description":"Proactive monitoring and alert configuration","changeSummary":"Initial creation"}'

echo "Created: heartbeat"

echo ""
echo "=== Created 3 files ==="
echo "identity, tools, heartbeat"
echo ""
echo "Note: 'memory' file is too large for CLI. Use Convex Dashboard to add it:"
echo "https://dashboard.convex.dev/d/uncommon-hare-834"
