#!/usr/bin/env bash
set -euo pipefail

# Auto-detect workspace/project from existing .infisical.json
PROJECT_ID=$(jq -r .workspaceId /opt/assistedly/.infisical.json 2>/dev/null || echo "")
if [ -z "$PROJECT_ID" ]; then
  echo "ERROR: No workspaceId found in /opt/assistedly/.infisical.json"
  exit 1
fi

BACKUP=$(ls -t /opt/assistedly/.env.production.CORRUPTED-*.backup 2>/dev/null | head -1)
if [ -z "$BACKUP" ]; then
  BACKUP=$(ls -t /opt/assistedly/.env.production.bak* 2>/dev/null | head -1 || true)
  if [ -z "$BACKUP" ]; then
    echo "No backup env file found."
    exit 1
  fi
fi

echo "================================================"
echo "Assistedly -> Infisical Secret Migration"
echo "================================================"
echo "Project ID:  $PROJECT_ID"
echo "Source:      $BACKUP"
echo ""
read -p "Type YES to push all valid KEY=VALUE to Infisical: " confirm
[ "$confirm" = "YES" ] || { echo "Aborted."; exit 1; }

pushed=0
skipped=0
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in ""|#*) continue ;; esac
  if ! printf "%s" "$line" | grep -q "="; then
    skipped=$((skipped + 1))
    continue
  fi
  key=$(printf "%s" "$line" | sed "s/=.*//")
  val=$(printf "%s" "$line" | sed "s/^[^=]*=//")
  if [ -z "$key" ] || ! printf "%s" "$key" | grep -qE "^[A-Za-z_][A-Za-z0-9_]*$"; then
    echo "  SKIP (bad key): $(printf "%.45s" "$key" )"
    skipped=$((skipped + 1))
    continue
  fi
  echo "  PUSH: $key"
  infisical secrets set "$key" "$val" --env=prod --projectId="$PROJECT_ID" 2>/dev/null || true
  pushed=$((pushed + 1))
done < "$BACKUP"

echo ""
echo "Done: $pushed pushed, $skipped skipped"
echo "Verify at: https://secrets.assistedly.ai/project/$PROJECT_ID"
