# Assistedly.ai — MA Senior Care Monitoring Stack

This directory contains both **automated** (Firecrawl + Discord bot) and **manual**
(Nextdoor native + Google Alerts) monitoring infrastructure for senior care
conversations in Massachusetts.

---

## Automated Monitoring (`monitor.py`)

### What it does
- Runs Firecrawl web searches across MA towns (Tier 1–3)
- Keyword clusters: assisted living, memory care, nursing home, senior care,
  home care, elder care, aging parents, Medicaid + assisted living
- Scores results by outreach opportunity (high-intent phrases, platform quality,
  local relevance)
- Shortens every link via **YOURLS** (`go.assistedly.ai`) using custom keywords
  like `assisted_living_reddit_0814_01` for UTM-free click tracking
- Posts top 10–15 results to `#social-monitoring` on Discord
- Saves JSON audit trail in `data/`

### How to run
```bash
cd /Users/joshdev/Assistedly.ai/scripts/nextdoor-monitor
python3 monitor.py --tiers tier1,tier2
```

Options:
- `--dry-run` — search only, don't post to Discord
- `--tiers tier1|tier2|tier3|all` — which town tiers to cover
- `--max-queries N` — cap total searches (default 25)

### How it's scheduled
Managed via Goose scheduled recipe (`firecrawl-nextdoor-monitor.yaml`).
Runs daily at 08:00 ET.

To schedule manually:
```bash
goose schedule add \
  --recipe ~/.config/goose/recipes/firecrawl-nextdoor-monitor.yaml \
  --cron "0 8 * * *"
```

### Cost
~25 searches/day × 2 credits = ~50 Firecrawl credits/day.
Adjust `--max-queries` if budget is tight.

---

## Manual Nextdoor Monitoring (10 min/day)

> **Why manual?** Nextdoor is a closed platform. Most conversations require login.
> Firecrawl can find publicly indexed posts, but authentic engagement requires
> a real logged-in business account.

### Daily Workflow

1. **Sign in** to Nextdoor web (not app) using the Assistedly Business Page.
2. **Search** each keyword:
   - assisted living
   - memory care
   - nursing home
   - senior care
   - home care
   - elder care
   - aging parents
   - Medicaid
3. **Filter by Posts** to see conversations (not Marketplace or Events).
4. **Open relevant posts**, copy the link (Share → Copy Link).
5. **Paste into tracking spreadsheet** (create a Google Sheet with columns:
   Date, Town, Platform, Post URL, Topic, Action Taken, Notes).
6. **Switch to Business Page** and draft a helpful reply:
   - Answer the question first, promote second (if at all).
   - Example: *"I work with families navigating this in [Town]. Happy to share
     a free cost comparison if helpful — no obligations. Feel free to DM."*

### Priority Towns

**Tier 1** (check first every day)
- Plymouth
- Barnstable / Hyannis / Falmouth
- Worcester
- Framingham / Natick / Sudbury
- Lexington / Concord / Carlisle
- Newton / Brookline / Chestnut Hill
- Hingham / Cohasset / Scituate
- Pittsfield / Lenox / Great Barrington

**Tier 2** (check every other day or via Google Alerts)
- Springfield / Chicopee
- Lowell / Chelmsford / Dracut
- Lynn / Salem / Peabody
- Taunton / Attleboro / New Bedford

**Tier 3** (weekly spot-check or rely on automated monitor)
- Smaller towns with ALFs but lower Nextdoor volume.

---

## Google Alerts Setup (Free)

Create these alerts scoped to Massachusetts. Set frequency:
- **First 30 days:** As-it-happens
- **After 30 days:** Daily (once volume is understood)

Queries to create:
```
"assisted living" "nextdoor" Massachusetts
"memory care" "nextdoor" Massachusetts
"nursing home" "nextdoor" Massachusetts
"senior care" "nextdoor" Massachusetts
"home care" "nextdoor" Massachusetts
"elder care" "nextdoor" Massachusetts
"aging parents" "nextdoor" Massachusetts
"Medicaid" "assisted living" "nextdoor" Massachusetts
```

Delivery options:
- Deliver to a shared Gmail / Google Workspace account
- Forward to `#social-monitoring` via Zapier or n8n (optional automation layer)

---

## Engagement Rules

1. **Disclose affiliation** — Always mention you work with Assistedly.ai if
   recommending services.
2. **Help first, sell second** — Answer the question. Offer the free tool.
   Don't drop a link and leave.
3. **No astroturfing** — Never create fake accounts or pretend to be a
   neighbor. Use the verified business page.
4. **Track everything** — The spreadsheet is your source of truth for
   measuring brand trust ROI.
5. **Respond within 24h** — Speed matters for distressed caregivers.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Discord 403 | Check `User-Agent` header in `monitor.py`; Cloudflare blocks default urllib UA |
| Firecrawl quota exhausted | Reduce `--max-queries` or switch to every-2-day schedule |
| No Nextdoor results in monitor | Expected — Nextdoor is mostly gated. Rely on Reddit, Facebook groups, Quora, and manual monitoring for Nextdoor. |
| Wrong Discord channel | Update `channel_id` in `monitor.py` or set `DISCORD_MONITOR_CHANNEL_ID` in Infisical |

---

## Files

- `monitor.py` — Main automated discovery + Discord posting script
- `README.md` — This file
- `.gitignore` — Excludes `data/` and secrets
- `data/` — Audit JSONs (auto-created, not committed)
