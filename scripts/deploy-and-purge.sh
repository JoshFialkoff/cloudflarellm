#!/usr/bin/env bash

set -euo pipefail

# Repo root (this file lives in scripts/); works for /opt/assistedly, /code, etc.
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Include dev dependencies so Next.js TypeScript checks always have required packages.
npm ci --include=dev
npm run build

supervisorctl restart nextjs-server

: "${CLOUDFLARE_ZONE_ID:?CLOUDFLARE_ZONE_ID is required}"
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"

curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/purge_cache" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  --data '{"purge_everything": true}'
