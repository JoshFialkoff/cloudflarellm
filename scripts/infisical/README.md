# Infisical Secret Management for Assistedly

## Goal
Remove **all secret values** from `.env.production` and manage them exclusively through [Infisical](https://secrets.assistedly.ai) (org: `6a96c056-bba6-4990-9f98-d6e92b32d910`).

## How It Works

1. **Infisical Agent** runs as a systemd service on the server
2. It authenticates with a **Machine Identity** (Universal Auth)
3. It fetches secrets from the Infisical project every 60 seconds
4. It writes them to `/opt/assistedly/.env.infisical-rendered`
5. Docker Compose reads that file instead of `.env.production`

## Files

| File | Purpose |
|------|---------|
| [`agent-config.yaml`](./agent-config.yaml) | Infisical Agent configuration template |
| [`migrate-secrets.sh`](./migrate-secrets.sh) | One-time migration: pushes existing `.env.production` backup into Infisical |
| [`render-once.sh`](./render-once.sh) | One-shot render for testing or manual overrides |

## Migration Checklist

### Step 1 — Create a Machine Identity in Infisical
1. Go to https://secrets.assistedly.ai
2. Navigate to your project → **Settings** → **Machine Identities**
3. Click **New Identity**
4. Grant it **read+write** access to the `prod` environment
5. Note the **Client ID** and **Client Secret**

### Step 2 — Store credentials on the server (75.127.14.185)
```bash
ssh root@75.127.14.185

# Create the credentials file
sudo tee /etc/infisical/credentials.env << 'EOF'
INFISICAL_CLIENT_ID=your-client-id-here
INFISICAL_CLIENT_SECRET=your-client-secret-here
EOF

sudo chmod 600 /etc/infisical/credentials.env
```

### Step 3 — Migrate existing secrets into Infisical
```bash
ssh root@75.127.14.185

cd /opt/assistedly/infisical
# Login interactively if you haven't already
infisical login --domain https://secrets.assistedly.ai

# Run the migration script
./migrate-secrets.sh
```
This reads the backed-up `.env.production.CORRUPTED-*.backup` and pushes every valid `KEY=VALUE` to Infisical's `prod` environment.

### Step 4 — Start the Infisical Agent
```bash
ssh root@75.127.14.185

systemctl daemon-reload
systemctl enable infisical-agent
systemctl start infisical-agent

# Check logs
journalctl -u infisical-agent -f
```

### Step 5 — Verify secrets render correctly
```bash
ssh root@75.127.14.185

cd /opt/assistedly/infisical
./render-once.sh

# Check the output file
head -n 20 /opt/assistedly/.env.infisical-rendered
```

### Step 6 — Switch Docker Compose to Infisical
```bash
ssh root@75.127.14.185

cd /opt/assistedly
# Use the Infisical compose file
docker compose -f compose.dify-host.yaml.infisical up -d --force-recreate

# Verify the container is healthy
curl -IL https://assistedly.ai/
```

### Step 7 — Clean up (after confirming everything works)
```bash
ssh root@75.127.14.185

# Stop using the old compose file permanently
rm /opt/assistedly/compose.dify-host.yaml
mv /opt/assistedly/compose.dify-host.yaml.infisical /opt/assistedly/compose.dify-host.yaml

# Securely delete the backup env file
shred -u /opt/assistedly/.env.production.CORRUPTED-*.backup
shred -u /opt/assistedly/.env.production.bak*

# The active .env.production should now be the small skeleton only
```

## Rollback
If something breaks, instantly fall back to the skeleton + old compose:
```bash
ssh root@75.127.14.185
cd /opt/assistedly
docker compose -f compose.dify-host.yaml up -d --force-recreate
```

## Monitoring
- **Agent logs**: `journalctl -u infisical-agent -f`
- **Rendered secrets**: `head -n 10 /opt/assistedly/.env.infisical-rendered`
- **Agent status**: `systemctl status infisical-agent`
