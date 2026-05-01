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

servers=(
  "racknerd-f9eb56e 23.95.189.106"
  "racknerd-5a9aa1d 107.172.94.35"
  "racknerd-6c57489 104.168.38.162"
  "racknerd-9a7a1c2 75.127.14.185"
  "racknerd-287588f 107.174.146.230"
  "racknerd-3870700 172.245.119.156"
  "racknerd-4e84e0a 107.174.44.66"
  "racknerd-aa30db5 198.144.180.149"
)

for server in "${servers[@]}"; do
  host="${server%% *}"
  ip="${server##* }"
  ssh-keygen -R "$ip" >/dev/null 2>&1 || true
  ssh-keyscan -H "$ip" >> "$HOME/.ssh/known_hosts"
done

chmod 644 "$HOME/.ssh/known_hosts"

cat > "$HOME/.ssh/config" <<'CONFIG'
Host kuroit racknerd-6c57489
  HostName 104.168.38.162
  User joshfialkoff
  IdentityFile ~/.ssh/7-5-25kuroit
  IdentitiesOnly yes

Host racknerd-f9eb56e
  HostName 23.95.189.106
  User joshfialkoff
  IdentityFile ~/.ssh/7-5-25kuroit
  IdentitiesOnly yes

Host racknerd-5a9aa1d
  HostName 107.172.94.35
  User joshfialkoff
  IdentityFile ~/.ssh/7-5-25kuroit
  IdentitiesOnly yes

Host racknerd-9a7a1c2
  HostName 75.127.14.185
  User joshfialkoff
  IdentityFile ~/.ssh/7-5-25kuroit
  IdentitiesOnly yes

Host racknerd-287588f
  HostName 107.174.146.230
  User joshfialkoff
  IdentityFile ~/.ssh/7-5-25kuroit
  IdentitiesOnly yes

Host racknerd-3870700
  HostName 172.245.119.156
  User joshfialkoff
  IdentityFile ~/.ssh/7-5-25kuroit
  IdentitiesOnly yes

Host racknerd-4e84e0a
  HostName 107.174.44.66
  User joshfialkoff
  IdentityFile ~/.ssh/7-5-25kuroit
  IdentitiesOnly yes

Host racknerd-aa30db5
  HostName 198.144.180.149
  User joshfialkoff
  IdentityFile ~/.ssh/7-5-25kuroit
  IdentitiesOnly yes
CONFIG

chmod 600 "$HOME/.ssh/config"
