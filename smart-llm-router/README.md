# Smart LLM Router v12.2 - Shell-Only Mode

OpenAI-compatible LLM router running on Cloudflare Workers with **shell/bash code execution enforcement**.

## Deployed Worker

- **Name:** `smart-llm-router`
- **Version:** 12.2
- **Mode:** Shell-only code execution
- **Compatibility date:** 2026-01-01
- **Endpoint:** `POST /v1/chat/completions`
- **Health check:** `GET /health`

## Models

All models are filtered to support direct shell/bash code generation:

### Standard chain (no tools)
| # | Model |
|---|-------|
| 1 | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| 2 | `@cf/meta/llama-3-70b-instruct` |
| 3 | `@cf/mistralai/mistral-large` |
| 4 | `@cf/qwen/qwen2.5-coder-32b-instruct` |

### Tool-capable chain (when `tools` are provided)
| # | Model |
|---|-------|
| 1 | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` |
| 2 | `@cf/meta/llama-3-70b-instruct` |
| 3 | `@cf/mistralai/mistral-large` |

## Code Execution

- **Supported:** Only `bash`, `sh`, `shell` code blocks
- **Extracted:** Regex filters for shell-only blocks
- **Validated:** Forbidden patterns check (JavaScript, TypeScript, Python, Ruby, Go, Rust, C++, C#, Java, Kotlin)
- **Executed:** Via `child_process.spawn('bash', ['-c', code])` in sandboxed workers

## System Prompt

The router injects a system prompt that forces shell-code-only output:

```
CRITICAL RULE: You MUST output ONLY shell/bash code in fenced code blocks. 
Your code must be directly executable bash (#!/bin/bash compatible). 
You CANNOT output JavaScript, TypeScript, Python, or any other language.
```

## Bindings

| Binding | Type | Notes |
|---------|------|-------|
| `ACCOUNT_ID` | plain_text | Cloudflare account ID |
| `GATEWAY_ID` | plain_text | AI Gateway ID (optional) |
| `CF_API_TOKEN` | secret_text | API token for REST calls — set via `wrangler secret put CF_API_TOKEN` |
| `ROUTER_API_KEY` | secret_text | Auth key for the router endpoint — set via `wrangler secret put ROUTER_API_KEY` |
| `LOADER` | worker_loader | Sandboxed code execution (required for shell code) |

## Deploy

```bash
npm install -g wrangler
cd smart-llm-router
wrangler secret put CF_API_TOKEN
wrangler secret put ROUTER_API_KEY
wrangler deploy
```

## Architecture

```
Client → POST /v1/chat/completions
  → System prompt injection (shell-code enforcement)
  → Model chain iteration (4 models or 3 tool models)
    → REST API call to Workers AI (via AI Gateway)
    → Capacity retry (2 retries, 200ms delay)
    → Context overflow → immediate fallthrough
    → Server error → immediate fallthrough
    → Response continuation (up to 3) for truncated outputs
  → Shell code block extraction & validation
  → Sandboxed bash execution (via child_process)
  → Streaming (fake SSE) or JSON response
```

## Response Headers

- `x-router-model`: Selected model ID
- `x-router-transport`: `rest-api`
- `x-router-mode`: `shell-only`

## Example Request

```bash
curl -X POST https://smart-llm-router.workers.dev/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Count the lines in /etc/passwd"}
    ],
    "stream": false
  }'
```

Expected response includes shell code block that gets executed, with results in `code_execution` field.
