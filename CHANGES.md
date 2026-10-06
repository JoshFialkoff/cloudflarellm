# smart-llm-router — v15 (Goose Mac routing fixes)

## Problem
The previous `src/index.js` did not route prompts to the best Cloudflare LLM:
it always used a single model, rejected SSE streaming (`400 "streaming not
supported"` — which breaks the Goose app for Mac), had no `/v1/models`, no
tool-call support, no capacity fallback, and used the wrong Sandbox SDK API
(`DurableObject` + `ctx.container` instead of SDK 1.0 `getSandbox` + `exec`).

## Fixes Applied

| # | Fix | Before | After |
|---|-----|--------|-------|
| 1 | Sandbox SDK 1.0 API | `DurableObject` from `cloudflare:workers`, `ctx.container` | `getSandbox(env.SANDBOX, id)` + `sandbox.exec(argv)` + `process.output({encoding:"utf8"})` |
| 2 | Task classification | single model (`llama-3.3-70b`) | Ported `classifyPrompt()` + `CODING_PATTERNS` from smart-llm-router v14; routes coding → coding models, general → general models, tools → tool models |
| 3 | SSE streaming | `400 "streaming not supported"` | Pass-through SSE from Cloudflare REST `/ai/v1/chat/completions` with cross-model fallback |
| 4 | `/v1/models` | missing | OpenAI-compatible list from KV cache + fallbacks |
| 5 | Tool calls | not passed through | `tools`/`tool_choice` forwarded; `tool_calls` returned in responses |
| 6 | Capacity fallback | none | Per-tier fallback + retry on capacity (3040) + coding → general fallback |
| 7 | Context trimming | none | `fitToContextWindow()` to 18k tokens before calling models |
| 8 | Auto-continuation | none | Continues on `finish_reason: length` (max 3) |
| 9 | Model catalog refresh | none | `POST /v1/refresh-models` + cron triggers, cached in `ROUTER_KV` |
| 10 | File upload | `String.fromCharCode(...bytes)` crashed on large files | Chunked base64 conversion |
| 11 | Config | `wrangler.jsonc` reverted to v3 | Merged: containers + DO + `ROUTER_KV` + `ACCOUNT_ID`/`GATEWAY_ID` vars + crons |
| 12 | Secrets Store auth (deploy error 10021) | `secrets_store_secrets` binding failed in CI | Dropped Secrets Store; `CLOUDFLARE_API_KEY` is a plain Worker secret set by CI (`wrangler secret put`); code accepts string or client binding |

## Endpoints
- `POST /v1/chat/completions` — OpenAI-compatible, SSE streaming + tools, router headers (`x-router-model`, `x-router-category`, `x-router-classification-score`)
- `GET /v1/models` — model list
- `POST /v1/refresh-models` — refresh model catalog into KV
- `GET /health` — status + active per-tier models
- `POST /agent` — sandboxed shell agent (multipart or JSON), now also uses the router
- `GET /file?session=..&path=..` — download file from sandbox

## Deploy
```bash
npm install
npx wrangler deploy --containers-rollout=immediate
```

CI requires the GitHub secrets:
- `CLOUDFLARE_API_TOKEN` — deploy token (Workers Scripts:Edit)
- `CLOUDFLARE_API_KEY` — optional; token for the AI REST endpoint (falls back to `CLOUDFLARE_API_TOKEN`)