# RackNerd Server Roles — Per-Host Service Directory

## 1. `104.168.38.162` (`racknerd-6c57489`)

**Primary role:** Legacy production hosting, Infisical, Ollama local LLM, YOURLS URL shortener  
**Status:** Disk constrained; migrate to `75.127.14.185`

### systemd services
| Service | Status | Port | Description |
|---------|--------|------|-------------|
| `docker.service` | active | — | Docker daemon |
| `containerd.service` | active | — | Container runtime |
| `ollama.service` | active | 38773 | Local LLM inference |
| `keystash.service` | active | — | SSH key manager |
| `zabbix_agent2` | active | 10050 | Monitoring agent |
| `cron.service` | active | — | Cron daemon |
| `rsyslog.service` | active | — | System logging |
| `snapd.service` | active | — | Snap packages |

### Docker containers
| Container | Image | Ports | Notes |
|-----------|-------|-------|-------|
| `yourls-app` | yourls | 8080→? | URL shortener app |
| `yourls-db` | mysql/mariadb | — | YOURLS database |
| `infisical` | infisical | — | Secret management UI/API |
| `infisical-db` | postgres | — | Infisical database |
| `infisical-redis` | redis | — | Infisical cache |
| `assistedly-traefik-1` | traefik | 80, 443 | Reverse proxy |

### Network ports
| Port | Bind | Process | Purpose |
|------|------|---------|---------|
| 80 | 0.0.0.0 | docker-proxy | Traefik HTTP |
| 443 | 0.0.0.0 | docker-proxy | Traefik HTTPS |
| 8080 | 0.0.0.0 | docker-proxy | Traefik dashboard |
| 38773 | 127.0.0.1 | llama-server | Ollama API |
| 10050 | * | zabbix_agent2 | Zabbix monitoring |
| 631 | 0.0.0.0 | cupsd | Printing |

---

## 2. `23.95.189.106` (`racknerd-f9eb56e`)

**Primary role:** Self-hosted Plane (project management), Zapier MCP bridge  
**Containers prefix:** `code-`

### Docker containers
| Container | Role |
|-----------|------|
| `zapier-mcp` | Zapier MCP server (port 8085) |
| `code-api-1` | Plane API backend |
| `code-web-1` | Plane web frontend |
| `code-worker-1` | Plane background worker |
| `code-beat-worker-1` | Plane scheduled tasks |
| `code-space-1` | Plane workspace engine |
| `code-admin-1` | Plane admin panel |
| `code-live-1` | Plane live updates |
| `code-proxy-1` | Plane proxy |
| `code-plane-db-1` | Plane PostgreSQL |
| `code-plane-mq-1` | Plane message queue |
| `code-plane-redis-1` | Plane Redis cache |
| `code-plane-minio-1` | Plane object storage |

### Network ports
| Port | Bind | Process | Purpose |
|------|------|---------|---------|
| 80 | 0.0.0.0 | docker-proxy | Plane web / proxy |
| 443 | 0..0.0.0 | docker-proxy | Plane HTTPS |
| 8085 | 0.0.0.0 | docker-proxy | Zapier MCP |
| 8080 | 0.0.0.0 | docker-proxy | Alternate web |
| 20241 | 127.0.0.1 | cloudflared | Cloudflare tunnel |
| 12345 | 127.0.0.1 | alloy | Grafana Alloy agent |

---

## 3. `107.172.94.35` (`racknerd-5a9aa1d`)

**Primary role:** MCP servers, NocoDB/Twenty CRM, Dify co-location

### systemd services
| Service | Status | Port | Description |
|---------|--------|------|-------------|
| `database-mcp.service` | active | 5433 | Read-only SQL MCP |
| `plane-mcp.service` | crash-loop | 8211 | Plane MCP (broken) |

### Docker containers
| Container | Ports | Health | Description |
|-----------|-------|--------|-------------|
| `assistedly-secure-mcp` | 127.0.0.1:8082 | healthy | Care-intelligence MCP (JWT auth) |
| NocoDB/Twenty CRM | 0.0.0.0:3002 | healthy | Customer database |

### Network ports
| Port | Bind | Process | Purpose |
|------|------|---------|---------|
| 5433 | 0.0.0.0 | python3 | Database MCP |
| 8082 | 127.0.0.1 | docker-proxy | Secure MCP (localhost only) |
| 3002 | 0.0.0.0 | docker-proxy | NocoDB / Twenty CRM |
| 8211 | 127.0.0.1 | uv | Plane MCP (intended) |
| 2377 | * | dockerd | Docker Swarm control |
| 7946 | * | dockerd | Docker Swarm gossip |

---

## 4. `75.127.14.185` (`racknerd-9a7a1c2`)

**Primary role:** Dify AI platform, Infisical agent, Grafana, migration target  
**Note:** `assistedly.ai` primary traffic migrated to Cloudflare Workers; this host runs Dify + edge services

### systemd services
| Service | Status | Description |
|---------|--------|-------------|
| `docker.service` | active | Docker daemon |
| `infisical-agent.service` | active | Renders secrets for Assistedly |

### Docker containers
| Container | Role |
|-----------|------|
| `dify-nginx-1` | Dify reverse proxy (port 80) |
| `dify-db_postgres-1` | Dify PostgreSQL |
| `dify-worker-1` | Dify background worker |
| `dify-worker_beat-1` | Dify scheduled tasks |
| `assistedlyai-web-1` | Assistedly web (legacy) |
| `grafana` | Observability dashboards |
| `ollama` | Local LLM inference |
| `funny_stonebraker` | Unknown (investigate) |

### Network ports
| Port | Bind | Process | Purpose |
|------|------|---------|---------|
| 80 | 0.0.0.0 | docker-proxy | Dify nginx |
| 3003 | 127.0.0.1 | docker-proxy | Dify internal |
| 3000 | 127.0.0.1 | docker-proxy | Dify app |
| 5003 | 0.0.0.0 | docker-proxy | Unknown service |
| 9999 | 127.0.0.1 | uvicorn | Unknown (likely Dify API) |
| 20241 | 127.0.0.1 | cloudflared | Cloudflare tunnel |

---

## 5. `107.174.146.230` (`racknerd-287588f`)

**Primary role:** MCP Hub — external API MCP servers (Cloudflare, DataForSEO, Firecrawl, PostHog, Google Workspace)

### systemd services
| Service | Status | Port | Description |
|---------|--------|------|-------------|
| `nginx.service` | active | 8887 | Reverse proxy |
| `dataforseo-mcp.service` | active | 5001 | SEO data MCP |
| `firecrawl-mcp.service` | active | 8086 | Web scraping MCP |
| `posthog-mcp.service` | active | 8083 | Analytics MCP |

### Processes
| Process | Port | Description |
|---------|------|-------------|
| `cloudflare_mcp_server.py` | 8888 | Cloudflare DNS MCP (SSE) |
| `node /opt/dataforseo-mcp/server.js` | 5001 | DataForSEO MCP |
| `supergateway` + `firecrawl-mcp` | 8086 | Firecrawl MCP |
| `supergateway` + `posthog-mcp-server` | 8083 | PostHog MCP |

### Docker containers
| Container | Port | Description |
|-----------|------|-------------|
| `gws_mcp` | 8000 | Google Workspace MCP |

### Network ports
| Port | Bind | Process | Purpose |
|------|------|---------|---------|
| 8888 | 0.0.0.0 | python3 | Cloudflare MCP |
| 8887 | 0.0.0.0 | nginx | Reverse proxy |
| 5001 | 0.0.0.0 | python3 | DataForSEO MCP |
| 8086 | * | node | Firecrawl MCP |
| 8083 | * | node | PostHog MCP |
| 8000 | 0.0.0.0 | docker-proxy | Google Workspace MCP |
| 20241 | 127.0.0.1 | cloudflared | Cloudflare tunnel |

---

## 6. `172.245.119.156` (`racknerd-3870700`)

**Primary role:** Marketing automation (n8n), Zabbix monitoring MCP, marketing MCP

### systemd services
| Service | Status | Description |
|---------|--------|-------------|
| `nginx.service` | active | Reverse proxy |
| `docker.service` | active | Docker daemon |

### Docker containers
| Container | Host Port | Description |
|-----------|-----------|-------------|
| `marketing-mcp` | 8084 | Marketing automation MCP |
| `zabbix-mcp-server` | 3000 | Zabbix monitoring MCP |
| `n8n-n8n-1` | 15678? | Workflow automation |
| `n8n-cloudflared-1` | — | Tunnel for n8n |

### Network ports
| Port | Bind | Process | Purpose |
|------|------|---------|---------|
| 80 | 0.0.0.0 | nginx | HTTP |
| 443 | 0.0.0.0 | nginx | HTTPS |
| 8084 | 0.0.0.0 | docker-proxy | Marketing MCP |
| 3000 | 0.0.0.0 | docker-proxy | Zabbix MCP |
| 15678 | 127.0.0.1 | docker-proxy | n8n? |

---

## 7. `107.174.44.66` (`racknerd-4e84e0a`)

**Primary role:** Listmonk email marketing platform

### systemd services
| Service | Status | Description |
|---------|--------|-------------|
| `nginx.service` | active | Reverse proxy |
| `docker.service` | active | Docker daemon |

### Docker containers
| Container | Description |
|-----------|-------------|
| `listmonk_app` | Email marketing app |
| `listmonk_db` | PostgreSQL for Listmonk |

### Network ports
| Port | Bind | Process | Purpose |
|------|------|---------|---------|
| 9000 | 0.0.0.0 | docker-proxy | Listmonk app |
| 3000 | 0.0.0.0 | node | Unknown Node app |
| 4000 | 127.0.0.1 | node | Unknown Node app |
| 80 | 0.0.0.0 | nginx | HTTP |
| 12345 | 127.0.0.1 | alloy | Grafana Alloy |

---

## 8. `198.144.180.149` (`racknerd-aa30db5`)

**Primary role:** WordPress site + alternate MCP instances

### systemd services
| Service | Status | Port | Description |
|---------|--------|------|-------------|
| `nginx.service` | active | 80/443/8080 | Reverse proxy |
| `dataforseo-mcp.service` | active | TBD | SEO data MCP |
| `firecrawl-mcp.service` | active | 18086 | Web scraping MCP |
| `posthog-mcp.service` | active | 18083 | Analytics MCP |

### Docker containers
| Container | Description |
|-----------|-------------|
| `assistedlywp-wordpress-1` | WordPress app |
| `assistedlywp-db-1` | WordPress MySQL |
| `assistedlywp-phpmyadmin-1` | phpMyAdmin UI |

### Network ports
| Port | Bind | Process | Purpose |
|------|------|---------|---------|
| 80 | 0.0.0.0 | nginx | WordPress HTTP |
| 443 | 0.0.0.0 | nginx | WordPress HTTPS |
| 8080 | 0.0.0.0 | nginx | Secondary nginx |
| 8081 | 0.0.0.0 | docker-proxy | phpMyAdmin |
| 5432 | 127.0.0.1 | postgres | Local PostgreSQL |
| 18086 | * | node | Firecrawl MCP (alt) |
| 18083 | * | node | PostHog MCP (alt) |

---

## Fleet Quick Inventory Commands

```bash
# All services across fleet
for ip in $(jq -r '.servers[].id' scripts/ops/server-inventory.json); do
  echo "=== $ip ==="
  ssh -o ConnectTimeout=3 -i ~/.ssh/7-5-25kuroit root@$ip \
    "hostname; echo '---systemd---'; systemctl list-units --type=service --state=running | grep -E 'mcp|docker|nginx|dify|traefik|infisical|ollama|plane|noco|listmonk|zabbix|posthog|firecrawl|dataforseo' | head -6; echo '---docker---'; docker ps --format '{{.Names}}' 2>/dev/null | head -6; echo '---ports---'; ss -tlnp 2>/dev/null | awk 'NR>1 && /LISTEN/' | head -6" 2>/dev/null || echo UNREACHABLE
  echo
done
```

## Restart Recipes

```bash
# MCP Hub (107.174.146.230)
ssh -i ~/.ssh/7-5-25kuroit root@107.174.146.230 \
  'systemctl restart dataforseo-mcp firecrawl-mcp posthog-mcp; docker restart gws_mcp'

# CRM + database MCP (107.172.94.35)
ssh -i ~/.ssh/7-5-25kuroit root@107.172.94.35 \
  'systemctl restart database-mcp; docker restart assistedly-secure-mcp'

# Marketing MCPs (172.245.119.156)
ssh -i ~/.ssh/7-5-25kuroit root@172.245.119.156 \
  'docker restart marketing-mcp zabbix-mcp-server'

# Zapier MCP (23.95.189.106)
ssh -i ~/.ssh/7-5-25kuroit root@23.95.189.106 \
  'docker restart zapier-mcp'
```
