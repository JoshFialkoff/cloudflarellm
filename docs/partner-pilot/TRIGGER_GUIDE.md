# Partner Pilot Trigger Guide

## When a Partner Responds Positively

The pipeline syncs to **Twenty CRM as an Opportunity on a Person** and posts a rich Discord embed with:
- 🏢 Company name + status
- 💬 The actual reply message
- ✅ Recommended next human action
- ⏰ Optimal timing (time of day, day of week, timezone, backup window)
- 📣 Platform recommendation

---

### Option A: Fully Automatic (Bot-Triggered)
Run outreach with `--auto-trigger`. If the bot detects a positive reply, it immediately creates a Twenty Opportunity, exercises all 5 sub-agents, and posts to Discord.

```bash
cd /Users/joshdev/Assistedly.ai
node scripts/partner-outreach-automation.js \
  --targets gogograndparent \
  --auto-trigger
```

### Option B: Review First, Then Trigger
Run outreach normally (or read existing logs), then confirm positives manually:

```bash
# 1. Run outreach (captures replies to log)
node scripts/partner-outreach-automation.js --targets gogograndparent

# 2. Review positive responses and selectively trigger
node scripts/confirm-and-trigger-pilot.js
```

### Option C: Direct Trigger by Slug (with Reply + Outreach Text)
Skip outreach entirely and trigger for a known partner — **always pass `--reply` and `--outreach-text`** so the Discord embed and Twenty Opportunity are meaningful:

```bash
# Dry-run (generates artifacts, does NOT activate, does NOT write to Twenty)
node scripts/partner-pilot-orchestrator.js \
  --partner=medicalguardian \
  --source=chatbot \
  --confidence=high \
  --reply="We would love to explore a partnership. Can you send over a one-pager?" \
  --outreach-text="Hi — we help families transition from medical-alert devices into assisted living..."

# Activate + deploy + Twenty sync + Discord
node scripts/partner-pilot-orchestrator.js \
  --partner=medicalguardian \
  --source=chatbot \
  --confidence=high \
  --reply="We would love to explore a partnership. Can you send over a one-pager?" \
  --outreach-text="Hi — we help families transition from medical-alert devices into assisted living..." \
  --activate
```

### Secure Trigger (Infisical-Injected Secrets)
```bash
./scripts/trigger-partner-pilot.sh medicalguardian email high --activate
```

Make sure `TWENTY_API_KEY` and `DISCORD_PARTNER_PILOT_WEBHOOK` are in Infisical under the `dev` environment.

---

## What Happens When Triggered

The orchestrator (`scripts/partner-pilot-orchestrator.js`) runs 9 phases:

1. **Validate** — confirms partner exists in `data/partners.json`
2. **Activate** — sets `active: true` (if `--activate`)
3. **Research** — generates refresh brief for deep-dive skill
4. **Dev** — emits build checklist (guard checks, build, deploy)
5. **Content** — emits asset specs (one-pager, email sequence, landing copy)
6. **Analytics** — emits PostHog event filters + dashboard spec
7. **PM** — emits Plane stories JSON (import-ready)
8. **Twenty Opportunity + Timing** — computes optimal timing, creates Twenty Opportunity on Person with full context
9. **Discord** — posts rich embed with company, reply, next action, timing, platform

---

## Twenty CRM Opportunity Model

Each positive response becomes an **Opportunity** linked to a **Person** (point of contact) under a **Company**:

| Field | Source |
|---|---|
| Opportunity name | `"{CompanyName} — Partner Pilot"` |
| Company | Found / created in Twenty |
| Person | "Partnerships Contact" (or real name if known) |
| Amount | $0 placeholder (counsel sets later) |
| Close date | T+90 days from trigger |
| Stage | "New" pipeline stage |
| Description | Full structured context (see below) |

Opportunity description includes:
- **Outreach Text** — exact message we sent
- **Platform** — crisp / intercom / email / linkedin / etc.
- **Optimal Timing** — time of day, day(s), timezone, backup window, rationale
- **Reply** — their actual response
- **Classification** — sentiment + confidence
- **Next Action** — human action recommendation + rationale

---

## Timing Intelligence

Computed by `lib/partner-pilot/timing-intelligence.js` using a hybrid engine:

| Layer | Data |
|---|---|
| 1. Cache | Firecrawl-scraped research brief (when available) |
| 2. Role | Inferred from reply keywords (founder / partnerships / support / marketing) |
| 3. Timezone | Detected from HQ city, defaults to ET for U.S. healthcare |
| 4. Industry | B2B healthcare BD best-practice windows |

### Role → Timing Map

| Role | Best Days | Best Time | Backup |
|---|---|---|---|
| Partnerships exec | Tue–Thu | 08:00–10:00 ET | 15:00–16:30 ET |
| Founder | Tue–Wed | 07:00–08:30 ET | 18:00–20:00 ET |
| Support | Mon–Thu | 09:00–11:00 local | 13:00–15:00 local |
| Marketing | Tue–Thu | 10:00–12:00 ET | 14:00–15:30 ET |

### Firecrawl Enrichment (Future)
When Firecrawl MCP is available, the engine will:
- Scrape LinkedIn profiles → extract recent post timestamps
- Scrape Twitter/X → find engagement windows
- Scrape job boards → detect timezone from office locations
- Search for BD person profiles to identify actual point of contact

---

## Discord Embed Fields

| Field | Content |
|---|---|
| 🏢 Company | Partner name |
| 🔖 Slug | Partner slug |
| 📊 Status | ACTIVATED & DEPLOYED or STAGED |
| 🔗 Attribution | `attributionParam` |
| 🎨 Brand Color | Hex color |
| 📅 Pilot Start | Date if activated |
| 💬 Reply Message | Actual reply text (truncated to 800 chars) |
| ✅ Recommended Next Action | Human-action suggestion + rationale |
| ⏰ Optimal Timing | Time, day(s), timezone, backup window |
| 📣 Platform | Primary + fallback |
| 🗂️ Twenty CRM | Opportunity sync status + link |
| 📦 Artifacts | 5 generated specs |
| 🔜 Next Steps | Deploy / build / kickoff guidance |

---

## Next-Action Recommendations

Auto-detected from reply keywords:

| Reply Signal | Recommended Action |
|---|---|
| "call", "schedule", "meeting" | **Schedule kickoff call** |
| "email", "deck", "proposal" | **Send partnership one-pager + email sequence** |
| "price", "cost", "fee" | **Send transparent economics memo + pricing call** |
| "legal", "contract", "terms" | **Share pilot agreement + loop in legal** |
| "demo", "walkthrough" | **Book demo / walkthrough call** |
| "forwarded", "right person" | **Request intro to decision-maker** |
| Vague positive | **Follow up within 24 hours** |

---

## Files Created per Partner

`docs/partner-pilot/responses/`:
- `{slug}-research-brief.json`
- `{slug}-dev-checklist.json`
- `{slug}-content-spec.json`
- `{slug}-analytics.json`
- `{slug}-pm-stories.json`
- `{slug}-timing-intelligence.json` (new)

---

## Need to Add a New Partner Target?

Edit `data/partners.json`, then re-run the orchestrator.

---

## Skills Referenced

- `assistedly-partner-research` — Firecrawl deep-dive + scoring
- `assistedly-partner-dev` — co-branded web experience build
- `assistedly-partner-content` — landing copy, one-pager, email sequences
- `assistedly-pilot-analytics` — PostHog events, D1 schema, dashboard
- `assistedly-pilot-pm` — Plane epics/stories in BIZDEV/CODING/EXECU
