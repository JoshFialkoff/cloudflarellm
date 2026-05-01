#!/usr/bin/env bash
set -euo pipefail

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

key_path="$HOME/.ssh/7-5-25kuroit"

if [ -n "${SSH_PRIVATE_KEY_B64:-}" ]; then
  printf '%s' "$SSH_PRIVATE_KEY_B64" | base64 -d > "$key_path"
elif [ -n "${SSH_PRIVATE_KEY:-}" ]; then
  printf '%s\n' "$SSH_PRIVATE_KEY" > "$key_path"
else
  echo "SSH_PRIVATE_KEY is not set in this environment." >&2
  exit 1
fi

python3 - "$key_path" <<'PY'
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

chmod 600 "$key_path"

ssh-keygen -R 104.168.38.162 >/dev/null 2>&1 || true
ssh-keyscan -H 104.168.38.162 >> "$HOME/.ssh/known_hosts"
chmod 644 "$HOME/.ssh/known_hosts"

cat > "$HOME/.ssh/config" <<'CONFIG'
Host kuroit
  HostName 104.168.38.162
  User joshfialkoff
  IdentityFile ~/.ssh/7-5-25kuroit
  IdentitiesOnly yes
CONFIG

chmod 600 "$HOME/.ssh/config"
