# Content Sitemap Proposal: Assistedly.ai

## Strategic Foundation
- **Primary Audience:** Women 50–62 (sandwich generation daughters) researching assisted living for aging parents in Massachusetts
- **Core Promise:** Radical transparency, no sales pressure, Massachusetts-specific expertise
- **SEO Moat:** First-mover interactive charts with official MA state data; no competitor has this

---

## Current State Audit

| Page | Status | Action |
|---|---|---|
| `/` (home) | ✅ Next.js app, good | Keep; A/B test trust-first headline per strategy |
| `/search`, `/compare`, `/cost-calculator` | ✅ Tools built | Keep; link into content hub |
| `/safety-scores`, `/affordable`, `/discover`, `/memory-care` | ✅ Interactive dashboards | Build content around these as embed anchors |
| `/about` | ✅ Strong founder story | Keep |
| `/how-we-work`, `/how-we-make-money`, `/methodology`, `/data-sources`, `/editorial-policy` | ⚠️ Thin (2-3 sections) | **Expand in First 10** |
| `/faq` | ⚠️ 6 Q&As only | **Expand in First 10** |
| `/massachusetts`, `/massachusetts/[town]/*` | ✅ Programmatic SEO live | Keep scaling |
| **Content guides** | ❌ Missing | **Create in First 10** |

---

## Proposed Content Architecture

### PILLAR — Trust & Authority (must-expand)

| # | Page | URL | Why First 10? | Target Keywords |
|---|---|---|---|---|
| **1** | **How We Make Money** | `/how-we-make-money` | Strategy doc priority #1: remove all revenue-share language, replace with "no-facility-commission promise" | `how does Assistedly make money`, `unbiased assisted living finder` |
| **2** | **Complete Massachusetts Assisted Living Guide** | `/massachusetts-assisted-living-guide` | Pillar page per strategy doc. Combines cost, safety, choosing, payment. Rank for broad head terms. | `Massachusetts assisted living guide`, `assisted living Massachusetts 2026` |
| **3** | **Massachusetts Assisted Living Cost Guide** | `/massachusetts-assisted-living-costs` | #1 search driver (strategy). MA costs 55% above national avg. Embed `/affordable` dashboard. | `assisted living cost Massachusetts`, `how much is assisted living in MA` |
| **4** | **How to Choose Without Getting Sold To** | `/how-to-choose-assisted-living-massachusetts` | Trust-first pillar per strategy. Position against A Place for Mom / Caring.com | `unbiased assisted living finder Massachusetts`, `how to choose assisted living without broker` |
| **5** | **MassHealth, SCOPACE & Veterans Benefits** | `/massachusetts-assisted-living-financial-help` | High-intent, low competition. Most families don't know SCOPACE exists. | `MassHealth assisted living`, `SCOPACE Massachusetts`, `veterans benefits senior care MA` |

### CLUSTER — Educational / Emotional Journey

| # | Page | URL | Why First 10? | Target Keywords |
|---|---|---|---|---|
| **6** | **How to Talk to a Parent About Assisted Living** | `/how-to-talk-to-parent-about-assisted-living` | Emotional-intent capture (strategy). Earliest funnel stage. High shareability. | `how to tell parent they need assisted living`, `guilt about moving parent to assisted living` |
| **7** | **Memory Care vs Assisted Living in MA** | `/memory-care-vs-assisted-living-massachusetts` | Differentiator. Embed `/memory-care` dashboard. Clear buying-guide format. | `memory care vs assisted living Massachusetts`, `dementia care facilities MA` |
| **8** | **Why We Don't Take Facility Commissions** | `/why-we-dont-take-commissions` | Transparency proof page. Builds E-E-A-T. Reference in footer + nav. | `assisted living without brokers`, `no commission senior care advisor` |

### SUPPORT — Trust Signals & Methodology

| # | Page | URL | Why First 10? | Target Keywords |
|---|---|---|---|---|
| **9** | **FAQ (expanded)** | `/faq` | Current page has 6 Q&As. Strategy doc recommends 20+ covering MassHealth, commissions, touring, etc. | Long-tail question keywords |
| **10** | **Methodology (expanded)** | `/methodology` | Current page has 2 sections. Needs: data sources, scoring algorithm, inspection report explanation, limitations. | `Massachusetts ALR inspection reports`, `assisted living rankings methodology` |

---

## Content Pipeline (Post-First-10)

| Stage | Pages |
|---|---|
| **Batch 2** | Staffing ratios guide, Non-profit vs For-profit comparison, ALR inspection guide, SCOPACE deep-dive, Tour checklist |
| **Batch 3** | Sandwich generation survival guide, Veterans Aid & Attendance guide, Seasonal cost reports, Quarterly trust report |
| **Batch 4** | City-specific cost guides (`/massachusetts/{town}/costs` already scaffolded; add editorial + embed charts) |

---

## Internal Linking Plan

```
Homepage
  → Complete Guide
  → Cost Guide
  → How to Choose
  → Safety Scores (dashboard)
  → Affordable (dashboard)

Complete Guide
  → Cost Guide
  → Financial Help (MassHealth/SCOPACE)
  → Memory Care vs AL
  → How to Talk to Parent
  → How to Choose
  → Methodology
  → Why No Commissions

Every tool page (/search, /safety-scores, /affordable)
  → Link up to relevant guide
  → "How we rank these facilities → Methodology"
```

---

## Schema Plan Per Page

| Page | Schema |
|---|---|
| Complete Guide | `Article` + `FAQPage` + `BreadcrumbList` |
| Cost Guide | `Article` + `FAQPage` + `Table` (pricing table) |
| Financial Help | `Article` + `HowTo` (application steps) |
| Memory Care vs AL | `Article` + `ComparisonTable` |
| Methodology | `Article` + `Dataset` (data sources) |
| FAQ | `FAQPage` |

---

## Approval Request

**Approve the First 10 above?**

Reply "!!APPROVED" or modify:
- Swap out any of the 10
- Add/remove pages
- Reprioritize order

Once approved, I will:
1. Create each page as a Next.js page (App Router) with full content, meta tags, JSON-LD, and embedded interactive components
2. Expand the thin TrustCenter pages
3. Wire internal links
4. Run the guard scripts and deploy
