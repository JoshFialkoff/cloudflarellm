#!/bin/bash
# Cloudflare Tunnel setup for db.assistedly.ai on racknerd-f9eb56e
# Tunnel: db-assistedly-ai (f9af5ee9-d618-46e4-ad95-846c312d1b99)
set -euo pipefail

TOKEN="eyJhIjoiYWQ5ZDc3ZDhmMTYxNDdjMDFmZjI2YjU2ZDQxY2I1YTkiLCJ0IjoiZjlhZjVlZTktZDYxOC00NmU0LWFkOTUtODQ2YzMxMmQxYjk5IiwicyI6IjhPNmdCSEJQbm9JaEwyWG9JUXZUZmRtK1Zqd0x6bmV6NUszeERLZFhBcGc1ODduWG44UzRCRFFGODJUSlVZWEo0T1JGMDlCTk5XVFoyZHo4bmxrR2pnPT0ifQ=="

echo "Installing cloudflared if not present..."
if ! command -v cloudflared &> /dev/null; then
    ARCH=$(uname -m)
    if [ "$ARCH" = "x86_64" ]; then
        URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"
    elif [ "$ARCH" = "aarch64" ]; then
        URL="https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64"
    else
        echo "Unsupported arch: $ARCH"
        exit 1
    fi
    curl -fsSL "$URL" -o /usr/local/bin/cloudflared
    chmod +x /usr/local/bin/cloudflared
    echo "cloudflared installed."
else
    echo "cloudflared already installed: $(cloudflared version)"
fi

echo "Starting tunnel..."
exec cloudflared tunnel run --token "${TOKEN}" f9af5ee9-d618-46e4-ad95-846c312d1b99
