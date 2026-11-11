# smart-llm-router — Routing Logic Updates

## Overview

Two sets of changes were applied to the `smart-llm-router` Worker:

1. **Smarter routing** — complex prompts now escalate to advanced models, and equivocating responses trigger escalation with anti-equivocation prompting
2. **Latest Cloudflare LLMs** — all model tier lists updated with the newest available models on the account

---

## 1. Routing Logic Changes

### 1a. Complexity scoring in `classifyPrompt`

Previously, only "research" prompts (≥2 research-pattern matches) reached the `complex` tier. A new **`complexityScore`** now evaluates:

- **Prompt length** — 800+ chars: +1, 2000+ chars: +2
- **Multi-constraint markers** — "must", "require", "ensure", "step 1", "additionally", etc. (2+: +1, 4+: +2)
- **Reasoning markers** — "analyze", "evaluate", "trade-off", "strategy", "refactor", "edge case", etc. (1+: +1, 3+: +2)
- **Multiple questions** — 3+ question marks: +1
- **Long-form requests** — "comprehensive", "in-depth", "step by step": +1
- **Decision prompts** — "best", "recommend", "which approach", "decide": +1

**New tier escalation rule:**
```
complex  ←  researchScore ≥ 2  OR  complexityScore ≥ 4  OR  (researchScore ≥ 1 AND complexityScore ≥ 2)
coding   ←  codingScore ≥ 3  OR  complexityScore ≥ 2
general  ←  everything else
```

### 1b. Fixed vacillation fallback direction

**Before:** When complex models equivocated, the router fell back to *less* advanced general models.

**After:** Vacillation *always* escalates **UP** to complex models. General-model fallback only triggers for non-vacillation failures (capacity errors, empty responses).

### 1c. Anti-equivocation prompt injection on escalation

New `ANTI_EQUIVOCATION_PROMPT` constant injected as a system message when escalating due to vacillation. Instructs the model to:
- Give a single, decisive, definitive answer
- Not hedge with "it depends", "on the other hand", "however"
- Commit fully and state answers confidently
- Never present pros/cons unless explicitly asked

### 1d. Improved logging

`complexityScore` is now included in both classifier and router log lines.

---

## 2. Model List Updates

All 8 model arrays (4 FALLBACK + 4 PREFERRED) updated with the latest Cloudflare Workers AI models.

### New models added:

| Model | Tier | Context | Notes |
|-------|------|---------|-------|
| `@cf/deepseek-ai/deepseek-v4.1-flash-1017` | coding, complex, tool | 1M | Newest DeepSeek (2026-10-17), MoE 552B |
| `@cf/deepseek-ai/deepseek-v4-pro-0813` | complex | 1M | DeepSeek V4 Pro reasoning model |
| `@cf/nvidia/nemotron-3-120b-a12b` | complex, tool | 256K | 120B MoE, agentic |
| `@cf/qwen/qwq-32b` | complex | 24K | Qwen reasoning model |
| `@cf/qwen/qwen2.5-coder-32b-instruct` | coding | 32K | Coding-specialized |
| `@cf/qwen/qwen3.8-27b` | tool (preferred) | 262K | Function calling |
| `@cf/openai/gpt-oss-20b` | general | 128K | Smaller/faster OSS |
| `@cf/google/gemma-4-26b-a4b-it` | general | 256K | Google's latest open model |
| `@cf/meta/llama-4-scout-17b-16e-instruct` | tool | 131K | Multimodal, function calling |
| `@cf/mistralai/mistral-small-3.1-24b-instruct` | general (preferred) | 128K | Vision understanding |
| `@cf/ibm-granite/granite-4.0-h-micro` | general (preferred) | 131K | Function calling |
| `@cf/zai-org/glm-5.2` | coding, complex (preferred) | 262K | Agentic coding |

### Updated tier lists (fallback):

**CODING:** deepseek-v4.1-flash-1017, deepseek-v4-flash-0731, kimi-k2.7-code, qwen2.5-coder-32b, gpt-oss-120b
**GENERAL:** glm-4.7-flash, gpt-oss-120b, kimi-k2.6, gpt-oss-20b, gemma-4-26b-a4b-it
**TOOL:** kimi-k2.6, gpt-oss-120b, deepseek-v4.1-flash-1017, llama-4-scout-17b
**COMPLEX:** deepseek-v4.1-flash-1017, deepseek-v4-pro-0813, gpt-oss-120b, kimi-k2.7-code, glm-5.3, nemotron-3-120b, deepseek-r1-distill-qwen-32b, qwq-32b

### KV state

KV was previously empty (router using fallback lists). The updated fallback lists are now live. The cron-triggered `runScheduledUpdate` will populate KV on its next run using the updated PREFERRED lists + auto-discovery.

---

## Deployment

The Worker was redeployed with all changes. All bindings (secrets, KV, Durable Object, AI) were preserved via `keep_bindings`.
