# Goose-Discovered Tasks for Plane — Review & Import Guide

> **Generated:** 2026-08-13 20:35 ET  
> **Scope:** Human-intervention ONLY. Automated fixes (SSH cleanup, guard scripts, code patches) are excluded.  
> **Files in this folder:**
> - `goose_human_tasks.json` — Structured JSON with all metadata  
> - `goose_human_tasks.csv` — **Plane-importable CSV**  
> - `GOOSE_REVIEW.md` — This document

---

## How to import into Plane

Plane supports CSV bulk import for Issues. Steps:
1. Open Plane → **Coding** or **Business Development** project → Issues tab
2. Click **Import** → choose **CSV**
3. Map columns: `Name` → Name, `Description` → Description, `Priority` → Priority, `Labels` → Labels
4. Plane will create all issues in `Backlog`

---

## Task Summary by Priority

### 🔴 Urgent (2 tasks)

| ID | Task | Project | Why it needs a human |
|---|---|---|---|
| HUMAN-001 | Fix Infisical PLANE_API_KEY mapping | Coding | You must decide which Infisical secret to bind to `PLANE_API_KEY` |
| HUMAN-002 | Decide: rotate all exposed secrets | Executive | Security risk decision + generating new keys at vendor dashboards |

### 🟠 High (4 tasks)

| ID | Task | Project | Why it needs a human |
|---|---|---|---|
| HUMAN-003 | Find YoURLS origin server | Coding | Needs Cloudflare dashboard login or a new API token with Zone:Read |
| HUMAN-005 | Review registration CTA A/B test | Business Development | Product decision: keep, kill, or iterate based on conversion data |
| HUMAN-008 | Send LinkedIn DMs to top 5 AgeTech quick-wins | Business Development | Outreach requires your personal LinkedIn account + judgment |
| HUMAN-009 | Review 88 AgeTech companies in Twenty CRM | Business Development | Strategic prioritization of next outreach batch |

### 🟡 Medium (4 tasks)

| ID | Task | Project | Why it needs a human |
|---|---|---|---|
| HUMAN-004 | Set YoURLS admin password | Coding | Choose password + store securely in Infisical |
| HUMAN-007 | Export LinkedIn DMs into Twenty CRM | Business Development | LinkedIn has no public DM API; needs manual export or browser automation |
| HUMAN-011 | Design Twenty-Plane contact sync workflow | Business Development | Workflow design decision (auto vs manual trigger, field mapping) |
| HUMAN-012 | Review Analytics Insight Monitor Discord reports | Business Development | Validate whether automated reports are actionable or noise |

### 🟢 Low (2 tasks)

| ID | Task | Project | Why it needs a human |
|---|---|---|---|
| HUMAN-006 | Decide on Nextdoor campaign depth | Business Development | Strategy call based on traffic volume data |
| HUMAN-010 | Fix Google Sheets upload auth scope | Business Development | Google Cloud Console permission change by account owner |

---

## Automated tasks that were filtered OUT

The following were detected but can be done by Goose without your involvement:

- **RackNerd .162 disk cleanup** — `ssh root@104.168.38.162 'docker system prune -f && journalctl --vacuum-time=3d'`
- **RackNerd .185 disk cleanup** — same pattern
- **RackNerd .106 swap reduction** — review top swap consumers via SSH
- **Fix duplicate AssistedlyLogo** — code edit + guard script verification
- **Run guard-critical-features.mjs** — `node scripts/guard-critical-features.mjs`
- **Verify DEEP_DIVE_AUTOMATION_DIFY_API_KEY in Worker env** — `npx wrangler secret list`
- **Confirm Nextdoor referrer on remote server** — SSH + grep
- **Verify Analytics Insight Monitor scheduled job** — `goose schedule inspect`

If you want any of these automated, just say **“run the automated fixes”** and Goose will execute them.

---

## Quick wins you can do in the next 30 minutes

1. **HUMAN-001** — Fix PLANE_API_KEY (5 min: Infisical → rename secret → restart agent)
2. **HUMAN-008** — Send LinkedIn DM to 1 AgeTech quick-win (10 min: open LinkedIn, copy message from `agetech_channel_outreach_messages.md`)
3. **HUMAN-012** — Check Discord #project-management for the most recent analytics report (2 min)

---

## Project mapping for import

| Project | Plane Project ID | Tasks |
|---|---|---|
| Coding | `64a3045d-76e5-4501-a943-11e5fd8718f6` | HUMAN-001, 003, 004 |
| Business Development | `59048c57-f5db-4247-ac61-e6019c012985` | HUMAN-005, 006, 007, 008, 009, 010, 011, 012 |
| Executive | `64a3045d-76e5-4501-a943-11e5fd8718f6` | HUMAN-002 |

*(Note: Executive uses the same project ID as Coding in the current Plane workspace. You may want to create a separate Executive project in Plane if you prefer. If so, export HUMAN-002 to a new project after creation.)*
