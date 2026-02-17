#!/bin/bash
# Initialize system files one at a time

CONVEX_URL="https://shiny-dotterel-141.convex.cloud"
CLAWD_DIR="/Users/calvinmagezi/clawd"

cd "/Users/calvinmagezi/Documents/Side Projects/islas"

echo "Creating system files in production..."

# Function to escape JSON string
escape_json() {
  local str="$1"
  str="${str//\\/\\\\}"
  str="${str//\"/\\\"}"
  str="${str//$'\n'/\\n}"
  str="${str//$'\r'/\\r}"
  str="${str//$'\t'/\\t}"
  echo "$str"
}

# Create soul
echo "Creating soul..."
CONTENT=$(cat "$CLAWD_DIR/SOUL.md" | sed 's/"/\\"/g' | sed 's/\\n/\\\\n/g' | tr '\n' ' ')
npx convex run --prod systemFiles:write "{\"userId\": \"default\", \"name\": \"soul\", \"title\": \"SOUL.md - Who I Am\", \"content\": \"$CONTENT\", \"description\": \"My personality and boundaries\", \"changeSummary\": \"Initial creation\"}"

echo "Done! Verify at: https://islas.vercel.app/system"
