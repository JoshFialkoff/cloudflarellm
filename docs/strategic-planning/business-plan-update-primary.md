
# Business Plan Updates — Aug 23, 2026, 06:05 PM

## Product & Engineering Update — Aug 23, 2026, 06:05 PM
• Deployed /admin/intelligence dashboard to Cloudflare production (client-side fetch of review snapshots).
• Facility intelligence pipeline merged into monorepo: Firecrawl → rawHtml → JSON-LD extraction → NocoDB facility_reviews table with linked facility_name records.
• Review forensics engine (39/39 unit tests passing): spam detection, authenticity scoring, sentiment analysis, velocity calculation, occupancy proxy.
• Exponential backoff retry layer for NocoDB writes (handles HTTP 0/socket hang up).
• Switched from App Router to Pages Router for Cloudflare Workers edge runtime compatibility.
• Added npm scripts: sync:reviews, sync:reviews:dry, sync:intelligence, test:intelligence.
• Weekly Goose scheduler recipe (recipes/weekly-review-sync.yaml) for automated review sync every Monday 9 AM ET.

## Strategy & Competitive Positioning — Aug 23, 2026, 06:05 PM
• Aline classified as strategic competitor + potential integration partner (Growth & Engagement, Resident Living, Financials suites).
• SmartGirl Digital, Creating Results, SageAge → channel partners; Ranktracker → neutral horizontal SEO tool.
• B2B paid Reputation Forensics Report recommended over consumer spam database (lower legal risk, higher facility willingness-to-pay).
• Facility executive / marketing director tools identified: cross-directory listing health, FOIA compliance alerts, competitive pricing, consumer search intelligence, unified review management.
• Revenue streams confirmed: B2B SaaS (operators + wearables), B2C premium consumer services, B2G/NGO anonymized decision data licensing.

## Operations & Infrastructure — Aug 23, 2026, 06:05 PM
• Infisical secret management deployed: GOOGLE_SERVICE_ACCOUNT_JSON, NOCODB_API_TOKEN, Firecrawl keys all injected at runtime via agent-proxy.
• Cloudflare token rotation script (rotate-cloudflare-token.mjs) built; blocked by Cloudflare 50-token lifetime quota — manual rotation fallback documented.
• Zapier MCP integration attempted (token expired — needs regeneration at zapier.com/l/mcp for Discord↔Goose bidirectional chat).
• Reddit campaign agents, NextDoor strategy, partner pilot outreach automation all operational in scripts/.
• 8 RackNerd servers under automated health monitoring with Discord alerting and threshold-based escalation.

## Go-to-Market & Traction — Aug 23, 2026, 06:05 PM
• Partner pilot outreach system: automated email sequences, Twenty CRM sync (107.172.94.35:3002), landing page funnels with PostHog A/B testing.
• Organic outbound: Firecrawl social engagement agents, Reddit structure optimizer, NextDoor universal pixel tracking (GTM-5MZDBQ5P).
• Analytics stack: PostHog → GA4 → Google Ads conversion tracking (GA4 ID: G-V5XFEZ9J0P).
• Consumer funnel: intake wizard → soft auth gate → matched results → save/share CTA → family dashboard.
• Facility data: 273 Massachusetts ALRs from NocoDB/FOIA; review sync pipeline running on 10-facility batches, full 273-facility run in progress via screen.
• Content SEO: 15+ Massachusetts town pages, cost guides, safety scores, memory care vs assisted living comparisons, methodology transparency pages.
