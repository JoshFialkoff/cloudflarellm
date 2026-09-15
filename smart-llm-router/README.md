# Smart LLM Router v12.3

OpenAI-compatible LLM router running on Cloudflare Workers. Routes requests across multiple Workers AI models with automatic capacity retry, context overflow handling, model fallthrough, tool/function-calling support, sandboxed code execution, and streaming.

## Deployed Worker

- **Name:** `smart-llm-router`
- **Version:** 12.3
- **Compatibility date:** 2026-08-27
- **Endpoint:** `POST /v1/chat/completions`
- **Health check:** `GET /health`

## Models

### Standard chain (no tools)
| # | Model |
|---|-------|
| 1 | `@cf/zai-org/glm-4.7-flash` |
| 2 | `@cf/openai/gpt-oss-20b` |
| 3 | `@cf/nvidia/nemotron-3-120b-a12b` |
| 4 | `@cf/moonshotai/kimi-k2.6` |
| 5 | `@cf/openai/gpt-oss-120b` |
| 6 | `@cf/qwen/qwen3-30b-a3b-fp8` |

### Tool-capable chain (when `tools` are provided)
| # | Model |
|---|-------|
| 1 | `@cf/moonshotai/kimi-k2.6` |
| 2 | `@cf/nvidia/nemotron-3-120b-a12b` |
| 3 | `@cf/openai/gpt-oss-20b` |
| 4 | `@cf/openai/gpt-oss-120b` |

## Bindings

| Binding | Type | Notes |
|---------|------|-------|
| `ACCOUNT_ID` | plain_text | Cloudflare account ID |
| `GATEWAY_ID` | plain_text | AI Gateway ID |
| `AI` | AI binding | Workers AI |
| `CF_API_TOKEN` | secret_text | API token for REST calls — set via `wrangler secret put CF_API_TOKEN` |
| `ROUTER_API_KEY` | secret_text | Auth key for the router endpoint — set via `wrangler secret put ROUTER_API_KEY` |
| `ROUTER_KV` | KV namespace | ID: `dbedcc63db6040bca9112a8625531a39` |
| `LOADER` | worker_loader | Sandboxed code execution (configured via dashboard/API) |

## Deploy

```bash
# 1. Install dependencies
npm install

# 2. Set secrets (one-time)
npx wrangler secret put CF_API_TOKEN
npx wrangler secret put ROUTER_API_KEY

# 3. Deploy
npx wrangler deploy
```

No global wrangler installation is required — the project uses the locally installed version.

## System Prompt

The router injects a strict system prompt that forces the model to **only** output JavaScript code in fenced code blocks. The router then extracts, validates, and executes the code safely via a sandboxed `worker_loader` binding.

## Architecture

```
Client → POST /v1/chat/completions
  → ROUTER_API_KEY auth check (if configured)
  → System prompt injection (tools vs no-tools)
  → Model chain iteration (6 models or 4 tool models)
    → REST API call to Workers AI (via AI Gateway)
    → Capacity retry (2 retries, 200ms delay)
    → Context overflow → immediate fallthrough
    → Server error → immediate fallthrough
    → Response continuation (up to 3) for truncated outputs
  → Code block extraction & sandboxed execution (no-tools mode)
  → Streaming (fake SSE) or JSON response
```
