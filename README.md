# smart-llm-router

## Versions

- `smart-llm-router.js` — **v14.0** (current) — prompt classification + category routing + auto-continuation + code sandbox + **nightly dynamic model refresh via cron trigger (12:06 AM ET)**
- `smart-llm-router-v13.js` — **v13.0** — prompt classification + category routing + auto-continuation + code sandbox (static model lists)
- `smart-llm-router-v10-ROLLBACK.js` — **v10.0** (rollback) — streaming + auto-continuation only

## Deploy

```bash
# Deploy v14.0 (current)
wrangler deploy smart-llm-router.js --name smart-llm-router --compatibility-date 2026-08-27

# Rollback to v10.0
wrangler deploy smart-llm-router-v10-ROLLBACK.js --name smart-llm-router --compatibility-date 2026-08-27
```

## Bindings

The Worker requires these bindings (configured in the dashboard or via wrangler.toml):
- `ACCOUNT_ID` (plain_text): Cloudflare account ID
- `CLOUDFLARE_API_KEY` (secrets_store): API key with Workers AI access — stored in [Cloudflare Secrets Store](https://developers.cloudflare.com/secrets-store/), accessed via `await env.CLOUDFLARE_API_KEY.get()`
- `GATEWAY_ID` (plain_text): AI Gateway ID
- `LOADER` (worker_loader): Dynamic Workers loader for code execution sandbox (optional)
- `ROUTER_KV` (kv_namespace): KV namespace for caching