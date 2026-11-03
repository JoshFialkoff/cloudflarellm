# Firecrawl Knowledge Integration — on-demand Cloudflare knowledge for local bots

This repo integrates **Firecrawl** so local bots (Goose sessions, scripts, the
router's agent loop) can search for specific knowledge **on demand** — by
default against Cloudflare's docs, the same corpus the cloudflare.com AI bot
answers from.

## Why this exists

The LLM router project keeps needing Cloudflare-specific answers (Vectorize
bindings, Workers AI model IDs, wrangler config, D1 sessions…). Instead of
tabbing to the website bot, any local bot can now ask the docs directly:

- **Live search** — Firecrawl search over `developers.cloudflare.com` (or any site).
- **Full sections offline** — `developers.cloudflare.com/<product>/llms-full.txt`
  is the LLM-optimized copy of each docs section; pull it once, search locally forever.
- **RAG-ready chunks** — build a chunk index for embedding/vector search later.

## Tools (`bin/`)

| Tool | What it does | Example |
|---|---|---|
| `bin/kb-search` | On-demand web search (default: developers.cloudflare.com) → markdown summary + JSON | `bin/kb-search "vectorize binding wrangler"` |
| `bin/kb-fetch` | Fetch one docs page to markdown, cached under `.firecrawl/` | `bin/kb-fetch https://developers.cloudflare.com/vectorize/get-started/intro/` |
| `bin/kb-section` | Download a whole product section (`llms-full.txt`, free) | `bin/kb-section vectorize ai-gateway kv` |
| `bin/kb-build` | Chunk all cached markdown → `.firecrawl/kb/chunks.jsonl` + manifest | `bin/kb-build --max-chars 1200` |

Output follows the Firecrawl knowledge-base convention:
```
.firecrawl/
  developers.cloudflare.com/
    <product>/llms-full.md      # full section corpus
    <host>/<path>/index.md      # individual fetched pages
  search/<ts>.json              # search results (structured)
  kb/chunks.jsonl               # RAG-ready chunks
  kb/manifest.json              # corpus summary
```

## Usage for bots

```bash
# 1) Ask the live docs (1 search ≈ 1–2 credits, ~18k available)
bin/kb-search "D1 session API limits"
bin/kb-search --limit 8 --json "workers ai embeddings model"

# 2) For repeated/offline work, pull whole sections (no credits)
bin/kb-section vectorize workers ai-gateway
bin/kb-build                     # -> chunks.jsonl for embedding/RAG later

# 3) Deep-dive a single page
bin/kb-fetch https://developers.cloudflare.com/vectorize/best-practices/create-indexes/
```

## Notes

- Firecrawl CLI is authenticated via stored credentials
  (`firecrawl --status`; `firecrawl login` to re-auth).
- `.firecrawl/` is git-ignored (cache only). `bin/` scripts are the durable part.
- To expose search as a Worker endpoint later (so the router's `/agent` loop
  can use it), add a `POST /v1/search` route that calls Firecrawl's REST API
  with a `FIRECRAWL_API_KEY` Worker secret (set with `wrangler secret put`).
  The CLI can materialize the key: `firecrawl env -f .env` (keep `.env` ignored).
- **Goose MCP — installed.** `firecrawl setup mcp --keyless -a goose -y` registered
  the keyless hosted Firecrawl MCP (`https://mcp.firecrawl.dev/v2/mcp`) in
  `~/.config/goose/config.yaml`, so goose sessions get native
  `firecrawl_search`/`scrape`/`crawl` tools out of the box (anonymous, rate-limited).
- **Goose MCP — full credit.** `bin/goose-firecrawl.sh` materializes the API key
  from the CLI's stored credentials (`firecrawl env`) without persisting it:
  `bin/goose-firecrawl.sh` (interactive) or `bin/goose-firecrawl.sh run "<task>"`
  (one-shot with a local full-key MCP server).