## CRITICAL GATE 0 — Secret & Credential Safety (🔒 HARD RULE — NO EXCEPTIONS, READ FIRST)

- **NEVER** print, echo, `cat`, or display any API key, token, password, or credential in chat output or terminal logs.
- **NEVER** hardcode a secret literal into a shell command string that appears in the conversation. Use environment injection ONLY.
- **ALWAYS** retrieve secrets via Infisical (`infisical run --env=dev -- ...`) or macOS Keychain (`security find-generic-password -s '<service>' -w`).
- If a secret must be passed inline, wrap the retrieval in command substitution: `$(security find-generic-password -s 'assistedly plane api key' -w)` — the literal value must NEVER be typed or visible.
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
