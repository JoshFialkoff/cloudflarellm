#!/bin/bash
echo "Testing health..."
curl -s https://smart-llm-router.forwardjump-com198.workers.dev/health | grep -q "ok" && echo "✅ Health OK" || echo "❌ Health FAILED"

echo "Testing chat..."
RESULT=$(curl -s -X POST https://smart-llm-router.forwardjump-com198.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Say hello"}]}')
echo "$RESULT" | grep -q "choices" && echo "✅ Chat OK" || echo "❌ Chat FAILED: $RESULT"

echo "Testing code execution..."
RESULT=$(curl -s -X POST https://smart-llm-router.forwardjump-com198.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Write JavaScript to calculate 2+2 and run it"}]}')
echo "$RESULT" | grep -q "code_execution" && echo "✅ Code execution OK" || echo "❌ Code execution FAILED: $RESULT"
