#!/bin/bash
# Auto-fix db.assistedly.ai DNS → Cloudflare Tunnel
# Requires: CLOUDFLARE_API_TOKEN env var with Zone:Read + DNS:Edit scopes
set -euo pipefail

TOKEN="${CLOUDFLARE_API_TOKEN}"
ZONE_ID="70904cb60620dcfb62f49cccbfe72959"
TUNNEL_ID="f9af5ee9-d618-46e4-ad95-846c312d1b99"

if [ -z "${TOKEN}" ]; then
  echo "ERROR: Set CLOUDFLARE_API_TOKEN with Zone:Read + DNS:Edit for assistedly.ai"
  exit 1
fi

echo "== Step 1: List existing db.assistedly.ai records =="
RECORDS=$(curl -s -H "Authorization: Bearer ${TOKEN}" \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?name=db.assistedly.ai")
echo "$RECORDS" | python3 -m json.tool 2>/dev/null || echo "$RECORDS"

IDS=$(echo "$RECORDS" | python3 -c "import sys,json; [print(r['id']) for r in json.load(sys.stdin).get('result',[])]")

echo ""
echo "== Step 2: Delete all existing db records =="
for ID in $IDS; do
  echo "Deleting $ID..."
  curl -s -X DELETE -H "Authorization: Bearer ${TOKEN}" \
    "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/$ID"
done

echo ""
echo "== Step 3: Create CNAME db → tunnel =="
CREATE=$(curl -s -X POST -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d "{\"type\":\"CNAME\",\"name\":\"db\",\"content\":\"${TUNNEL_ID}.cfargotunnel.com\",\"ttl\":1,\"proxied\":true}" \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records")
echo "$CREATE" | python3 -m json.tool 2>/dev/null || echo "$CREATE"

echo ""
echo "== Step 4: Purge cache =="
PURGE=$(curl -s -X POST -H "Authorization: Bearer ${TOKEN}" -H "Content-Type: application/json" \
  -d '{\"files\":[\"https://db.assistedly.ai/\",\"https://db.assistedly.ai/*\"]}' \
  "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache")
echo "$PURGE" | python3 -m json.tool 2>/dev/null || echo "$PURGE"

echo ""
echo "Done. Verify with: dig CNAME db.assistedly.ai"
