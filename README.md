# Smart LLM Router v9.7

OpenAI-compatible chat completions router for Cloudflare Workers AI.

## What it does

- Accepts `POST /v1/chat/completions` (OpenAI-compatible)
- Routes requests through 5 models in order, trying the next on failure:
  1. `@cf/nvidia/nemotron-3-120b-a12b` — best for agents/tool calling
  2. `@cf/moonshotai/kimi-k2.6` — multi-turn tool calling, 262k context
  3. `@cf/openai/gpt-oss-120b` — reasoning + function calling
  4. `@cf/qwen/qwen3-30b-a3b-fp8` — agent capabilities
  5. `@cf/openai/gpt-oss-20b` — fallback
- Uses the REST API (not the AI binding) for proper `tool_calls` format
- Forces `tool_choice: "required"` when tools are present
- Routes through AI Gateway

## Deploy

```bash
npx wrangler deploy
```

## Set secrets

```bash
npx wrangler secret put CF_API_TOKEN
npx wrangler secret put ROUTER_API_KEY
```

## Health check

```bash
curl https://smart-llm-router.forwardjump-com198.workers.dev/health
```

## Endpoints

- `POST /v1/chat/completions` — OpenAI-compatible chat completions
- `GET /v1/models` — list available models
- `GET /health` — health check

## Why REST API instead of env.AI.run()

The `env.AI.run()` binding doesn't properly support function calling —
models return text instead of `tool_calls` even with `tool_choice: "required"`.
The REST API at `api.cloudflare.com/client/v4/accounts/{id}/ai/v1/chat/completions`
returns proper OpenAI-format `tool_calls` that clients like Goose can parse and execute.

## Important: API Token

The `CF_API_TOKEN` secret must be a valid Cloudflare API token with
**Workers AI Read** permission. Create one at:
My Profile -> API Tokens -> Create Token -> Custom Token

Set it with no expiration to avoid daily breakage:
```bash
npx wrangler secret put CF_API_TOKEN
```
