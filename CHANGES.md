# sandbox-router — Patched Fixes

## Problem
The LLM agent gets stuck in "Thinking" — producing reasoning text without bash code blocks, burning through iterations without executing commands.

## Fixes Applied

| # | Fix | Before | After |
|---|-----|--------|-------|
| 1 | Stronger system prompt | 9 rules, no preamble restriction | Added CRITICAL rule: no preamble, start with code blocks immediately |
| 2 | max_tokens | 2048 | 4096 |
| 3 | MAX_ITERATIONS | 10 | 25 |
| 4 | Environment pre-seeding | Raw user prompt | Pre-seeded with available tools list |
| 5 | Smarter nudge | Generic for all non-code responses | Short responses (<100 chars) get 'Skip the explanation' directive |

## Deploy
```bash
npm install
npx wrangler deploy --containers-rollout=none
```
