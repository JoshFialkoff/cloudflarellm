# Handoff: Assistedly Intent Data Platform (AIDP)

> Created for the next bot/user continuing this project in the Goose app on macOS.

## Project location

```text
/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai
```

Run **all** commands from this directory:

```bash
cd /Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai
```

## What this project is

Assistedly.ai is a Next.js 16 app (webpack dev server) for senior-living search / concierge. This branch contains a large uncommitted feature: an in-app **Intent Data Platform** (Intentsify-style multi-signal buyer intelligence, identity resolution, audiences, and activation).

## Active task

Finish the AIDP feature so the smoke test passes, the build/lint is clean, the UI uses brand colors, and the work is committed.

Current TODO: `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/.agents/TODO-AIDP.md`

Handoff file: `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/.agents/HANDOFF-AIDP.md`

## Current status

- Dev server is running on **port 3010** (managed by `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/scripts/next-dev-free-port.js`).
- Smoke test command:
  ```bash
  cd /Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai
  PORT=3010 npm run intent-data:smoke
  ```
- As of this handoff, the smoke test passes through:
  - Healthcheck
  - Seeding (`/api/intent/seed`)
  - Models (`/api/intent/models`)
  - Accounts (`/api/intent/accounts`)
  - Contacts (`/api/intent/contacts`)
  - Intent score (`/api/intent/intent-score?domain=...`)
  - Identity graph (`/api/intent/graph`)
  - Audiences (`/api/intent/audiences`)
- **Next failing step:** audience export (`GET /api/intent/audiences/[id]/export`).

## Known bug (priority #1)

The dynamic audience API routes live at:

- `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/pages/api/intent/audiences/[id]/export.js`
- `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/pages/api/intent/audiences/[id]/sync.js`
- `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/pages/api/intent/audiences/[id]/campaigns.js`

Their internal import paths are **one level too shallow**. For example, `export.js` currently uses:

```js
import { getAudience } from "../../../../lib/intent-data/audiences";
```

Because the file is inside `[id]/`, this resolves to `pages/lib/...` which does not exist and throws:

```text
Module not found: Can't resolve '../../../../lib/intent-data/audiences'
```

**Fix:** change those imports to the absolute project-root path or add one more `../`:

```js
import { getAudience } from "../../../../../lib/intent-data/audiences";
// or prefer
import { getAudience } from "lib/intent-data/audiences";
```

Verify the same problem does not exist in `sync.js` and `campaigns.js`.

## Remaining task checklist

1. **Fix dynamic audience route imports** (above).
2. Re-run the smoke test until every check passes.
3. Start a fresh dev server if needed:
   ```bash
   cd /Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai
   npm run dev
   ```
   It will bind to `3010` (or the next free port). Check `.dev-server-port` for the actual port.
4. Fix any other smoke-test failures that appear.
5. Run lint and build guards:
   ```bash
   cd /Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai
   npm run lint
   npm run build
   ```
6. Update `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/components/intent/IntentDashboard.module.css` to use brand CSS variables from `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/styles/globals.css` instead of hardcoded colors (currently contains an orange `#ea580c`; replace with `--color-primary` or equivalent).
7. Ensure the dashboard still renders at `/intent` and is behind the existing auth layout if the app requires it.
8. Run the full smoke test one final time.
9. Review uncommitted changes with:
   ```bash
   cd /Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai
   git status
   git diff --stat
   ```
10. Commit with a descriptive message, e.g.:
    ```bash
    cd /Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai
    git add .
    git commit -m "feat(intent-data): Assistedly Intent Data Platform with smoke tests and dashboard"
    ```

## Key files you will touch

| Purpose | Path |
|--------|------|
| Feature README | `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/lib/intent-data/README.md` |
| Core modules | `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/lib/intent-data/*.js` |
| React dashboard | `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/components/intent/IntentDashboard.js` |
| Dashboard styles | `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/components/intent/IntentDashboard.module.css` |
| Public page | `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/pages/intent.js` |
| API routes | `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/pages/api/intent/*.js` |
| Dynamic audience routes | `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/pages/api/intent/audiences/[id]/*.js` |
| Smoke test script | `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/scripts/intent-data-smoke.cjs` |
| Env example | `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/.env.example` |
| Package scripts | `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/package.json` |

## Commands summary

```bash
# 1. Enter project
cd /Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai

# 2. Start dev server (if not already running)
npm run dev

# 3. Run smoke test (use actual port from .dev-server-port)
PORT=3010 npm run intent-data:smoke

# 4. Lint and build checks
npm run lint
npm run build

# 5. Reset local intent store if tests are flaky
rm -f /Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/.data/intent-store.json
```

## Notes

- The store layer is currently file-backed (`/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/.data/intent-store.json`). Deleting that file resets all seeded demo data.
- Embeddings fall back to a deterministic projection when no `INTENT_OPENAI_API_KEY` is set (local dev works without OpenAI).
- All CRM/MAP integrations are stubbed except Twenty CRM helpers; HubSpot/Salesforce adapters are intentionally placeholders.
