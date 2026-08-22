#!/bin/zsh
set -euo pipefail
# Production deploy for assistedly-slot4
# Uses CLOUDFLARE_API_TOKEN from .dev.vars (sourced from Infisical)

cd /Users/joshdev/Assistedly.ai

echo "=== Syncing secrets from Infisical ==="
TOKEN=$(cat ~/.infisical/machine-identity/service-token 2>/dev/null)
/opt/homebrew/bin/infisical export \
  --token "$TOKEN" \
  --projectId e9cab1b7-b17c-4502-bc30-64ae61c21e63 \
  --env dev \
  --format dotenv \
  --domain https://secrets.assistedly.ai/api \
  --output-file ~/.infisical/rendered/.env

echo "=== Running critical feature guard ==="
node scripts/guard-critical-features.mjs

echo "=== Building production bundle ==="
rm -rf .open-next .next node_modules/.cache
npm ci && npm run build

echo "=== Deploying to assistedly-slot4 ==="
npx wrangler deploy --config wrangler-slot4.toml

echo "=== Smoke tests ==="
curl -sI https://assistedly.ai/ | grep -i "x-opennext\\|HTTP"
curl -s https://assistedly.ai/ | grep -o '<title>.*</title>' | head -1

echo "=== Deploy complete ==="
