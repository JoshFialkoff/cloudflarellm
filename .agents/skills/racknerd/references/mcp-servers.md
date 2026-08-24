# RackNerd MCP Servers — Full Connection & Auth Reference

## SSH Defaults
- **Key:** `~/.ssh/7-5-25kuroit`
- **User:** `root`
- **Inventory:** `scripts/ops/server-inventory.json`

---

## MCP Server Matrix (All Servers)

| Server | Host | Port | Public? | Transport | Auth | Status |
|--------|------|------|---------|-----------|------|--------|
| `database-mcp` | `107.172.94.35` | `5433` | ✅ | Streamable HTTP + SSE | None | ✅ Active |
| `assistedly-secure-mcp` | `107.172.94.35` | `8082` | ❌ (localhost) | HTTP (Fastify) | JWT | ✅ Healthy |
| `plane-mcp` | `107.172.94.35` | `8211` | ❌ (localhost) | HTTP | Env-based | ⚠️ Crash-loop |
| `zapier-mcp` | `23.95.189.106` | `8085` | ✅ | HTTP | Unknown | ✅ Active |
| `cloudflare-mcp` | `107.174.146.230` | `8888` | ✅ | SSE | Token file | ✅ Active |
| `dataforseo-mcp` | `107.174.146.230` | `5001` | ✅ | HTTP | Unknown | ✅ Active |
| `firecrawl-mcp` | `107.174.146.230` | `8086` | ✅ | Streamable HTTP | API key | ✅ Active |
| `posthog-mcp` | `107.174.146.230` | `8083` | ✅ | Streamable HTTP | API key | ✅ Active |
| `gws_mcp` | `107.174.146.230` | `8000` | ✅ | HTTP (Docker) | OAuth / SA | ✅ Active |
| `marketing-mcp` | `172.245.119.156` | `8084` | ✅ | HTTP (Docker) | Unknown | ✅ Active |
| `zabbix-mcp` | `172.245.119.156` | `3000` | ✅ (via Docker) | HTTP (Docker) | Unknown | ✅ Active |
| `firecrawl-mcp` (alt) | `198.144.180.149` | `18086` | ✅ | Streamable HTTP | API key | ✅ Active |
| `posthog-mcp` (alt) | `198.144.180.149` | `18083` | ✅ | Streamable HTTP | API key | ✅ Active |
| `dataforseo-mcp` (alt) | `198.144.180.149` | TBD | ✅ | HTTP | Unknown | ✅ Active |

---

## 107.172.94.35 — Database MCP

**Process:** `python3 /opt/mcp-env/database-mcp-server.py` (systemd `database-mcp.service`)
**Port:** `0.0.0.0:5433`

### Tools

#### `query` — Read-only SELECT
```bash
curl -s -X POST http://107.172.94.35:5433/tools/call \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "query",
      "arguments": { "sql": "SELECT * FROM nc_t7um___foia_alr LIMIT 5" }
    }
  }'
```
Safety: rejects any SQL not starting with `SELECT`.

#### `list_tables`
```bash
curl -s -X POST http://107.172.94.35:5433/tools/call \
  -H 'Content-Type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "list_tables",
      "arguments": {}
    }
  }'
```

---

## 107.172.94.35 — Assistedly Secure MCP

**Container:** `assistedly-secure-mcp` (Docker)
**Port:** `127.0.0.1:8082`

### Architecture
- Framework: `@modelcontextprotocol/sdk` v1.30.0
- Runtime: Node.js ≥22, TypeScript → `dist/server.js`
- HTTP: Fastify with rate-limit middleware
- Security: `jose` (JWT), Zod validation, audit logger

### Tools

#### `find_matching_options`
```json
{
  "name": "find_matching_options",
  "arguments": {
    "consentedCaseId": "case_abc123",
    "criteria": {
      "careNeeds": "assisted",
      "budget": "4000_6000",
      "location": "boston",
      "timing": "soon",
      "priorities": ["walkable", "pet_friendly"]
    },
    "maxResults": 10
  }
}
```

#### `get_option_summary`
```json
{
  "name": "get_option_summary",
  "arguments": { "optionId": 42 }
}
```

#### `create_follow_up_draft`
```json
{
  "name": "create_follow_up_draft",
  "arguments": {
    "consentedCaseId": "case_abc123",
    "optionIds": [42, 7],
    "followUpType": "email_family"
  }
}
```
Types: `email_family`, `email_facility`, `internal_note`.

#### `get_business_context`
```json
{
  "name": "get_business_context",
  "arguments": { "phase": "NOW" }
}
```
Phases: `NOW`, `NEXT`, `LATER`, `ALL`.

### Prompts
- `business_plan_summary` — Now/Next/Later framing
- `investor_pitch` — 60-second pitch with metrics

### Auth
JWT secret at `/opt/assistedly-secure-mcp/.env`:
```
MCP_JWT_SECRET=t8ZMNVTnQ8SEDvlE0jstgNUKzT/1mm0zxqEwIh8KDIk=
NODE_ENV=production
```
⚠️ **Never expose in chat.**

### Rate Limits
| Limit | Value |
|-------|-------|
| Per minute | 30 |
| Per hour | 300 |
| Per day | 1,000 |
| Concurrent | 5 per user |
| Unique records/day | 500 |
| Byte cap/day | 5 MB |

### Access via tunnel
```bash
ssh -L 8082:127.0.0.1:8082 -i ~/.ssh/7-5-25kuroit root@107.172.94.35 -N
curl -s http://localhost:8082/mcp/v1/tools \
  -H "Authorization: Bearer $MCP_JWT"
```

---

## 23.95.189.106 — Zapier MCP

**Container:** `zapier-mcp`
**Port:** `8085` (Docker 3000→8085)

### Discovery
```bash
curl -s http://23.95.189.106:8085/zapier/sse
curl -s http://23.95.189.106:8085/sse
curl -s http://23.95.189.106:8085/
```

### Context
Runs alongside self-hosted Plane (`code-*` containers: api, web, worker, space, proxy, redis, db, mq, minio).

---

## 107.174.146.230 — MCP Hub

### Cloudflare MCP (8888)
**Process:** `python3 /opt/cloudflare-mcp/cloudflare_mcp_server.py`
**Auth:** Token from `/tmp/cloudflare-mcp-run/token`
**Transport:** SSE

```bash
curl -s http://107.174.146.230:8888/sse
curl -s -H "Authorization: Bearer $(cat /tmp/cloudflare-cp-run/token)" \
  http://107.174.146.230:8888/tools/list
```

### DataForSEO MCP (5001)
**Process:** `node /opt/dataforseo-mcp/server.js`
**Framework:** Express

```bash
curl -s http://107.174.146.230:5001/mcp/v1/tools \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Firecrawl MCP (8086)
**Process:** `supergateway` wrapping `firecrawl-mcp`
**Transport:** Streamable HTTP

```bash
curl -s http://107.174.146.230:8086/mcp/v1/tools \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### PostHog MCP (8083)
**Process:** `supergateway` wrapping `posthog-mcp-server`
**Transport:** Streamable HTTP

```bash
curl -s http://107.174.146.230:8083/mcp/v1/tools \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Google Workspace MCP (8000)
**Container:** `gws_mcp`
**Port:** `8000`

```bash
curl -s http://107.174.146.230:8000/mcp/v1/tools \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

---

## 172.245.119.156 — Marketing + Zabbix MCPs

### Marketing MCP (8084)
**Container:** `marketing-mcp` (Docker 3000→8084)

```bash
curl -s http://172.245.119.156:8084/mcp/v1/tools \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### Zabbix MCP (3000)
**Container:** `zabbix-mcp-server`
**Note:** Docker maps container port 3000 to host port 3000 directly

```bash
curl -s http://172.245.119.156:3000/mcp/v1/tools \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

---

## 198.144.180.149 — Alt MCPs

### Firecrawl MCP (18086)
```bash
curl -s http://198.144.180.149:18086/mcp/v1/tools \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### PostHog MCP (18083)
```bash
curl -s http://198.144.180.149:18083/mcp/v1/tools \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

---

## Troubleshooting

| Symptom | Server(s) | Fix |
|---------|-----------|-----|
| `database-mcp` 5433 refuses | `107.172.94.35` | `systemctl restart database-mcp` |
| Secure MCP returns 401 | `107.172.94.35` | Regenerate JWT with `MCP_JWT_SECRET` |
| Secure MCP unhealthy | `107.172.94.35` | `docker restart assistedly-secure-mcp` |
| Plane MCP not on 8211 | `107.172.94.35` | Check `journalctl -u plane-mcp`; fix env |
| Cloudflare MCP 403 | `107.174.146.230` | Verify `/tmp/cloudflare-cp-run/token` exists |
| supergateway MCP offline | `107.174.146.230`, `198.144.180.149` | Restart systemd service (`firecrawl-mcp`, `posthog-mcp`) |
| Zapier MCP unreachable | `23.95.189.106` | `docker restart zapier-mcp` |
| Marketing MCP down | `172.245.119.156` | `docker restart marketing-mcp` |

---

## Secrets Locations (root access required)

| Server | File | Contents |
|--------|------|----------|
| `107.172.94.35` | `/opt/assistedly-secure-mcp/.env` | `MCP_JWT_SECRET` |
| `107.172.94.35` | `/etc/plane-mcp.env` | Plane API credentials |
| `107.174.146.230` | `/tmp/cloudflare-cp-run/token` | Cloudflare API token |
| Various | `/opt/*-mcp/` | API keys for DataForSEO, Firecrawl, PostHog |

⚠️ **Never print secret values in chat or logs.**
