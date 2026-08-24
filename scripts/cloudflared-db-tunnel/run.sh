#!/bin/bash
# Run Cloudflare Tunnel for db.assistedly.ai → NocoDB
# Tunnel: db-assistedly-ai (f9af5ee9-d618-46e4-ad95-846c312d1b99)
# Origin: http://23.95.189.106:8080
set -euo pipefail

# Fetch token from Infisical (requires Infisical agent-proxy or local auth)
TOKEN="$(INFISICAL_DOMAIN=https://secrets.assistedly.ai infisical secrets get --env=dev --path=/ DB_TUNNEL_TOKEN --plain 2>/dev/null || true)"

if [ -z "${TOKEN}" ]; then
  echo "ERROR: Could not fetch DB_TUNNEL_TOKEN from Infisical."
  echo "Set it manually: infisical secrets set --env=dev --path=/ DB_TUNNEL_TOKEN=<token>"
  exit 1
fi

echo "Starting Cloudflare tunnel: db-assistedly-ai"
exec cloudflared tunnel run --token "${TOKEN}" f9af5ee9-d618-46e4-ad95-846c312d1b99
