#!/bin/bash
# Test compiler with Python Hello World via self-hosted Judge0

echo "🧪 Testing Sociofest Compiler (Judge0 local)..."

# Test 1: JS (local sandbox)
echo "1. JavaScript (local sandbox):"
curl -s -X POST http://localhost:3001/api/compiler/compile \
  -H "Content-Type: application/json" \
  -d '{
    "language": "javascript",
    "code": "console.log(\"JS OK\");",
    "stdin": "",
    "rapidApiKey": "test"
  }' | jq '.stdout' | head -1

# Test 2: Python (Judge0 local - update backend URL for test)
echo -e "\n2. Python (self-hosted Judge0):"
# Note: Update backend controller temp URL to http://host.docker.internal:2358/submissions
curl -s -X POST http://localhost:3001/api/compiler/compile \
  -H "Content-Type: application/json" \
  -d '{
    "language": "python",
    "code": "print(\"Python OK\")",
    "stdin": "",
    "rapidApiKey": "local-test"
  }' | jq '.stdout'

echo -e "\n✅ Run: docker compose -f server/docker-compose.compiler-test.yml up -d"
echo "🔧 For local Judge0: Backend needs temp config change to use localhost:2358"

