# Critical Feature Manifest — NEVER REMOVE WITHOUT !!APPROVED

> **HARD STOP**: No bot may delete, disable, or degrade any feature listed below without explicit human `!!APPROVED` in chat. Violations must be reverted immediately.

---

## 1. Conversion Funnel (Core Revenue Path)

| Feature | File(s) | Why Critical |
|---|---|---|
| **Intake Wizard** | `pages/intake.js`, `hooks/useIntake.js`, `lib/intakeState.js` | Primary lead-capture flow. Removing this kills new user acquisition. |
| **Matched Results** | `pages/matched.js`, `lib/matchingScore.js`, `components/IntakeMatchBadge.js` | Shows ranked facilities after intake. Users must see results BEFORE hard login gate. |
| **Wizard Results** | `pages/results.js`, `components/WizardFacilityMatchList.js`, `components/ResultsSnapshotSection.js` | Saved wizard session results + compare/share. |
| **Auth Capture** | `components/AuthCapture.js` | Soft email capture on results pages. Must NOT block viewing results. |
| **Get Matched CTA** | `pages/get-matched.js` | Entry point to intake flow from homepage/nav. |
| **Ask / Chat** | `pages/ask/index.js`, `pages/api/ask-chat.js` | Primary free-form Q&A interface. Must remain fully functional. |
| **Facility Deep Dive** | `pages/facility/[slug].js`, `components/FacilityDeepDive.js` | Individual facility pages. SEO + conversion critical. |

## 2. Authentication & Access (Soft-Gate Pattern)

| Feature | File(s) | Why Critical |
|---|---|---|
| **Magic Link Auth** | `components/AssistedlyWizard.js` (magic link section), `lib/serverAuth.js` | Passwordless login. Must NOT show hard login before results. |
| **Session Gate (Soft)** | `pages/api/family-dashboard-auth.js`, `lib/serverAuth.js` | Users see results first, then prompted to save. Hard gate only on save/share. |
| **Answers Auth Gate** | `app/answers/AnswersAuthGate.tsx` | App-router auth pattern for /answers. |

## 3. Search & Discovery

| Feature | File(s) | Why Critical |
|---|---|---|
| **Facility Search** | `pages/search.js`, `pages/api/facilities.js` | Core directory search. |
| **Compare Tool** | `pages/compare.js`, `components/Compare.js`, `components/CompareTable.js` | Side-by-side facility comparison. |
| **Cost Calculator** | `pages/tools/cost-calculator.js`, `pages/tools/costs.js` | Interactive pricing tool. High-conversion page. |
| **Memory Care Readiness** | `pages/tools/memory-care-readiness.js` | Assessment quiz. Lead gen. |

## 4. SEO & Organic Traffic

| Feature | File(s) | Why Critical |
|---|---|---|
| **Homepage** | `pages/index.js`, `components/HomeHeroHeadline.js`, `components/HomeBelowHero.js` | #1 landing page. A/B tests must be additive (PostHog flags), not replacements. |
| **Massachusetts Town Pages** | `app/massachusetts/page.js` | App-router entry for geo-SEO. |
| **Sitemap** | `app/sitemap.js` | Must remain active for search indexing. |
| **Robots** | `app/robots.js` | Must allow indexing. |
| **JSON-LD / Schema** | `components/Seo/JsonLd.jsx`, `lib/seo/schemaData.js` | Structured data for rich snippets. |
| **DefaultPageHead** | `components/Seo/DefaultPageHead.jsx` | SEO meta wrapper. |
| **Consent Manager** | `components/Seo/ConsentManager.jsx` | GDPR/CCPA compliance. Legal requirement. |

## 5. Analytics & Observability

| Feature | File(s) | Why Critical |
|---|---|---|
| **PostHog Client** | `lib/posthogClient.js` | Feature flags, session replay, funnel tracking. |
| **Intake Analytics** | `lib/intakeAnalytics.js` | Funnel event tracking. |
| **Results Analytics** | `components/ResultsPageAnalytics.js` | Conversion tracking on results pages. |

## 6. Trust & Compliance

| Feature | File(s) | Why Critical |
|---|---|---|
| **Privacy Policy** | `pages/privacy.js` | Legal requirement. |
| **FAQ** | `pages/faq.js`, `components/TrustCenterPage.js` | User trust + SEO. |
| **Care Access Initiative** | `pages/care-access-initiative.js` | Trust-center landing page. |
| **Editorial Policy** | `pages/editorial-policy.js` | E-E-A-T signal for Google. |
| **Data Sources** | `pages/data-sources.js` | Transparency page. |
| **How We Make Money** | `pages/how-we-make-money.js` | Trust signal. |

## 7. Infrastructure & Deployment Safety

| Feature | File(s) | Why Critical |
|---|---|---|
| **AGENTS.md** | `AGENTS.md` | Architecture lock + deploy process. Must never be deleted. |
| **wrangler-slot4.toml** | `wrangler-slot4.toml` | Production worker config. Verify `name="assistedly-slot4"` and `account_id`. |
| **wrangler-staging.toml** | `wrangler-staging.toml` | Staging worker config. |
| **postinstall react-dom patch** | `scripts/postinstall/patch-react-dom-server-edge.mjs` | Required for Cloudflare Worker builds. |
| **Worker cache guard** | `scripts/guard-worker-cache-header.cjs` | Prevents cache-header regressions. |

---

## Deletion Safety Protocol

```
BEFORE deleting ANY file:
1. Check this manifest
2. If file is listed above → STOP and ask human for !!APPROVED
3. If file is NOT listed → still ask "Are you sure? This may be in use."
4. Never bulk-delete files without reviewing each one
```

## Feature Modification Protocol

```
BEFORE modifying ANY conversion-critical feature:
1. Changes must be ADDITIVE (PostHog A/B test, new prop, parallel path)
2. If REPLACEMENT → requires !!APPROVED + staging test
3. Never change URL routes that are indexed by search engines
4. Never add robots noindex without !!APPROVED
```
