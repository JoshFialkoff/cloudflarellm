---
name: racknerd
description: Full RackNerd VPS fleet (8 servers) hosting MCP servers, Dify, NocoDB/Twenty CRM, Infisical, Ollama, Plane, n8n, Listmonk, WordPress, Zabbix, and marketing tools. Load when needing remote database queries, SEO/data intelligence MCPs, care-intelligence tools, project management, infrastructure health checks, or server ops on any RackNerd host.
---

# RackNerd Infrastructure — Full Fleet

This skill catalogs all 8 RackNerd VPS servers, their MCP servers, containers, and critical services.

**SSH key:** `~/.ssh/7-5-25kuroit`  
**SSH user:** `root` (or `codermaintenance` per `scripts/ops/server-inventory.json`)  
**Inventory source:** `scripts/ops/server-inventory.json`

---

## Fleet Overview

| # | IP | Hostname | Primary Role | MCP Servers |
|---|----|----------|-------------|-------------|
| 1 | `104.168.38.162` | `racknerd-6c57489` | Legacy prod (Traefik), Infisical, Ollama | — |
| 2 | `23.95.189.106` | `racknerd-f9eb56e` | Self-hosted Plane, Zapier MCP | `zapier-mcp` (8085) |
| 3 | `107.172.94.35` | `racknerd-5a9aa1d` | **MCP + NocoDB/Twenty CRM** | `database-mcp` (5433), `assistedly-secure-mcp` (8082), `plane-mcp` (8211, broken) |
| 4 | `75.127.14.185` | `racknerd-9a7a1c2` | Dify, migration target, Infisical agent | — |
| 5 | `107.174.146.230` | `racknerd-287588f` | **MCP Hub** (SEO/Analytics) | `cloudflare-mcp` (8888), `dataforseo-mcp` (5001), `firecrawl-mcp` (8086), `posthog-mcp` (8083), `gws_mcp` (8000) |
| 6 | `172.245.119.156` | `racknerd-3870700` | Marketing automation, Zabbix, n8n | `zabbix-mcp` (3000 via 8084), `marketing-mcp` (8084) |
| 7 | `107.174.44.66` | `racknerd-4e84e0a` | Listmonk email marketing | — |
| 8 | `198.144.180.149` | `racknerd-aa30db5` | WordPress + duplicate MCPs | `firecrawl-mcp` (18086), `posthog-mcp` (18083), `dataforseo-mcp` |

---

## MCP Server Details

### Public / Exposed MCPs

| Server | Host | Port | Auth | Transport | Tools |
|--------|------|------|------|-----------|-------|
| `database-mcp` | `107.172.94.35` | `5433` | None | Streamable HTTP + SSE | `query` (SELECT only), `list_tables` |
| `zapier-mcp` | `23.95.189.106` | `8085` | Unknown | HTTP (SSE?) | Zapier automation actions |
| `cloudflare-mcp` | `107.174.146.230` | `8888` | Token via `/tmp/cloudflare-cp-run/token` | SSE | Cloudflare DNS management |
| `dataforseo-mcp` | `107.174.146.230` | `5001` | Unknown | HTTP | SEO data (rankings, keywords, backlinks) |
| `firecrawl-mcp` | `107.174.146.230` | `8086` | API key | Streamable HTTP (supergateway) | Web scraping, markdown extraction |
| `posthog-mcp` | `107.174.146.230` | `8083` | API key | Streamable HTTP (supergateway) | Analytics queries, events, funnels |
| `gws_mcp` | `107.174.146.230` | `8000` | OAuth / service account | HTTP (Docker) | Google Workspace tools |
| `zabbix-mcp` | `172.245.119.156` | `8084` (→ container 3000) | Unknown | HTTP (Docker) | Zabbix monitoring data |
| `marketing-mcp` | `172.245.119.156` | `8084` (Docker) | Unknown | HTTP | Marketing automation |
| `firecrawl-mcp` (alt) | `198.144.180.149` | `18086` | API key | Streamable HTTP | Same as above |
| `posthog-mcp` (alt) | `198.144.180.149` | `18083` | API key | Streamable HTTP | Same as above |
| `dataforseo-mcp` (alt) | `198.144.180.149` | TBD | Unknown | HTTP | Same as above |

### Localhost-bound MCPs (SSH tunnel required)

| Server | Host | Port | Auth | Access |
|--------|------|------|------|--------|
| `assistedly-secure-mcp` | `107.172.94.35` | `8082` | JWT (`MCP_JWT_SECRET`) | `ssh -L 8082:127.0.0.1:8082 root@107.172.94.35` |
| `plane-mcp` | `107.172.94.35` | `8211` | Broken (101k restarts) | **Do not use** |

---

## Per-Server Breakdown

### 1. `104.168.38.162` — Legacy Production
- **Role:** Legacy assistedly.ai prod (Docker Compose + Traefik)
- **Containers:** `yourls-app`, `yourls-db`, `infisical`, `infisical-db`, `infisical-redis`, `assistedly-traefik-1`
- **Services:** `ollama.service` (local LLM, port 38773), `keystash.service`, `zabbix_agent2` (port 10050)
- **Ports:** 80, 443, 8080 (Traefik), 631 (CUPS)
- **MCP:** None
- **Note:** Disk constrained; migrate workloads to `75.127.14.185`

### 2. `23.95.189.106` — Plane + Zapier
- **Role:** Self-hosted Plane (project management) + Zapier MCP bridge
- **Containers:** `zapier-mcp`, `code-beat-worker-1`, `code-worker-1`, `code-api-1`, `code-plane-db-1`, `code-plane-mq-1`, `code-space-1`, `code-admin-1`, `code-live-1`, `code-web-1`, `code-proxy-1`, `code-plane-minio-1`, `code-plane-redis-1`
- **Ports:** 80, 443, 8085 (zapier-mcp), 8080, 20241 (cloudflared), 12345 (alloy)
- **MCP:** `zapier-mcp` on `8085` (Docker port 3000→8085)

### 3. `107.172.94.35` — MCP + CRM Hub
- **Role:** Assistedly care-intelligence MCPs, NocoDB/Twenty CRM
- **Containers:** `assistedly-secure-mcp` (port 8082 localhost), NocoDB/Twenty on port 3002
- **Services:** `database-mcp.service` (5433), `plane-mcp.service` (8211, crash-loop)
- **MCPs:**
  - `database-mcp` — read-only NocoDB Postgres (`query`, `list_tables`)
  - `assistedly-secure-mcp` — care matching, business context, prompts (JWT auth)
  - `plane-mcp` — **broken**, 101k+ restarts
- **See:** Full details in [references/mcp-servers.md](references/mcp-servers.md)

### 4. `75.127.14.185` — Dify + Migration Target
- **Role:** Dify AI platform, Infisical agent, Grafana, Ollama
- **Containers:** `grafana`, `dify-db_postgres-1`, `assistedlyai-web-1`, `ollama`, `dify-nginx-1`, `dify-worker-1`, `dify-worker_beat-1`, `funny_stonebraker`
- **Services:** `infisical-agent.service` (renders secrets for Assistedly)
- **Ports:** 80, 5003, 3003 (Dify), 3000, 9999 (uvicorn), 20241 (cloudflared)
- **MCP:** None
- **Note:** Target for migrating `104.168.38.162` workloads

### 5. `107.174.146.230` — MCP Hub (SEO / Analytics)
- **Role:** Central MCP server for external tool APIs
- **Containers:** `gws_mcp` (8000)
- **Services:** `dataforseo-mcp.service` (5001), `firecrawl-mcp.service` (8086), `posthog-mcp.service` (8083), `nginx`
- **Processes:**
  - `cloudflare_mcp_server.py` → port 8888
  - `dataforseo-mcp/server.js` → port 5001
  - `firecrawl-mcp` (supergateway) → port 8086
  - `posthog-mcp` (supergateway) → port 8083
- **MCPs:** 5 active MCP servers on this host

### 6. `172.245.119.156` — Marketing + Monitoring
- **Role:** Marketing automation (n8n), Zabbix monitoring, marketing MCP
- **Containers:** `marketing-mcp` (3000→8084), `n8n-n8n-1`, `n8n-cloudflared-1`, `zabbix-mcp-server`
- **Services:** `nginx`
- **Ports:** 80, 443, 8084 (marketing-mcp), 3000 (zabbix-mcp), 15678 (n8n?)
- **MCPs:** `marketing-mcp`, `zabbix-mcp`

### 7. `107.174.44.66` — Listmonk Email
- **Role:** Email marketing via Listmonk
- **Containers:** `listmonk_app`, `listmonk_db`
- **Services:** `nginx`
- **Ports:** 9000 (Listmonk), 3000 (node), 4000 (node), 80, 12345 (alloy)
- **MCP:** None

### 8. `198.144.180.149` — WordPress + Alt MCPs
- **Role:** WordPress (`assistedlywp-*`), duplicate MCP instances
- **Containers:** `assistedlywp-wordpress-1`, `assistedlywp-phpmyadmin-1`, `assistedlywp-db-1`
- **Services:** `dataforseo-mcp.service`, `firecrawl-mcp.service`, `posthog-mcp.service`, `nginx`
- **Ports:** 80, 443, 8080, 8081 (phpMyAdmin), 5432
- **MCPs:** `firecrawl-mcp` (18086), `posthog-mcp` (18083), `dataforseo-mcp`
- **Note:** These are secondary/alternate instances of MCPs also on `107.174.146.230`

---

## SSH Quick Reference

```bash
# Connect to any server
ssh -i ~/.ssh/7-5-25kuroit root@<IP>

# Port-forward MCP endpoints locally
# Example: forward database-mcp + secure-mcp from 107.172.94.35
ssh -L 5433:127.0.0.1:5433 -L 8082:127.0.0.1:8082 \
  -i ~/.ssh/7-5-25kuroit root@107.172.94.35 -N

# Forward MCP hub from 107.174.146.230
ssh -L 8888:127.0.0.1:8888 -L 5001:127.0.0.1:5001 -L 8086:127.0.0.1:8086 -L 8083:127.0.0.1:8083 -L 8000:127.0.0.1:8000 \
  -i ~/.ssh/7-5-25kuroit root@107.174.146.230 -N
```

---

## Fleet Health Check

```bash
# Run fleet-doctor on default host
ssh -i ~/.ssh/7-5-25kuroit root@107.172.94.35 \
  "python3 /opt/fleet-agent/scripts/fleet-doctor.py 127.0.0.1 swap 0"

# Full fleet scan (from local inventory)
for ip in $(jq -r '.servers[].id' scripts/ops/server-inventory.json); do
  echo "=== $ip ==="
  ssh -o ConnectTimeout=3 -i ~/.ssh/7-5-25kuroit root@$ip \
    "uptime; systemctl is-active docker; docker ps -q | wc -l" 2>/dev/null
done
```

---

## Approval Gate

Per `.cursor/rules/server-ops-monitoring.mdc`:
- **Read-only** scans: allowed without approval
- **Mutating actions** (reboot, restart, cleanup, deploy): require user **`!!APPROVED`** in Discord ops channel
- Post proposed actions to Discord via `npm run ops:discord` before executing

---

## References

- **[references/mcp-servers.md](references/mcp-servers.md)** — Full MCP connection matrix, auth details, and troubleshooting per server
- **[references/server-roles.md](references/server-roles.md)** — Service directory per host (systemd, Docker, ports)
