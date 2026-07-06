# Migration runbook: assistedly.ai → 75.127.14.185 (Dify co-located host)

Move production from **104.168.38.162** (Traefik, disk full) to **75.127.14.185** (Dify + dify-nginx on 80/443).

## Routing choice

**Option B (selected):** web-only Compose + nginx vhost on existing `dify-nginx-1`.

| Option | Verdict |
|--------|---------|
| A — server blocks on dify-nginx | Same as B; B names the compose split explicitly |
| B — web-only compose + nginx vhost | **Chosen.** Reuses edge proxy, no port conflict, Dify stays untouched |
| C — Cloudflare Tunnel | Extra daemon + origin auth; unnecessary when nginx already owns 80/443 |

**Contract:** `compose.dify-host.yaml` runs `assistedlyai-web-1` on `dify_default` with alias `assistedly-web`. `scripts/deploy/nginx-assistedly.conf` is installed at `/etc/dify/nginx/conf.d/assistedly.conf` (bind-mounted into `dify-nginx-1`).

## DNS / Cloudflare (cutover)

After origin smoke passes on **75.127.14.185**:

1. Cloudflare DNS → A records for `assistedly.ai`, `www`, `agent2`, `agent3`: change origin IP **104.168.38.162 → 75.127.14.185** (keep proxy orange-cloud on).
2. Purge Cloudflare cache (`npm run ci:cf:purge` or Actions **CI remote control**).
3. Update GitHub Actions env in `.github/workflows/ci-cd.yml`:
   - `DEPLOY_HOST: 75.127.14.185`
   - `DEPLOY_COMPOSE_FILE: compose.dify-host.yaml`
   - `DEPLOY_USER: opencode` (after user is created) or `joshfialkoff` (after `docker` group)
4. Public smoke: `PRODUCTION_SMOKE_URL=https://assistedly.ai/ npm run smoke:production`

SSL mode: keep **Full** or **Full (strict)**. Place origin cert on host:

```text
/etc/dify/nginx/ssl/assistedly.crt
/etc/dify/nginx/ssl/assistedly.key
```

Cloudflare Origin Certificate (recommended) or Let's Encrypt via existing certbot mounts.

---

## Phase 1 — Prep target host (no DNS change)

SSH: `ssh -i ~/.ssh/7-5-25kuroit joshfialkoff@75.127.14.185`

### 1.1 Deploy user + Docker access

**Blocker found:** no `opencode` user; `joshfialkoff` is not in the `docker` group.

Pick one:

```bash
# A) Match CI default (opencode + docker group)
sudo useradd -m -G docker opencode
sudo mkdir -p /home/opencode/.ssh
# append GitHub DEPLOY_KEY public half to /home/opencode/.ssh/authorized_keys
sudo chown -R opencode:opencode /home/opencode/.ssh
sudo chmod 700 /home/opencode/.ssh && sudo chmod 600 /home/opencode/.ssh/authorized_keys

# B) Reuse joshfialkoff
sudo usermod -aG docker joshfialkoff
# then set DEPLOY_USER=joshfialkoff in CI and local deploys
```

### 1.2 Config directory

```bash
sudo mkdir -p /opt/assistedly
sudo chown "$USER:$USER" /opt/assistedly
```

### 1.3 Copy production env from old host

On **104.168.38.162** (read-only copy):

```bash
scp -i ~/.ssh/7-5-25kuroit joshfialkoff@104.168.38.162:/opt/assistedly/.env.production /tmp/.env.production
scp -i ~/.ssh/7-5-25kuroit /tmp/.env.production joshfialkoff@75.127.14.185:/opt/assistedly/.env.production
chmod 600 /opt/assistedly/.env.production
```

Review Dify URLs in `.env.production` — co-location may allow `http://dify-api-1:5001` or `http://127.0.0.1:...` instead of remote `dify.forwardjump.com`.

**⚠️ CRITICAL — DIFY_API_BASE_URL must NOT contain /api/**
```
CORRECT:   https://dify.forwardjump.com/v1       ✓ Works
WRONG:     https://dify.forwardjump.com/api/v1    ✗ 404 (Console API — no chat-messages)
```
The Dify nginx routes `/api` to the **Console API** and `/v1` to the **Public API**.
Including `/api/` causes ALL chat requests to 404 → 502 → client shows "AI has gone AWOL".
Verify with:
```bash
grep DIFY_API_BASE /opt/assistedly/.env.production
curl -sI "https://dify.forwardjump.com/v1/parameters"
# Should return 200, not 404.
```

### 1.4 TLS material

Install Cloudflare Origin Certificate (or LE cert) for assistedly hostnames into:

```text
/etc/dify/nginx/ssl/assistedly.crt
/etc/dify/nginx/ssl/assistedly.key
```

### 1.5 Nginx vhost

From repo checkout on Mac or target:

```bash
sudo cp scripts/deploy/nginx-assistedly.conf /etc/dify/nginx/conf.d/assistedly.conf
sudo docker exec dify-nginx-1 nginx -t
sudo docker exec dify-nginx-1 nginx -s reload
```

---

## Phase 2 — Deploy app (still old DNS)

From this Cursor workspace:

```bash
DEPLOY_USER=opencode \
DEPLOY_COMPOSE_FILE=compose.dify-host.yaml \
node scripts/ci/trigger-deploy.mjs --host 75.127.14.185
```

(Use `DEPLOY_USER=joshfialkoff` if that is the configured deploy account.)

### 2.1 Origin smoke (bypasses public DNS)

```bash
curl -k --resolve assistedly.ai:443:75.127.14.185 -I https://assistedly.ai/
curl -s http://127.0.0.1:3003/api/health   # on target host
```

Expect `200` on `/api/health` and non-5xx on `/`.

### 2.2 Functional checks

- Homepage `/`, `/search`, `/facility/[slug]`
- `/api/chat` (Dify) — verify latency improvement vs remote Dify
- PostHog events still firing

---

## Phase 3 — DNS cutover (requires !!APPROVED in ops channel)

1. Post `!!APPROVED` in Discord ops channel.
2. Cloudflare: A records → **75.127.14.185**.
3. Merge CI workflow update (`DEPLOY_HOST`, `DEPLOY_COMPOSE_FILE`, `DEPLOY_USER`).
4. Purge Cloudflare cache.
5. `PRODUCTION_SMOKE_URL=https://assistedly.ai/ npm run smoke:production`

---

## Rollback

If cutover fails:

1. Cloudflare A records → **104.168.38.162** (immediate).
2. Purge Cloudflare cache.
3. Old stack should still be running (`assistedlyai-traefik-1` + `assistedlyai-web-1`).
4. Revert `.github/workflows/ci-cd.yml` deploy env to old host + `compose.yaml`.
5. On target, optional cleanup:
   ```bash
   docker compose -p assistedlyai -f compose.dify-host.yaml down
   sudo rm /etc/dify/nginx/conf.d/assistedly.conf
   sudo docker exec dify-nginx-1 nginx -s reload
   ```

Previous deploy worktree on old host is retained automatically by `trigger-deploy.mjs` for image rollback.

---

## Post-migration

- Old host **104.168.38.162**: free disk (prune images/logs) or decommission after soak period.
- Do **not** remove Ollama on any host.
- Update `scripts/ops/server-inventory.json` roles when cutover completes.
