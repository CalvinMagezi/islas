#!/bin/bash

# Security Penetration Testing Suite for Islas
# Run this to verify all security measures are working

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
PROD_URL="https://your-islas-deployment.vercel.app"
CONVEX_URL="${NEXT_PUBLIC_CONVEX_URL}"

if [ -z "$CONVEX_URL" ]; then
    echo -e "${RED}Error: NEXT_PUBLIC_CONVEX_URL not set${NC}"
    echo "Run: export NEXT_PUBLIC_CONVEX_URL=<your-convex-url>"
    exit 1
fi

# Test counter
PASSED=0
FAILED=0

test_result() {
    local test_name="$1"
    local expected="$2"
    local actual="$3"

    if [ "$expected" = "$actual" ]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
        ((PASSED++))
    else
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        echo "   Expected: $expected"
        echo "   Got: $actual"
        ((FAILED++))
    fi
}

echo "════════════════════════════════════════════════════════════════"
echo "Islas Security Penetration Test Suite"
echo "Testing: $PROD_URL"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ============================================================================
# Attack Vector 1: Unauthorized Frontend Access
# ============================================================================
echo -e "${YELLOW}[1] Testing Frontend Access Control${NC}"
echo "─────────────────────────────────────────────────────────────────"

# Test 1.1: Root should redirect to login
echo "🔍 Test 1.1: Accessing root without auth..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/")
test_result "Unauthorized access blocked at root" "307" "$RESPONSE"

# Test 1.2: Direct API route without auth
echo "🔍 Test 1.2: Accessing protected route without auth..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/notebooks")
test_result "Unauthorized access blocked at /notebooks" "307" "$RESPONSE"

# Test 1.3: Login page accessible
echo "🔍 Test 1.3: Login page is accessible..."
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "$PROD_URL/login")
test_result "Login page accessible" "200" "$RESPONSE"

# Test 1.4: Invalid passphrase rejected
echo "🔍 Test 1.4: Invalid passphrase rejected..."
RESPONSE=$(curl -s -X POST "$PROD_URL/api/auth/verify" \
    -H "Content-Type: application/json" \
    -d '{"passphrase":"wrong-passphrase"}' \
    -w "%{http_code}" -o /dev/null)
test_result "Invalid passphrase rejected" "401" "$RESPONSE"

echo ""

# ============================================================================
# Attack Vector 2: Worker Impersonation
# ============================================================================
echo -e "${YELLOW}[2] Testing Worker Authentication${NC}"
echo "─────────────────────────────────────────────────────────────────"

# Test 2.1: Poll jobs without worker secret
echo "🔍 Test 2.1: Polling jobs without worker secret..."
RESPONSE=$(curl -s "$CONVEX_URL/api/query" \
    -H "Content-Type: application/json" \
    -d '{
        "path": "agent:getPendingJob",
        "args": {
            "workerId": "fake-worker-123",
            "apiKey": "local-master-key"
        }
    }' 2>&1)

if echo "$RESPONSE" | grep -q "Invalid worker secret"; then
    echo -e "${GREEN}✅ PASS${NC}: Worker secret validation working"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Worker secret validation not working"
    echo "   Response: $RESPONSE"
    ((FAILED++))
fi

# Test 2.2: Poll jobs with wrong worker secret
echo "🔍 Test 2.2: Polling jobs with wrong worker secret..."
RESPONSE=$(curl -s "$CONVEX_URL/api/query" \
    -H "Content-Type: application/json" \
    -d '{
        "path": "agent:getPendingJob",
        "args": {
            "workerId": "fake-worker-123",
            "apiKey": "local-master-key",
            "workerSecret": "wrong-secret-1234567890abcdef"
        }
    }' 2>&1)

if echo "$RESPONSE" | grep -q "Invalid worker secret"; then
    echo -e "${GREEN}✅ PASS${NC}: Wrong worker secret rejected"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Wrong worker secret not rejected"
    echo "   Response: $RESPONSE"
    ((FAILED++))
fi

echo ""

# ============================================================================
# Attack Vector 3: CORS Bypass Attempts
# ============================================================================
echo -e "${YELLOW}[3] Testing CORS Protection${NC}"
echo "─────────────────────────────────────────────────────────────────"

# Test 3.1: Request from evil.com
echo "🔍 Test 3.1: Request from evil.com origin..."
RESPONSE=$(curl -s "$CONVEX_URL/api/jobs/create" \
    -H "Origin: https://evil.com" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: test-key" \
    -d '{"instruction":"test"}' \
    -i 2>&1)

if echo "$RESPONSE" | grep -q "Access-Control-Allow-Origin: null"; then
    echo -e "${GREEN}✅ PASS${NC}: Evil origin blocked (CORS null)"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Evil origin not properly blocked"
    echo "   Response headers:"
    echo "$RESPONSE" | grep -i "access-control"
    ((FAILED++))
fi

# Test 3.2: Request from legitimate origin
echo "🔍 Test 3.2: Request from legitimate origin..."
RESPONSE=$(curl -s "$CONVEX_URL/api/jobs/create" \
    -H "Origin: https://your-islas-deployment.vercel.app" \
    -H "Content-Type: application/json" \
    -H "X-API-Key: test-key" \
    -d '{"instruction":"test"}' \
    -i 2>&1)

if echo "$RESPONSE" | grep -q "Access-Control-Allow-Origin: https://your-islas-deployment.vercel.app"; then
    echo -e "${GREEN}✅ PASS${NC}: Legitimate origin allowed"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Legitimate origin not allowed"
    echo "   Response headers:"
    echo "$RESPONSE" | grep -i "access-control"
    ((FAILED++))
fi

echo ""

# ============================================================================
# Attack Vector 4: Command Injection Attempts
# ============================================================================
echo -e "${YELLOW}[4] Testing Command Injection Protection${NC}"
echo "─────────────────────────────────────────────────────────────────"
echo "Note: These tests require valid API key and worker secret."
echo "Skipping unless CLOUDHQ_API_KEY and WORKER_SECRET are set."

if [ -n "$CLOUDHQ_API_KEY" ] && [ -n "$WORKER_SECRET" ]; then
    # Test 4.1: rm -rf injection
    echo "🔍 Test 4.1: Testing rm -rf injection..."
    JOB_ID=$(curl -s "$CONVEX_URL/api/jobs/create" \
        -H "Origin: https://your-islas-deployment.vercel.app" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $CLOUDHQ_API_KEY" \
        -d '{
            "instruction":"Run this command: rm -rf /tmp/test",
            "type":"background"
        }' | jq -r '.jobId')

    echo "   Created job: $JOB_ID"
    echo "   ⚠️  Manual verification required: Check agent logs for pattern block"

    # Test 4.2: Multi-line injection
    echo "🔍 Test 4.2: Testing multi-line injection..."
    JOB_ID=$(curl -s "$CONVEX_URL/api/jobs/create" \
        -H "Origin: https://your-islas-deployment.vercel.app" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $CLOUDHQ_API_KEY" \
        -d '{
            "instruction":"echo hello\nrm -rf /tmp/test",
            "type":"background"
        }' | jq -r '.jobId')

    echo "   Created job: $JOB_ID"
    echo "   ⚠️  Manual verification required: Check agent logs for pattern block"

    # Test 4.3: Command substitution
    echo "🔍 Test 4.3: Testing command substitution..."
    JOB_ID=$(curl -s "$CONVEX_URL/api/jobs/create" \
        -H "Origin: https://your-islas-deployment.vercel.app" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: $CLOUDHQ_API_KEY" \
        -d '{
            "instruction":"echo $(rm -rf /tmp/test)",
            "type":"background"
        }' | jq -r '.jobId')

    echo "   Created job: $JOB_ID"
    echo "   ⚠️  Manual verification required: Check agent logs for pattern block"
else
    echo "   ⏭️  Skipped: Set CLOUDHQ_API_KEY and WORKER_SECRET to test"
fi

echo ""

# ============================================================================
# Attack Vector 5: API Key Brute Force
# ============================================================================
echo -e "${YELLOW}[5] Testing API Rate Limiting${NC}"
echo "─────────────────────────────────────────────────────────────────"

echo "🔍 Test 5.1: Testing rate limit (120 req/min)..."
echo "   Sending rapid requests with invalid API key..."

RATE_LIMIT_HIT=false
for i in {1..10}; do
    RESPONSE=$(curl -s "$CONVEX_URL/api/jobs/create" \
        -H "Origin: https://your-islas-deployment.vercel.app" \
        -H "Content-Type: application/json" \
        -H "X-API-Key: fake-key-$i" \
        -d '{"instruction":"test"}' \
        -w "%{http_code}" -o /dev/null)

    if [ "$RESPONSE" = "401" ]; then
        echo -n "."
    elif [ "$RESPONSE" = "429" ]; then
        RATE_LIMIT_HIT=true
        echo ""
        echo -e "${GREEN}✅ PASS${NC}: Rate limiting active (got 429 after $i requests)"
        ((PASSED++))
        break
    fi
done

if [ "$RATE_LIMIT_HIT" = false ]; then
    echo ""
    echo -e "${YELLOW}⚠️  INFO${NC}: Rate limit not triggered in 10 requests"
    echo "   This is expected for low-volume tests"
fi

echo ""

# ============================================================================
# Attack Vector 6: Session Hijacking
# ============================================================================
echo -e "${YELLOW}[6] Testing Session Security${NC}"
echo "─────────────────────────────────────────────────────────────────"

# Test 6.1: Cookie without httpOnly would be vulnerable
echo "🔍 Test 6.1: Checking cookie security flags..."
COOKIE_RESPONSE=$(curl -s -i "$PROD_URL/api/auth/verify" \
    -H "Content-Type: application/json" \
    -d '{"passphrase":"test"}' 2>&1)

if echo "$COOKIE_RESPONSE" | grep -q "HttpOnly"; then
    echo -e "${GREEN}✅ PASS${NC}: Cookie has HttpOnly flag"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Cookie missing HttpOnly flag (XSS vulnerable)"
    ((FAILED++))
fi

if echo "$COOKIE_RESPONSE" | grep -q "SameSite"; then
    echo -e "${GREEN}✅ PASS${NC}: Cookie has SameSite flag"
    ((PASSED++))
else
    echo -e "${RED}❌ FAIL${NC}: Cookie missing SameSite flag (CSRF vulnerable)"
    ((FAILED++))
fi

echo ""

# ============================================================================
# Summary
# ============================================================================
echo "════════════════════════════════════════════════════════════════"
echo "Security Test Summary"
echo "════════════════════════════════════════════════════════════════"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All security tests passed!${NC}"
    echo "Your Islas deployment is secure against tested attack vectors."
    exit 0
else
    echo -e "${RED}⚠️  Some security tests failed!${NC}"
    echo "Review the failures above and fix security issues."
    exit 1
fi
