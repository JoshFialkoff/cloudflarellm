# smart-llm-router with Sandbox SDK

Enforces that LLMs code directly in an isolated Cloudflare Sandbox container — a real Linux shell environment with Python, Node.js, git, and more.

## Architecture

```
User -> POST / -> Worker (smart-llm-router)
                       |-- Calls LLM API (OpenAI / Workers AI)
                       |-- Parses ```bash code blocks from response
                       |-- Executes via sandbox.exec() in isolated container
                       |-- Feeds stdout/stderr back to LLM
                       +-- Loops until TASK_COMPLETE or max iterations
```

Each session gets its own isolated Linux container (Durable Object-backed) with:
- Full shell access (bash)
- Python 3, Node.js, npm, pip, git, curl
- Persistent filesystem (/workspace)
- Streaming output

## Setup

```bash
npm install
```

Set your LLM API key as a secret:
```bash
npx wrangler secret put OPENAI_API_KEY
```

Optional: override the model or endpoint:
```bash
npx wrangler secret put LLM_MODEL    # e.g. gpt-4o
npx wrangler secret put LLM_ENDPOINT # custom OpenAI-compatible endpoint
```

To use Cloudflare Workers AI instead, uncomment Option A in `src/index.js` and add an AI binding to `wrangler.jsonc`.

## Deploy

```bash
npx wrangler deploy
```

The first deploy builds the container image — this can take a few minutes.

## Usage

```bash
curl -X POST https://smart-llm-router.<your-subdomain>.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create a Python script that prints the first 10 Fibonacci numbers, then run it",
    "sessionId": "test-1"
  }'
```

Response includes the full execution log — every command the LLM ran and its output.

## How enforcement works

1. The system prompt **mandates** that all output must be shell commands in ```bash blocks
2. If the LLM outputs no code blocks, the loop prompts it to retry with shell commands
3. Every code block is executed via `sandbox.exec()` — there is no other execution path
4. The LLM sees real stdout/stderr and iterates until it declares `TASK_COMPLETE`

## Live Terminal (optional)

Connect a WebSocket to `/terminal?session=<id>` for a live shell into the sandbox:

```javascript
const ws = new WebSocket("wss://smart-llm-router.<subdomain>.workers.dev/terminal?session=my-session");
ws.onmessage = (e) => process.stdout.write(e.data);
ws.onopen = () => {
  ws.send("ls -la\n");
};
```

## Configuration

| Env Var | Default | Description |
|---------|---------|-------------|
| `MAX_ITERATIONS` | `10` | Max LLM-sandbox round trips |
| `SANDBOX_ID_PREFIX` | `llm-session` | Prefix for sandbox IDs |
| `OPENAI_API_KEY` | (secret) | API key for LLM |
| `LLM_MODEL` | `gpt-4o` | Model to use |
| `LLM_ENDPOINT` | `https://api.openai.com/v1/chat/completions` | OpenAI-compatible endpoint |

## Security

- Each session gets its own isolated Linux container
- Containers are destroyed when idle (configurable via `keepAlive`)
- No network egress by default (add outbound Workers for specific hosts)
- Resource limits set via `instance_type: "lite"` in wrangler.jsonc
