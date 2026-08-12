# Assistedly Intent Data Platform (AIDP)

Multi-signal buyer intelligence, identity resolution, audience segmentation, and activation for Assistedly.ai.

## Architecture

- **Store**: File-backed JSON (`~/.data/intent-store.json` in dev)
- **Identity Graph**: Resolves domains → accounts → contacts across signals
- **Intent Scoring**: Rule-based + optional OpenAI embedding enrichment
- **Audiences**: Segmented lists with export/sync to CRM/MAP
- **Integrations**: Twenty CRM (active stub), HubSpot & Salesforce (placeholders)

## API Overview

| Endpoint | Method | Description |
|---|---|---|
| `/api/intent/health` | GET | Health check |
| `/api/intent/seed` | POST | Seed demo data |
| `/api/intent/models` | GET | List data models |
| `/api/intent/accounts` | GET/POST | List or create accounts |
| `/api/intent/contacts` | GET/POST | List or create contacts |
| `/api/intent/intent-score` | GET | Score a domain |
| `/api/intent/graph` | GET | Identity graph query |
| `/api/intent/audiences` | GET/POST | List or create audiences |
| `/api/intent/audiences/[id]/export` | GET | Export audience (CSV, JSON) |
| `/api/intent/audiences/[id]/sync` | POST | Sync audience to CRM |
| `/api/intent/audiences/[id]/campaigns` | GET | List campaigns for audience |

## Environment Variables

- `INTENT_OPENAI_API_KEY` — Optional. Enables OpenAI embeddings; falls back to deterministic hash-based projection when absent.

## Local Development

```bash
npm run dev
PORT=3010 npm run intent-data:smoke
```
