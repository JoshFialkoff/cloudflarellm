#!/usr/bin/env bash
#
# setup-google-workspace-mcp.sh
# =============================
# Configures Goose to use Google Workspace MCP servers with secrets
# injected at runtime via Infisical (or from env vars).
#
# IMPORTANT: This script does NOT read or print secrets.
# Secrets are sourced from Infisical rendered .env or env vars at runtime.
#
# Prerequisites
#   - Goose config exists at ~/.config/goose/config.yaml
#   - Infisical exports secrets to ~/.infisical/rendered/.env  (run export-secrets.sh first)
#   - OAUTH2_CLIENT_ID and OAUTH2_CLIENT_SECRET available as env vars
#

set -euo pipefail

GOOSE_CONFIG="${GOOSE_CONFIG:-$HOME/.config/goose/config.yaml}"

colour_info()  { echo -e "\033[0;34m[INFO]\033[0m $*"; }
colour_ok()    { echo -e "\033[0;32m[OK]\033[0m $*"; }
colour_warn()  { echo -e "\033[1;33m[WARN]\033[0m $*"; }
colour_error() { echo -e "\033[0;31m[ERROR]\033[0m $*" >&2; }

# ── Pre-flight checks ──────────────────────────────────────────────────
if [[ ! -f "$GOOSE_CONFIG" ]]; then
  colour_error "Goose config not found at $GOOSE_CONFIG"
  exit 1
fi

# Ensure env vars are populated ( Infisical Agent or manual export )
if [[ -z "${OAUTH2_CLIENT_ID:-}" || -z "${OAUTH2_CLIENT_SECRET:-}" ]]; then
  # Try sourcing rendered .env automatically
  RENDERED_ENV="$HOME/.infisical/rendered/.env"
  if [[ -f "$RENDERED_ENV" ]]; then
    colour_info "Sourcing Infisical rendered env from $RENDERED_ENV …"
    set -a
    # shellcheck source=/dev/null
    source "$RENDERED_ENV"
    set +a
  fi
fi

if [[ -z "${OAUTH2_CLIENT_ID:-}" || -z "${OAUTH2_CLIENT_SECRET:-}" ]]; then
  colour_error "OAUTH2_CLIENT_ID and OAUTH2_CLIENT_SECRET must be set."
  colour_error "Run:  source ~/.infisical/rendered/.env"
  colour_error "Or:  infisical run -- <this script>"
  exit 1
fi

colour_info "Using OAuth client ID: ${OAUTH2_CLIENT_ID:0:12}…"

# ── Validate YAML ──────────────────────────────────────────────────────
if command -v python3 &>/dev/null; then
  python3 -c "import yaml; yaml.safe_load(open('$GOOSE_CONFIG'))" 2>/dev/null || {
    colour_error "config.yaml is not valid YAML. Please fix manually."
    exit 1
  }
fi

# ── Patch MCP blocks to use env-var references ───────────────────────
patch_mcp_block() {
  local block_name=$1
  if grep -q "^  ${block_name}:" "$GOOSE_CONFIG"; then
    colour_info "Patching ${block_name} to use env-var references …"
    python3 - "$GOOSE_CONFIG" "$block_name" <<'PY'
import sys, re
path, block = sys.argv[1:3]
with open(path) as f: raw = f.read()

pat = re.compile(r'^  {0}:\n((?:    .*\n)*)'.format(block), re.M)

def repl(m):
    env = m.group(1)
    env = re.sub(r'^      OAUTH2_CLIENT_ID:.*$', '      OAUTH2_CLIENT_ID: ${OAUTH2_CLIENT_ID}', env, flags=re.M)
    env = re.sub(r'^      OAUTH2_CLIENT_SECRET: .*$', '      OAUTH2_CLIENT_SECRET: ${OAUTH2_CLIENT_SECRET}', env, flags=re.M)
    return '  {}:\n{}'.format(block, env)

new = pat.sub(repl, raw)
with open(path, 'w') as f: f.write(new)
PY
    colour_ok "Patched ${block_name}"
  fi
}

patch_mcp_block "google-docs"
patch_mcp_block "google-sheets"
patch_mcp_block "google-drive"

# ── Validate again ─────────────────────────────────────────────────────
if command -v python3 &>/dev/null; then
  python3 -c "import yaml; yaml.safe_load(open('$GOOSE_CONFIG'))" 2>/dev/null && colour_ok "YAML valid."
fi

cat <<'EOF'
╔══════════════════════════════════════════════════════════════╗
║     Google Workspace MCP Config Updated (env-var refs) ✅    ║
╚══════════════════════════════════════════════════════════════╝

Config file: ~/.config/goose/config.yaml

⚠️  IMPORTANT: Secrets are now referenced as env vars.
    Goose must be launched with OAUTH2_CLIENT_ID and
    OAUTH2_CLIENT_SECRET in its environment.

Recommended launch patterns:

  1) Via Infisical CLI (preferred):
     infisical run --projectId e9cab1b7-b17c-4502-bc30-64ae61c21e63 --env dev -- <goose-command>

  2) Via sourced env:
     source ~/.infisical/rendered/.env
     goose

  3) Via the wrapper script:
     bash scripts/run-with-infisical.sh <command>

NEXT: Authenticate each MCP server once by opening the URL
      that Goose prints when it first loads the extension.
EOF
