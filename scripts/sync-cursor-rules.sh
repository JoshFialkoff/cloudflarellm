#!/usr/bin/env bash
# Push .cursor/rules from this repo to other local checkouts or worktrees.
# Source of truth: <repo>/.cursor/rules (commit rules to git so remotes/CI stay aligned).
#
# Usage:
#   ./scripts/sync-cursor-rules.sh
#   ./scripts/sync-cursor-rules.sh /path/to/other/root ...
#
# With no arguments, reads mirror roots from ~/.cursor/rules-mirrors (one path per line,
# # starts a comment). Create that file on each machine where you keep duplicate workspaces.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/.cursor/rules"
MIRRORS_FILE="${HOME}/.cursor/rules-mirrors"

if [[ ! -d "$SRC" ]]; then
  echo "sync-cursor-rules: missing $SRC" >&2
  exit 1
fi

collect_dests() {
  if [[ $# -gt 0 ]]; then
    printf '%s\n' "$@"
    return
  fi
  if [[ -f "$MIRRORS_FILE" ]]; then
    grep -v '^[[:space:]]*#' "$MIRRORS_FILE" | grep -v '^[[:space:]]*$' || true
  fi
}

DESTS=()
while IFS= read -r line; do
  [[ -n "$line" ]] && DESTS+=("$line")
done < <(collect_dests "$@")

if [[ ${#DESTS[@]} -eq 0 ]]; then
  cat >&2 <<EOF
sync-cursor-rules: no destinations.

  Pass project roots as arguments, or create ${MIRRORS_FILE}
  with one destination root per line (each gets .cursor/rules/ updated from this repo).

Example mirrors file:
  ${HOME}/Documents/Cursor Workspaces/AI-Assist-Living-Finder
EOF
  exit 1
fi

for dest_root in "${DESTS[@]}"; do
  if [[ ! -d "$dest_root" ]]; then
    echo "sync-cursor-rules: skip missing directory: $dest_root" >&2
    continue
  fi
  mkdir -p "$dest_root/.cursor/rules"
  rsync -a "$SRC/" "$dest_root/.cursor/rules/"
  echo "sync-cursor-rules: updated $dest_root/.cursor/rules/"
done
