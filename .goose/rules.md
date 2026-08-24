# Goose Agent Rules — Assistedly.ai

> Auto-loaded by Goose Desktop for this repository.
> This file contains ONLY public-safe project context.
> For full architecture/hard stops: see AGENTS.md (manually reference when needed).

## Hard Stops (No Exceptions)

1. **NEVER print secrets in chat.** Use Infisical or macOS Keychain ONLY.
2. **NEVER delete** AGENTS.md, FEATURE_MANIFEST.md, or guard scripts (`scripts/guard-critical-features.mjs`, `scripts/guard-no-second-header.mjs`).
3. **NEVER modify DNS records** for assistedly.ai.
4. **NEVER add `robots noindex`** to any page without `!!APPROVED`.
5. **NEVER hard-replace homepage copy.** Use PostHog A/B tests (additive changes only).
6. **NEVER add taglines** to SiteHeader/global navigation without `!!APPROVED`.
7. **NEVER change auth gates** from soft → hard without `!!APPROVED`.
8. **NEVER deploy** without verifying `wrangler-slot4.toml` config.

## Dev Workflow

- After `git pull`, kill any stale local dev server before `npm run dev`.
- Local dev uses free ports starting at **3010** (do not assume 3000).
- Run lint + build before commits; use `scripts/hooks/pre-push` as a Git pre-push hook.

## Security & Secrets

- All secrets live in Infisical. Never commit `.env.production` or tokens.
- For Goose sessions: `infisical secrets agent-proxy run --env=dev -- goose`
- For builds: `infisical run --env=dev -- npm run build`
- For Cloudflare token rotation: consult AGENTS.md (do not display tokens in chat).

## Communication Style

- Label every URL/command with its environment (local/dev/live/ssh).
- Terminal commands must be copy-paste ready — no placeholders.
- Prefer exact sed one-liners; print full `ssh -i …` commands.
- Present one clear choice or fix at a time.
- Monitor CI runs and give one next failure command.

## Deployment

- Build with `npm ci && npm run build`
- Deploy via `npx wrangler deploy --config wrangler-slot4.toml`
- Full deploy procedures: see AGENTS.md

## Prohibited Topics (Never Discuss in Chat)

- Infrastructure topology (server IPs, hostnames, internal ports)
- Partnership or BD strategy details
- Non-public data sources and how they are used
- Discord webhooks, internal API paths, or credential locations
