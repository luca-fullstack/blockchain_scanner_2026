#!/bin/bash
# API Test - Blockchain Scanner Backend
# Usage: bash test-api.sh [port]

BASE="http://localhost:${1:-2010}"
H='-H "Content-Type: application/json" -H "client-key: Multichain_Mining" -H "client-name: Multichain_Mining"'

echo "=== Health Check ==="
curl -s "$BASE/api/health" | python -m json.tool 2>/dev/null || curl -s "$BASE/api/health"
echo -e "\n"

echo "=== Missing client-key (expect 403) ==="
curl -s -X POST "$BASE/api/scan/start" -H "Content-Type: application/json" -d '{}'
echo -e "\n"

echo "=== Invalid mode (expect 400) ==="
curl -s -X POST "$BASE/api/scan/start" \
  -H "Content-Type: application/json" \
  -H "client-key: Multichain_Mining" \
  -H "client-name: Multichain_Mining" \
  -d '{"mode": "invalid"}'
echo -e "\n"

echo "=== Scan random mode ==="
curl -s -X POST "$BASE/api/scan/start" \
  -H "Content-Type: application/json" \
  -H "client-key: Multichain_Mining" \
  -H "client-name: Multichain_Mining" \
  -d '{
    "walletCount": 3,
    "mode": "random",
    "chains": ["BNB CHAIN"],
    "tokens": ["USDT"]
  }'
echo -e "\n"

echo "=== Scan sequential mode ==="
curl -s -X POST "$BASE/api/scan/start" \
  -H "Content-Type: application/json" \
  -H "client-key: Multichain_Mining" \
  -H "client-name: Multichain_Mining" \
  -d '{
    "walletCount": 2,
    "mode": "sequential",
    "startIndex": 100,
    "chains": ["BNB CHAIN"],
    "tokens": ["USDT"]
  }'
echo -e "\n"

echo "=== Scan mnemonic mode ==="
curl -s -X POST "$BASE/api/scan/start" \
  -H "Content-Type: application/json" \
  -H "client-key: Multichain_Mining" \
  -H "client-name: Multichain_Mining" \
  -d '{
    "walletCount": 2,
    "mode": "mnemonic",
    "chains": ["BNB CHAIN"],
    "tokens": ["USDT"]
  }'
echo -e "\n"

echo "=== Defaults (empty body) ==="
curl -s -X POST "$BASE/api/scan/start" \
  -H "Content-Type: application/json" \
  -H "client-key: Multichain_Mining" \
  -H "client-name: Multichain_Mining" \
  -d '{}'
echo -e "\n"
