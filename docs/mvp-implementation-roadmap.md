# Assistedly.ai MVP roadmap

## Reusable architecture audit

- **Passwordless auth** is already implemented in `/lib/serverAuth.js`, `/pages/api/auth/*`, and `/components/AuthCapture.js`.
- **Facility data and trust heuristics** already exist in `/lib/massachusettsFacilities.js`, `/lib/facilityTrust.js`, and `/components/MassachusettsFacilityPage.js`.
- **AI workflows** already exist in `/components/AssistedlyWizard.js`, `/components/FacilityDeepDive.js`, `/pages/api/chat.js`, `/pages/api/facility-deep-dive.js`, and `/pages/api/facility-kb-insight.js`.
- **Analytics** already exist through `/lib/posthogClient.js`, `/lib/posthogServer.js`, `/lib/actionGoalTracking.js`, and page-view tracking in `/pages/_app.js`.
- **Lead capture** already exists via `/pages/api/leads/consumer.js`, `/components/LeadCaptureActions.js`, and `/pages/api/signup-discord.js`.
- **Massachusetts SEO routes** already exist in `/app/massachusetts/**` and can be extended without replacing the current routing contract.

## MVP phases shipped in this PR

### Phase 1: Auth, roles, and persistence

- Add lightweight user roles: visitor, registered user, premium user, facility representative, admin.
- Persist the minimum viable user, lead, comparison, and AI-usage records in the new file-backed MVP store.
- Reuse the existing magic-link flow instead of replacing authentication.

### Phase 2: Facility profile and comparison MVP

- Evolve facility rendering into structured profiles with pricing, staffing, regulatory, AI, verification, and last-updated summaries.
- Add a 2-to-4 facility comparison page that reuses the current Massachusetts dataset.
- Gate full saved comparison reports behind premium membership while keeping summary comparisons public.

### Phase 3: Trust, founder story, and email capture

- Reuse and expand the founder story at `/about`, with `/founder-story` as a direct trust-building entry point.
- Add dedicated Trust Center pages: `/how-we-work`, `/how-we-make-money`, `/methodology`, `/data-sources`, `/privacy`, and `/editorial-policy`.
- Add reusable lead-capture modules for major trust, search, comparison, and SEO pages.

### Phase 4: SEO town pages and admin visibility

- Add town-level SEO pages for the requested Massachusetts towns across:
  - `/massachusetts/{town}/best-assisted-living`
  - `/massachusetts/{town}/memory-care`
  - `/massachusetts/{town}/costs`
  - `/massachusetts/{town}/comparison`
- Add FAQ, breadcrumb, and organization schema to those pages.
- Add a lightweight `/admin` dashboard for registrations, facility claims, AI usage, popular facilities, and funnel summaries.

## Follow-up gaps and risks

- The MVP store is intentionally lightweight. It is suitable for initial validation on the origin-host deployment path, but a managed database should replace it before meaningful scale.
- Premium conversion logic currently depends on email-role assignment rather than a full billing sync.
- AI output remains decision support only; the UI should keep reiterating that it is not medical advice.
