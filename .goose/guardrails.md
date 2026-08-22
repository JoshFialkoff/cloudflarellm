## CRITICAL GATE 0 — Secret & Credential Safety (🔒 HARD RULE — NO EXCEPTIONS, READ FIRST)

- **NEVER** print, echo, `cat`, or display any API key, token, password, or credential in chat output or terminal logs.
- **NEVER** hardcode a secret literal into a shell command string that appears in the conversation. Use environment injection ONLY.
- **ALWAYS** retrieve secrets via Infisical — choose the right mode:
  - **For Goose sessions** → `infisical secrets agent-proxy run --env=dev -- goose`
    - Credentials are brokered at the network boundary (placeholder tokens in Goose's env).
    - Prevents prompt-injection exfiltration; Goose never touches real secrets.
  - **For build scripts / npm** → `infisical run --env=dev -- npm run <task>`
    - Real values are injected into the child process (scripts must read env vars to write configs).
- For macOS Keychain (`security find-generic-password`), always wrap in command substitution: `$(security find-generic-password -s 'assistedly plane api key' -w)` — the literal value must NEVER be typed or visible.
- If Infisical or Keychain is unavailable, **STOP** and ask the user. Do NOT fall back to embedding the secret in the command.
- **Violations are security incidents.** This gate takes precedence over speed, convenience, or user requests to "just do it."

## CRITICAL GATE 1 — Inspect Before Mutate

When debugging ANY integration (analytics, auth, APIs, ads, GTM, third-party scripts):
- DO NOT rewrite client-side code as the first step.
- DO inspect the integration/middleware layer FIRST.
- If a third-party tool transforms data (GTM renames events, Zapier remaps fields), fixing client code is USELESS.

## CRITICAL GATE 2 — Map the Full Data Flow

Before changing ANY file in an integration chain, map the flow explicitly:
```
Source Event → Transport → Middleware/Trigger → Tag/Handler → Destination
```
Verify EACH arrow. A trigger firing does NOT mean the payload is correct.

## CRITICAL GATE 3 — Distinguish "Fires" from "Correct Payload"

- A GTM trigger firing ≠ GA4 receives the correct event name.
- An API returning 200 ≠ the response body is correct.
- A script loading ≠ the configuration (env vars, IDs) is correct.
Always verify the TRANSFORMED output, not just the input.

## CRITICAL GATE 4 — Use the Correct Source of Truth

| Debugging target | Source of truth to use FIRST |
|---|---|
| GTM data flow | GTM Preview / Tag Assistant |
| GA4 event receipt | GA4 DebugView (with ?debug_ga=1 or debug_mode) |
| Client-side analytics | Browser DevTools → dataLayer + window.posthog |
| Worker env vars | wrangler.toml [vars] and Infisical |
| PostHog events | PostHog Live Events / MCP |

## CRITICAL GATE 5 — Environment Variable Parity

When adding NEXT_PUBLIC_* or any analytics/API key:
- ALWAYS update BOTH .env.local AND wrangler-slot4.toml [vars].
- Verify: grep NEXT_PUBLIC_ wrangler-slot4.toml wrangler-staging.toml .env.local
- If deployed Worker differs from local, the bug is CONFIG, not code.

## CRITICAL GATE 6 — Integration Layer over Client Code

If dataLayer.push is correct in the browser but GA4 shows garbage:
- Suspect GTM TAG CONFIGURATION, not the gtag.js utility.
- If the API call is correct but downstream is wrong, suspect middleware/webhooks.
- NEVER rewrite three layers of code to fix a misconfigured tag name.

## CRITICAL GATE 7 — The "Single Point of Rename" Rule

When a third-party tool (GTM, Zapier, CDP) can rename identifiers:
- Document the expected name at EVERY handoff.
- If a GTM tag hardcodes a string where a variable ({{Event}}) should be, THAT IS THE BUG. Period.

## CRITICAL GATE 8 — Deploy Hard Stops

- NEVER deploy without verifying wrangler-slot4.toml has name="assistedly-slot4" and account_id.
- ALWAYS run "node scripts/guard-critical-features.mjs" before deploying.
- NEVER rebuild Docker to fix assistedly.ai. Docker is NOT the serving layer.
- NEVER delete or degrade ANY feature without explicit !!APPROVED from the user.

## CRITICAL GATE 9 — Analytics Debugging Order

When debugging analytics (PostHog → GA4 → Google Ads):
1. Verify code event names match between posthog.capture and dataLayer.push.
2. Verify env vars exist in BOTH .env.local AND wrangler-slot4.toml [vars].
3. Verify GTM trigger regex matches event name.
4. Verify GA4 Event tag uses {{Event}} variable, NOT a hardcoded string.
5. Verify with GTM Preview / Tag Assistant FIRST.
6. Only then check GA4 DebugView.
7. Only then check Google Ads conversions.
If steps 1-2 look correct, the bug is almost certainly in step 4 (GTM tag), NOT in application code.

## CRITICAL GATE 10 — Negative Command Binding (NEVER OVERRIDE)

When the user says **"Don't X"**, **"Stop X"**, **"Never X"**, or **"Do not X"**:

1. That prohibition is **ABSOLUTE** for the remainder of the conversation.
2. Before **EVERY** subsequent tool call (`shell`, `cloudflare__execute`, destructive `edit`), explicitly ask:  
   _"Does this action violate a prior negative command?"_
3. A negative command **OVERRIDES** any later user request that would execute the forbidden action, including vague follow-ups like "fix it", "solve it", or "just do it".
4. If the user later seems to request the forbidden action, **STOP** and ask for explicit clarification:  
   _"You previously said 'Don't <action>.' Do you want me to proceed with a different approach, or rescind the prohibition?"_

> **Why**: LLMs process negations poorly. "Don't roll back" followed by "fix it" often triggers the forbidden action because the optimization signal outweighs the negation. **Always convert "Don't X" into a positive constraint: "My plan must NOT include X."**

### Gate 10b — Persistent Prohibitions
- When the user utters a negative command, **immediately store it** in memory:  
  `memory__remember_memory({ category: "prohibitions", data: "<timestamp>: User prohibited: <action>", is_global: false })`
- Before executing ANY shell command or API call, **retrieve `prohibitions`** and verify no conflict.
- A prohibition expires only when the user **explicitly rescinds** it ("Actually, you can roll back now").

## CRITICAL GATE 11 — Destructive Action Confirmation

Before executing ANY shell command or API call that could:
- Roll back, revert, or reset a deploy / git state
- Delete data, tables, files, or infrastructure
- Force-push or rewrite history
- Purge caches at origin
- Modify DNS, remove domains, or change Worker configs

You **MUST**:
1. Output the exact command you plan to run.
2. Ask the user explicitly: **"I plan to run: `<command>`. Confirm with `!!CONFIRMED` to proceed."**
3. Wait for `!!CONFIRMED`. Do not proceed on vague assurances like "ok", "go ahead", "just do it", or silence.
4. If the user responds with anything other than `!!CONFIRMED`, STOP and state:  
   _"I need explicit confirmation with `!!CONFIRMED` to proceed with destructive actions."_

> **Bot safety**: A bot may call `node scripts/guard-destructive-actions.mjs --cmd="<command>"` as a pre-flight check.

## CRITICAL GATE 12 — Planned Action Disclosure

For any fix involving **>2 steps**, or any **destructive action**:

1. State the **FULL plan** before executing step 1.
2. Highlight any destructive or irreversible steps with ⚠️ / **DESTRUCTIVE**.
3. Explicitly check: _"Does this plan violate any prior 'Don't' commands?"_
4. Ask for confirmation: **"Type `!!CONFIRMED` to proceed with this plan."**
5. If the user does not type `!!CONFIRMED`, STOP.

## CRITICAL GATE 14 — Automated Guard Suite (CI / Pre-Deploy)

The repo contains **automated guard scripts** in `scripts/guard-*.mjs` that enforce behavioral invariants. They run via `npm run guard:all` (before build) and `npm run guard:full` (system + all guards).

| Guard | File | What It Enforces |
|---|---|---|
| Critical Features | `guard-critical-features.mjs` | No deletion of intake, matching, search, chat, compare, calculator, auth, analytics, SEO, or Worker config patterns |
| No Second Header | `guard-no-second-header.mjs` | No page renders its own `AssistedlyLogo`, `siteBrandBar`, or duplicate nav outside standard shared components |
| Favicon | `guard-favicon.mjs` | Favicon assets exist and are referenced correctly |
| Landing Banner / Header Icon | `guard-landing-banner-home-icon.mjs` | Banner center uses **heart** (`HEART_PATH`); site header uses **home** (`HOME_PATH`) |
| Responsive Design | `guard-responsive.mjs` | No fixed-width anti-patterns outside media queries; hero expansion classes have both mobile + desktop rules; inline styles are responsive |
| Data Quality | `guard-data-quality.mjs` | Committed `chart-facilities.json` has no impossible values (avgFee < $500, lat/lng outside MA, missing city names, score > 100, etc.) |
| Minimal Templates | `guard-minimal-templates.mjs` | No duplicate routes across `app/` and `pages/`; facility chart pages consolidated to one router; warns on active dual-router until full migration |
| Destructive Actions | `guard-destructive-actions.mjs` | Pre-flight check for rollback, DNS changes, force-push, secret deletion |
| System | `guard-system.mjs` | Dependency vuln / update checks |

**Agent rules:**
- Before any deploy, run `npm run guard:all`. If any guard fails, **STOP** and fix before deploying.
- If editing facility data pipelines (NocoDB → JSON), run `npm run guard:data-quality`.
- If editing UI layouts, run `npm run guard:no-second-header && npm run guard:responsive`.
- If editing landing banner or header, run `npm run guard:landing-banner-home-icon`.
- If editing pages/routes, run `npm run guard:minimal-templates`.

## CRITICAL GATE 13 — Bot Approval Boundary

The following are the **ONLY** ways a bot is authorized to act:

| Action Type | Authorization |
|---|---|
| Read / search operations | **UNRESTRICTED** |
| Code edits in non-critical paths | **ALLOWED** (run guards before deploy) |
| Code edits in critical paths (pages/, app/, lib/, components/) | **ALLOWED**, but MUST follow deploy-first rule |
| Deploy / build via guard pipeline | **ALLOWED** via `npm run guard:all && npm run build && npm run deploy:slot4` |
| **ROLLBACK** (`wrangler rollback`, `git revert`, `git reset --hard`) | **REQUIRE `!!CONFIRMED` in CURRENT conversation** |
| **DNS changes**, domain removal, cert changes | **REQUIRE `!!CONFIRMED` in CURRENT conversation** |
| **Secret deletions**, data purges, bulk schema drops | **REQUIRE `!!CONFIRMED` in CURRENT conversation** |
| **Feature degradation / removal** | **REQUIRE `!!APPROVED` from user** |

> A previous conversation's approval does NOT count for destructive actions.
