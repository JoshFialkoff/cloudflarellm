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
| 13 | Orphaned DO namespace (deploy) | Previously provisioned `SandboxV2` namespace neither in code nor exports | Added `SandboxV2` tombstone (`"state": "deleted"`) in `exports` to retire it |
| 14 | Container app settings (deploy) | Worker deployed but container application settings didn't finish applying | Deploy step retries `wrangler deploy` up to 5× with 60s backoff, then a final `--containers-rollout=none` (lazy container start) — first-time container app provisioning can take several minutes |

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
# smart-llm-router — v18 (Vacillation guard: escalate to stronger LLMs)

## Problem
When a model spends too long "thinking" — debating itself, hedging endlessly,
flip-flopping between options, second-guessing, or rambling — the router used to
ship that waffle straight to the user (or, in the /agent loop, let the bot spin
its wheels for many iterations without acting).

## Fixes Applied

| # | Fix | Before | After |
|---|-----|--------|-------|
| 15 | Vacillation detection | Responses always accepted | New `detectVacillation()` scores prose for self-debate ("on one hand… on the other"), hedging, flip-flopping, self-correction, reasoning tags (`<thinking>`), and rambling; code blocks are ignored |
| 16 | Router escalation | Vacillating output returned as-is | In `callRouter`, a vacillating response is treated like a failure — logged with score + hits, falls through to the next model. If vacillation was the only failure mode, the router escalates to the **complex tier** (strongest models: gpt-oss-120b, kimi-k2.7-code, glm-5.3, deepseek-r1) before giving up |
| 17 | Agent loop escalation | Bot could deliberate forever at same tier | `/agent` counts consecutive vacillating responses; after 2, it forces the complex tier (`forceTier`) for the next iteration and sends a decisive "STOP deliberating — output one ```bash block" nudge |
| 18 | `forceTier` option | Tier fixed by classification | `callRouter({ forceTier })` lets callers (agent loop) override classification when escalation is warranted |

## Behavior notes
- Detection threshold: vacillation score ≥ 7 (weighted heuristics; a single
  "on the one hand / on the other" pair alone scores 4, so it needs corroboration).
- Streaming responses are passed through untouched (no buffering).
- Escalated results are returned with `category: "complex-escalation"` and logged
  under that tier so you can see when the guard fires.
