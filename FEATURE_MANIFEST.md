# Critical Feature Manifest — NEVER REMOVE WITHOUT !!APPROVED

> **HARD STOP**: No bot may delete, disable, or degrade any feature matching the patterns below without explicit human `!!APPROVED` in chat. Violations must be reverted immediately.
>
> This document defines BEHAVIORAL patterns, not just file names. The automated guard (`scripts/guard-critical-features.mjs`) detects regressions by scanning ALL files for these patterns, regardless of file names.

---

## Pattern-Based Deletion Rules

The guard script detects the following behavioral patterns across the entire codebase. If patterns are missing, the build fails.

### 1. Conversion Funnel (Lead Capture Path)

| Behavior Pattern | What the Guard Checks | Failure Means |
|---|---|---|
| **Intake Wizard** | Files containing `readIntakeState`, `INTAKE_STEPS`, step data | Lead-capture wizard removed |
| **Facility Matching** | Files containing `rankFacilities`, `MASSACHUSETTS_FACILITIES` | Core matching engine removed |
| **Results Rendering** | Files containing `WizardFacilityMatchList`, `ResultsSnapshotSection` | Results display removed |
| **Soft Auth Gate** | `AuthCapture` component on results/search/facility/compare pages | Users blocked from seeing results before login |
| **Search Interface** | Search page + `api/facilities` or `api/search` endpoint | Core directory search removed |
| **Chat / Ask** | Files containing `Dify.*chat`, `/ask`, chat message patterns | Free-form Q&A interface removed |
| **Cost Calculator** | Files containing `CalculatorSnapshot`, `cost-calculator` | Interactive pricing tool removed |
| **Compare Tool** | Files containing `CompareTable`, `ShareComparisonModal` | Side-by-side comparison removed |

**Rule:** Users must see facility results BEFORE being asked to log in (soft-gate pattern). Never add a hard `redirect('/login')` or `if (!session) return <Login/>` before result rendering on public pages.

---

### 2. Auth Gate Safety Patterns

| Pattern Type | Detection | What It Means |
|---|---|---|
| **Hard Gate** | `if (!session)` or `if (!user)` followed by `redirect`, `router.push`, or `return` before any JSX `return (<` | Users cannot see content without logging in first |
| **Soft Gate** | `AuthCapture` component rendered AFTER main content | Users see results first, then prompted to save/log in |
| **API Protection** | `getSession(req)` in API routes | Expected on admin/data-mutation endpoints only |

**Rule:** Public-facing pages (intake, matched, results, search, facility, compare) must use SOFT gates. Admin/dashboard pages may use hard gates.

---

### 3. SEO & Organic Traffic Patterns

| Behavior Pattern | What the Guard Checks | Failure Means |
|---|---|---|
| **Homepage control copy** | `homePageDefault`, `heroTitle`, `metaDescription` preserved alongside any variants | Homepage hard-replaced instead of A/B tested |
| **A/B test infrastructure** | `useFeatureFlagVariantKey`, `isPrivacyMessaging` additive pattern | Changes made directly without flag protection |
| **Sitemap** | `app/sitemap.js` exists and exports sitemap | Search indexing broken |
| **Robots** | `app/robots.js` exists and exports robots config | Crawler directives missing |
| **JSON-LD Schema** | `JsonLd` component + `schemaData.js` with `Organization`/`SoftwareApplication`/`WebSite` | Structured data removed |
| **Consent Manager** | `ConsentManager.jsx` with GDPR/CCPA consent mode | Legal compliance removed |
| **Static cache headers** | `max-age=31536000` or `immutable` in `next.config.js` | Performance regression |

**Rule:** Changes to the homepage must be ADDITIVE (PostHog feature flags), not replacement. Never add `robots noindex` without `!!APPROVED`.

---

### 3b. Brand & Geographic Scope Patterns

| Behavior Pattern | What the Guard Checks | Failure Means |
|---|---|---|
| **Navigation taglines** | Any element using `siteHeaderTagline`, `headerTagline`, or `navTagline` class inside a header/nav component | Tagline in nav bar — disallowed unconditionally |
| **Unconditional geo taglines** | Global brand components (headers, brand bars) containing a US state name + "senior living" / "assisted living" / "nursing home" without a feature flag conditional | Site appears limited to one state, hurting national reach and brand |

**Rule:**
1. **No taglines of any kind** in the site header / navigation bar (`siteHeaderTagline`, etc.) without explicit `!!APPROVED` comment in the file.
2. Geography-specific taglines in global components (e.g., `SiteHeader`, facility page brand bars) must be behind a PostHog A/B test flag or have `!!APPROVED`. Never hardcode a single-state tagline site-wide.

### 4. Noindex Whitelist (Intentional SEO Exclusions)

The following page CATEGORIES may be intentionally noindexed. All OTHERS must remain indexable.

| Category | Pattern | Examples |
|---|---|---|
| **Error pages** | `pages/404.js` | 404 Not Found |
| **Admin dashboards** | `pages/admin/` | Internal analytics dashboard |
| **User dashboards** | `pages/family-dashboard-shared.js` | Private user data pages |
| **Token-gated sources** | `pages/sources/` | Private referral links |
| **Ad campaign landing pages** | Pages with `utm_campaign`, `captureLandingEvent`, `landingAnalytics`, or path containing `landing`, `campaign`, `ad-`, `ppc-`, `paid-`, `promo-` | Paid-traffic-only pages that should not appear in organic search |

**Rule:** If you add `noindex` to any page NOT matching the categories above, the build fails. Get `!!APPROVED` first.

---

### 5. Analytics & Observability Patterns

| Behavior Pattern | What the Guard Checks | Failure Means |
|---|---|---|
| **PostHog tracking** | `posthog`, `capture`, `track`, `useFeatureFlag` across codebase | All analytics removed |
| **Intake analytics** | `trackIntakeStart`, `trackIntakeComplete`, `trackIntakeStepComplete` | Funnel tracking removed |
| **Results analytics** | `ResultsPageAnalytics` component | Conversion tracking removed |
| **A/B test flags** | At least one `useFeatureFlagVariantKey` or feature flag constant | Experiment infrastructure removed |

---

### 6. Infrastructure Safety Patterns

| Behavior Pattern | What the Guard Checks | Failure Means |
|---|---|---|
| **Worker config** | `wrangler-slot4.toml` has `name` + `account_id` | Deploy would target wrong worker/account |
| **Staging config** | `wrangler-staging.toml` has `name` + `account_id` | Staging workflow broken |
| **React DOM edge** | `scripts/postinstall/patch-react-dom-server-edge.mjs` exists | Cloudflare Worker build will fail |
| **Cache header guard** | `scripts/guard-worker-cache-header.cjs` exists | Cache regression detection missing |
| **Deployment docs** | `AGENTS.md` + `scripts/ci/DEPLOY_WORKER.md` exist | Architecture knowledge lost |

**Rule:** Never remove `AGENTS.md`, `FEATURE_MANIFEST.md`, or `scripts/guard-critical-features.mjs`.

---

### 7. Security Patterns

| Behavior Pattern | What the Guard Checks | Failure Means |
|---|---|---|
| **Input sanitization** | `lib/security/sanitizer.js` | PII may leak to upstream APIs |
| **Audit logging** | `lib/security/auditLog.js` | HIPAA compliance broken |
| **ZDR headers** | `lib/security/zdr.js` | Zero Data Retention not enforced |

---

## Route Inventory Minimums (Generic Counts)

The guard enforces minimum counts to catch bulk deletions:

| Category | Minimum | Why |
|---|---|---|
| Pages Router pages | 20 | Core site structure |
| App Router pages | 1 | Massachusetts hub + future routes |
| API routes | 10 | Backend functionality |

If any count drops below minimum, the build fails — even if individual files aren't in the named anchor list.

---

## Git Diff Regression Detection

The guard scans `git diff --name-status` for:
- Deletions of known critical files → **FAIL**
- Deletions of any `pages/` or `app/` file → **WARN** (verify it's not user-facing)

---

## Import Graph Safety

The guard validates that critical files still import their dependencies:

| File | Must Import | Why |
|---|---|---|
| `pages/results.js` | `AuthCapture` | Soft-gate pattern |
| `pages/compare.js` | `AuthCapture` | Soft-gate pattern |
| `pages/index.js` | `useFeatureFlagVariantKey`, `HOMEPAGE_PRIVACY_EXPERIMENT_FLAG` | A/B test infrastructure |
| `lib/posthogClient.js` | `posthog` | Analytics SDK |

---

## Deletion Safety Protocol

```
BEFORE deleting ANY file:
1. Check this manifest — does the file match any behavioral pattern above?
2. If yes → STOP and ask human for !!APPROVED
3. Run "node scripts/guard-critical-features.mjs" — if it fails, DO NOT DELETE
4. If the file does not match any pattern but is in pages/ or app/ → WARN and verify
5. Never bulk-delete files without reviewing each one individually
```

## Feature Modification Protocol

```
BEFORE modifying ANY behavior matching patterns above:
1. Changes must be ADDITIVE (PostHog A/B test, new prop, parallel path)
2. If REPLACEMENT → requires !!APPROVED + staging test + verify guard passes
3. Never change URL routes that are indexed by search engines
4. Never add robots noindex without !!APPROVED
5. Never change auth gate from soft → hard without !!APPROVED
```

## Bot Safety Rules

```
If any bot (including this one) attempts to:
- Delete a page/component/API that renders user-facing content → STOP and require !!APPROVED
- Replace homepage copy entirely → STOP — use PostHog A/B tests instead
- Add noindex to any page → STOP — verify against whitelist first
- Change auth from soft to hard gate → STOP — users must see results first
- Remove PostHog/feature flag code → STOP — get !!APPROVED
- Delete AGENTS.md, FEATURE_MANIFEST.md, or guard scripts → STOP — these are the safety net
```
