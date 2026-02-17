#!/bin/bash

# Test OpenClaw Streaming Implementation
# This script tests the streaming endpoint directly

ENDPOINT="http://localhost:3000/api/openclaw/stream"
THREAD_ID="test_thread_123"

echo "🧪 Testing OpenClaw Streaming Endpoint"
echo "========================================"
echo ""
echo "Endpoint: $ENDPOINT"
echo "Thread ID: $THREAD_ID"
echo ""

# Test 1: Simple streaming request
echo "📤 Sending test message..."
echo ""

curl -N -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"threadId\": \"$THREAD_ID\",
    \"content\": \"Say hello and count to 5 slowly\"
  }" 2>/dev/null | while IFS= read -r line; do
  if [[ $line == data:* ]]; then
    # Extract JSON from SSE data line
    json="${line#data: }"
    
    # Parse type and content using grep/sed (no jq dependency)
    type=$(echo "$json" | grep -o '"type":"[^"]*"' | cut -d':' -f2 | tr -d '"')
    content=$(echo "$json" | grep -o '"content":"[^"]*"' | cut -d':' -f2- | sed 's/^"//;s/"$//')
    
    if [ "$type" = "chunk" ]; then
      echo -n "."
    elif [ "$type" = "done" ]; then
      echo ""
      echo ""
      echo "✅ Stream completed!"
      echo "Final content: $content"
    elif [ "$type" = "error" ]; then
      echo ""
      echo "❌ Stream error: $content"
      exit 1
    fi
  fi
done

echo ""
echo "========================================"
echo "✅ Test complete!"
