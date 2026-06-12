#!/usr/bin/env bash
# Install SSH keys for server ops (Keystash codermaintenance + legacy joshfialkoff).
# Called from .cursor/setup-ssh.sh or standalone.
set -euo pipefail

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

write_key_from_env() {
  local env_name="$1"
  local key_path="$2"
  local value="${!env_name:-}"

  if [[ -z "${value}" ]]; then
    return 1
  fi

  if [[ "${value}" == *"BEGIN OPENSSH PRIVATE KEY"* ]] || [[ "${value}" == *"BEGIN RSA PRIVATE KEY"* ]]; then
    printf '%s\n' "${value}" > "${key_path}"
  else
    printf '%s' "${value}" | base64 -d > "${key_path}"
  fi

  python3 - "${key_path}" <<'PY'
from pathlib import Path
import re
import sys

path = Path(sys.argv[1])
text = path.read_text()

if "\n" not in text.strip():
    match = re.fullmatch(
        r"(-----BEGIN OPENSSH PRIVATE KEY-----)(.+)(-----END OPENSSH PRIVATE KEY-----)",
        text.strip(),
    )
    if match:
        body = match.group(2)
        lines = [body[i:i + 70] for i in range(0, len(body), 70)]
        path.write_text(match.group(1) + "\n" + "\n".join(lines) + "\n" + match.group(3) + "\n")
PY

  chmod 600 "${key_path}"
  return 0
}

legacy_key="$HOME/.ssh/7-5-25kuroit"
coder_key="$HOME/.ssh/6-3-26-coder-bot"

if write_key_from_env "SSH_CODER_PRIVATE_KEY" "${coder_key}"; then
  echo "Installed Keystash coder key at ${coder_key}"
elif [[ -n "${SSH_PRIVATE_KEY_B64:-}" ]]; then
  printf '%s' "${SSH_PRIVATE_KEY_B64}" | base64 -d > "${legacy_key}"
  chmod 600 "${legacy_key}"
  echo "Installed legacy SSH key (base64) at ${legacy_key}"
elif write_key_from_env "SSH_PRIVATE_KEY" "${legacy_key}"; then
  echo "Installed legacy SSH key at ${legacy_key}"
else
  echo "No SSH private key env vars set (SSH_CODER_PRIVATE_KEY or SSH_PRIVATE_KEY)." >&2
  exit 1
fi

# Prefer codermaintenance + coder key when available; fall back to joshfialkoff.
ops_user="joshfialkoff"
ops_identity="${legacy_key}"
if [[ -f "${coder_key}" ]]; then
  ops_user="codermaintenance"
  ops_identity="${coder_key}"
fi

servers=(
  "104.168.38.162"
  "23.95.189.106"
  "107.172.94.35"
  "75.127.14.185"
  "107.174.146.230"
  "172.245.119.156"
  "107.174.44.66"
  "198.144.180.149"
)

for ip in "${servers[@]}"; do
  ssh-keygen -R "$ip" >/dev/null 2>&1 || true
  ssh-keyscan -H "$ip" >> "$HOME/.ssh/known_hosts"
done
chmod 644 "$HOME/.ssh/known_hosts"

{
  echo "# Server ops SSH — identify hosts by IP (kuroit is a key name, not a server)"
  for ip in "${servers[@]}"; do
    cat <<ENTRY
Host ${ip}
  HostName ${ip}
  User ${ops_user}
  IdentityFile ${ops_identity}
  IdentitiesOnly yes

ENTRY
  done
} > "$HOME/.ssh/config"

chmod 600 "$HOME/.ssh/config"
echo "SSH config: user=${ops_user} identity=${ops_identity}"
