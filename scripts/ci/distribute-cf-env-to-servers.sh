#!/usr/bin/env bash
# One-time (or repeat) push of Cloudflare credentials to root-only env files on remote hosts.
# Does not use GitHub. Run from your admin machine with SSH access.
#
# Usage:
#   cp scripts/ci/cf.env.example cf.env   # repo root; edit values; cf.env is gitignored
#   chmod +x scripts/ci/distribute-cf-env-to-servers.sh
#   ./scripts/ci/distribute-cf-env-to-servers.sh cf.env kuroit host2 host3 ...
#
# Optional env:
#   REMOTE_DIR=/etc/assistedly   (default)
#
# On each server, before purge:
#   set -a && source /etc/assistedly/cf.env && set +a && npm run ci:cf:purge
#
set -euo pipefail

REMOTE_DIR="${REMOTE_DIR:-/etc/assistedly}"
LOCAL_ENV="${1:?Usage: $0 <local-cf.env> <ssh-host> [ssh-host ...]}"
shift
(( $# )) || {
  echo "error: need at least one SSH host (Host from ~/.ssh/config or user@host)" >&2
  exit 1
}

if [[ ! -f "$LOCAL_ENV" ]]; then
  echo "error: file not found: $LOCAL_ENV" >&2
  exit 1
fi

if ! grep -q '^CLOUDFLARE_API_TOKEN=.' "$LOCAL_ENV"; then
  echo "error: $LOCAL_ENV must set CLOUDFLARE_API_TOKEN (non-empty)" >&2
  exit 1
fi
if ! grep -q '^CLOUDFLARE_ZONE_ID=.' "$LOCAL_ENV"; then
  echo "error: $LOCAL_ENV must set CLOUDFLARE_ZONE_ID (non-empty); ci:cf:purge needs both" >&2
  exit 1
fi

for host in "$@"; do
  echo "==> $host"
  tmp="/tmp/cf.env.${USER}.$$.$RANDOM"
  ssh -o BatchMode=yes "$host" "sudo mkdir -p '${REMOTE_DIR}' && sudo chmod 700 '${REMOTE_DIR}'"
  scp -q "$LOCAL_ENV" "${host}:${tmp}"
  ssh -o BatchMode=yes "$host" "sudo mv '${tmp}' '${REMOTE_DIR}/cf.env' && sudo chmod 600 '${REMOTE_DIR}/cf.env' && sudo chown root:root '${REMOTE_DIR}/cf.env'"
  echo "    installed ${REMOTE_DIR}/cf.env"
done

echo "Done. On a server (from app directory with node deps):"
echo "  set -a && source ${REMOTE_DIR}/cf.env && set +a && npm run ci:cf:purge"
