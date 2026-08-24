# Cloudflare Tunnel: db.assistedly.ai

Tunnel Name: `db-assistedly-ai`
Tunnel ID: `f9af5ee9-d618-46e4-ad95-846c312d1b99`
Account: ForwardJump.com (ad9d77d8f16147c01ff26b56d41cb5a9)

## What was done
- Created a Cloudflare Tunnel via API.
- Configured ingress: `db.assistedly.ai` → `http://23.95.189.106:8080`.
- Tested connectivity successfully from this machine to Cloudflare edge.
- Stored tunnel token securely in Infisical (`DB_TUNNEL_TOKEN`).

## Remaining manual step: DNS
`db.assistedly.ai` currently points to the main website (existing A/CNAME record).
**You must update the DNS record in the Cloudflare dashboard:**

1. Go to https://dash.cloudflare.com → assistedly.ai → DNS
2. Find the existing `db` record.
3. Change it to:
   - **Type:** CNAME
   - **Name:** db
   - **Target:** `f9af5ee9-d618-46e4-ad95-846c312d1b99.cfargotunnel.com`
   - **Proxy status:** Proxied (orange cloud)
   - **TTL:** Auto

## Run the tunnel

### Option A: Run on the origin server (recommended)
On `23.95.189.106` (or any server that can reach it):

1. Install cloudflared:
   ```bash
   curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared.deb
   ```

2. Install Infisical CLI and authenticate (or use the token directly).

3. Run:
   ```bash
   ./scripts/cloudflared-db-tunnel/run.sh
   ```

### Option B: Quick run with explicit token (no Infisical dependency)
If the machine doesn't have Infisical set up, retrieve the token from Infisical on your local machine and run:
```bash
cloudflared tunnel run --token <DB_TUNNEL_TOKEN> f9af5ee9-d618-46e4-ad95-846c312d1b99
```

### Option C: systemd service (Linux)
```bash
sudo tee /etc/systemd/system/cloudflared-db-assistedly.service << 'EOF'
[Unit]
Description=Cloudflare Tunnel for db.assistedly.ai
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
Environment="INFISICAL_DOMAIN=https://secrets.assistedly.ai"
ExecStart=/usr/local/bin/cloudflared tunnel run --token <DB_TUNNEL_TOKEN> f9af5ee9-d618-46e4-ad95-846c312d1b99
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared-db-assistedly
```
> Replace `<DB_TUNNEL_TOKEN>` with the actual token from Infisical, or source it via Infisical in the service file.

## Important notes
- **Path correction:** You specified `/nc`, but NocoDB is served from the root (`/`) on `http://23.95.189.106:8080`. The tunnel is configured to serve from `/`. Visiting `https://db.assistedly.ai/` will load the NocoDB dashboard.
- **Security:** The tunnel uses `noTLSVerify` on the origin request because the origin is plain HTTP. Traffic from users to Cloudflare edge is still fully HTTPS-encrypted.
- **Token storage:** The token is stored in Infisical at `dev` environment, path `/`, name `DB_TUNNEL_TOKEN`.
