# MA Unique KPIs — Recommended for Assistedly.ai Listings

**Date:** 2026-08-08  
**Data Source:** MA EOEA FOIA (270 facilities, 315 fields)  
**Competitor Gap:** A Place for Mom, Caring.com, Seniorly do NOT display these metrics.

---

## Tier 1 — Must-Add (Highest Impact for Families)

| KPI | Why It Matters | Display Format |
|-----|---------------|----------------|
| **Pricing Range** (Lowest/Highest monthly fee by unit type) | #1 decision factor for families | Price card: Studio $X–$Y, 1BR $X–$Y |
| **Traditional vs SCR Units** | SCR = Memory Care certified beds | Badges: "17 Traditional | 8 Memory Care" |
| **Occupancy Rate** (12-month trend) | High = popular/trusted; Low = availability | Sparkline chart or % badge |
| **For-Profit vs Not-for-Profit** | Important value signal for many families | Badge with tooltip explanation |
| **Medication Administration Level** (SAMM / LMA / Both) | Indicates clinical sophistication | Icon row: 💊 SAMM ✓, 💉 LMA ✓ |

---

## Tier 2 — Strong Differentiator (Competitors Lack Entirely)

| KPI | Why It Matters | Display Format |
|-----|---------------|----------------|
| **Staffing: Contracted vs Direct** + LPN/RN/PCA hours | Quality of care proxy | Staff breakdown bar chart |
| **Move-Out to SNF Rate** | Indicates ability to age in place | "X% moved to higher care last year" |
| **Average Length of Stay** | Helps families plan financially | "Residents stay 2.4 years on average" |
| **Video Surveillance Coverage** | Safety assurance during visits | Checklist: Entrances ✓, Common areas ✓ |
| **Backup Generator** | Critical for MA winters/power outages | Badge: "Backup Power ✓" |

---

## Tier 3 — Discharge Planner & Clinical Value

| KPI | Why It Matters | Display Format |
|-----|---------------|----------------|
| **SCO / PACE / GAFC Participation** | Directly determines insurance coverage | Filterable insurance tags |
| **Section 8 / MRVP Acceptance** | Affordability for low-income families | "Accepts Housing Vouchers ✓" |
| **EMR Adoption** | Care coordination quality signal | "Electronic Health Records ✓" |
| **Advance Care Planning Rate** (HCP, MOLST) | Mature end-of-life culture | "% with documented care plans" |
| **Transportation** (Medical, shopping, social) | Independence & access | Icon row: 🏥 ✓, 🛒 ✓, 🎉 ✓ |
| **Resident Age Demographics** | Community fit (younger vs older) | Mini histogram or range |

---

## Tier 4 — Deep Data / Charts (For Detail Pages)

| KPI | Display Format |
|-----|---------------|
| Monthly Occupancy Trend (12 months) | Line chart |
| ADL Assistance Distribution (0–6 ADLs) | Stacked bar |
| Dementia Resident Count (Traditional + SCR) | Number badge |
| Move-Out Reasons Breakdown | Pie chart |
| Staff Hours by Month (RN, LPN, PCA) | Grouped bar chart |

---

## NocoDB Field Mapping

All data exists in table: `2-15-26 State Data (FOIA)` (`mix4o0ymn0l2nhz`)

Key fields:
- `Traditional Units Number of Certified Traditional Units`
- `SCR Units Number of Certified SCR Units`
- `Traditional Units with Lowest Monthly Fee` / `Highest Montly Fee`
- `Total Number of Residents January` … `December`
- `Total Units Occupied January` … `December`
- `Contracted Agency Staff`
- `Did ALR offer LMA`
- `Did ALR provide Skilled Care`
- `Did ALR have video surveillance`
- `Did ALR have backup generator`
- `ALR Tax Status`
- `Housing Affordability Restrictions`
- `Traditional Residents that participated in SCO`
- `Traditional Residents that participated in PACE`
- `Traditional Residents that received Section 8`
- `Traditional Residents that received MRVP`
- `Was ALR using EMRs`
- `Number of Traditional Residents with Health Care Proxy`
- `Number of Traditional Residents with MOLST`
- `Duration of residency` categories (aggregate to calculate avg LOS)

---

## Implementation Priority

1. **Phase 1 (This Week):** Add Pricing Range + Unit Count badges to facility cards
2. **Phase 2 (Next 2 Weeks):** Add Occupancy %, Tax Status, Medication Level to detail pages
3. **Phase 3 (Next Month):** Add staffing charts, move-out analytics, insurance filters
4. **Phase 4 (Ongoing):** Full chart suite on detail pages using Recharts/D3

---

## Daily Automation

Script: `scripts/daily-ma-market-intelligence.sh`
- Runs Firecrawl search + competitor agent
- Posts summary to Discord
- Archives old data
- NocoDB manual review queue updated weekly
