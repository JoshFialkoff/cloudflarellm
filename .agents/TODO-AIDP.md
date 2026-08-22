# Assistedly Intent Data Platform (AIDP) — Continuation TODO

## Context
A large uncommitted feature (`components/intent/`, `lib/intent-data/`, `pages/api/intent/`, `pages/intent.js`, `scripts/intent-data-smoke.cjs`) has been created. Goal is to get it working end-to-end, passing smoke tests, lint/build, and integrated cleanly with the existing Next.js app.

## Explicit requirements (from README / code)
- [ ] `npm run intent-data:smoke` passes against the running dev server.
- [ ] All `pages/api/intent/*` endpoints are wired and return correct JSON.
- [ ] Dashboard at `/intent` renders without errors and uses brand colors.
- [ ] Env vars documented in `.env.example` are actually used/config loaded correctly.
- [ ] Store persists to `.data/intent-store.json` (file-backed JSON).
- [ ] Embedding fallback works when no OpenAI key is set.

## Implicit requirements
- [ ] Must not break existing app build (`npm run build`) or lint (`npm run lint`).
- [ ] Must respect brand colors (no hardcoded orange `#ea580c`; use CSS vars from `styles/globals.css`).
- [ ] `/guide` routing contract must remain intact.
- [ ] No empty/0-byte lib files (guard:empty-libs).
- [ ] Commit-ready with sensible git commit message.

## Next steps
1. Start dev server and run smoke test.
2. Fix any runtime errors / 404s / wrong return shapes.
3. Run lint and build guards.
4. Update CSS to use brand variables if needed.
5. Commit.

## Handoff
- Created `/Users/joshfialkoff/Documents/Coding Workspaces/Assistedly.ai/.agents/HANDOFF-AIDP.md` for the next bot/user to continue this project on macOS.
