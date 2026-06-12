#!/usr/bin/env bash
# Read-only server health snapshot for ops monitoring.
# Does NOT reboot, restart services, or modify the host.
#
# Usage:
#   ./scripts/ops/collect-server-health.sh [ssh-host-alias ...]
#   ./scripts/ops/collect-server-health.sh --all
#
# Env:
#   OPS_SSH_USER          SSH user (default: codermaintenance when coder key present, else joshfialkoff)
#   OPS_SSH_IDENTITY_FILE Optional private key path
#   OPS_OUTPUT_DIR        Output directory (default: reports/server-health)
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INVENTORY="${ROOT}/scripts/ops/server-inventory.json"
OUTPUT_DIR="${OPS_OUTPUT_DIR:-${ROOT}/reports/server-health}"
SSH_USER="${OPS_SSH_USER:-}"
if [[ -z "${SSH_USER}" ]]; then
  if [[ -f "${HOME}/.ssh/6-3-26-coder-bot" ]]; then
    SSH_USER="codermaintenance"
    IDENTITY="${OPS_SSH_IDENTITY_FILE:-${HOME}/.ssh/6-3-26-coder-bot}"
  else
    SSH_USER="joshfialkoff"
    IDENTITY="${OPS_SSH_IDENTITY_FILE:-${HOME}/.ssh/7-5-25kuroit}"
  fi
else
  IDENTITY="${OPS_SSH_IDENTITY_FILE:-}"
fi
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="${OUTPUT_DIR}/${STAMP}"
mkdir -p "${OUT}"

ssh_opts=(-o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new)
if [[ -n "${IDENTITY}" && -f "${IDENTITY}" ]]; then
  ssh_opts+=(-i "${IDENTITY}" -o IdentitiesOnly=yes)
fi

collect_one() {
  local target="$1"
  local ip="$1"
  # Resolve inventory IP when an SSH config alias or hostname was passed.
  if [[ ! "${target}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    ip="$(node -e "
      const inv = require('${INVENTORY}');
      const t = process.argv[1];
      const s = inv.servers.find((x) => x.id === t || x.hostname === t);
      if (s) process.stdout.write(s.id);
    " "${target}")"
    [[ -z "${ip}" ]] && ip="${target}"
  fi
  local safe="${ip}"
  local json="${OUT}/${safe}.json"
  local err="${OUT}/${safe}.err"

  echo "==> ${ip}" >&2

  remote_script='
set -e
echo "{"
echo "  \"hostname\": \"$(hostname -f 2>/dev/null || hostname)\","
echo "  \"uptime_seconds\": $(awk "{print int(\$1)}" /proc/uptime),"
echo "  \"load_1m\": $(awk "{print \$1}" /proc/loadavg),"
echo "  \"load_5m\": $(awk "{print \$2}" /proc/loadavg),"
echo "  \"load_15m\": $(awk "{print \$3}" /proc/loadavg),"
echo "  \"mem_total_kb\": $(awk "/MemTotal/ {print \$2}" /proc/meminfo),"
echo "  \"mem_available_kb\": $(awk "/MemAvailable/ {print \$2}" /proc/meminfo),"
echo "  \"disk_root_pct\": $(df -P / | awk "NR==2 {gsub(/%/,\"\",\$5); print \$5}"),"
echo "  \"needs_reboot\": $(test -f /var/run/reboot-required && echo true || echo false),"
echo "  \"kernel\": \"$(uname -r)\","
echo "  \"timestamp_utc\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\""
echo "}"
'

  if ssh "${ssh_opts[@]}" "${SSH_USER}@${ip}" "bash -s" <<<"${remote_script}" >"${json}" 2>"${err}"; then
    echo "    ok -> ${json}" >&2
  else
    echo "    FAIL (see ${err})" >&2
    printf '{"ip":"%s","error":"ssh_failed","stderr":"%s"}\n' \
      "${ip}" "$(tr '\n' ' ' <"${err}" | sed 's/"/\\"/g')" >"${json}"
  fi
}

if [[ "${1:-}" == "--all" ]]; then
  hosts=()
  while IFS= read -r line; do
    [[ -n "${line}" ]] && hosts+=("${line}")
  done < <(node -e "
    const inv = require('${INVENTORY}');
    for (const s of inv.servers) console.log(s.id);
  ")
elif [[ $# -gt 0 ]]; then
  hosts=("$@")
else
  echo "Usage: $0 --all | <ip-or-ssh-host> [ip-or-ssh-host ...]" >&2
  exit 1
fi

meta="${OUT}/run-meta.json"
cat >"${meta}" <<EOF
{
  "collected_at_utc": "${STAMP}",
  "ssh_user": "${SSH_USER}",
  "hosts": $(node -e "console.log(JSON.stringify(process.argv.slice(1)))" "${hosts[@]}")
}
EOF

for h in "${hosts[@]}"; do
  collect_one "${h}"
done

echo "Wrote ${OUT}" >&2
