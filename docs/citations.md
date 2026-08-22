# Data Citations — Assistedly.ai

> **Principle:** Every number shown to a family has a source. Every source is publicly explainable.

---

## User-Facing Pattern

**Facility card:**
```
Sunrise of Lynnfield
$11,400¹ / mo          Score: 72²
Winchester, MA
```

- `¹` → "MA EOEA ALR Report 2025" + link to methodology
- `²` → "CMS Care Compare + state inspections" + link

**Hover state:** Tooltip shows source name. Click opens methodology page in new tab.

---

## Data Layer (chart-facilities.json)

```json
{
  "name": "Sunrise of Lynnfield",
  "avgFee": 11400,
  "safetyScore": 72,
  "sources": [
    { "field": "avgFee", "source": "eoea-alr-2025", "url": "https://assistedly.ai/methodology#eoea-alr-2025" },
    { "field": "safetyScore", "source": "cms-care-compare", "url": "https://assistedly.ai/methodology#cms-care-compare" }
  ]
}
```

---

## Source Registry

| ID | Label | Public? | Update Frequency |
|---|---|---|---|
| `eoea-alr-2025` | MA EOEA ALR Report | ✅ FOIA | Annual |
| `cms-care-compare` | CMS Care Compare | ✅ Federal | Quarterly |
| `state-inspections` | MA Inspection Records | ✅ Public | Ongoing |
| `self-reported` | Facility Direct | ⚠️ Attested | As received |
| `assistedly-calculated` | Our Formula | ✅ Documented | Per sync |

---

## Methodology Page Sections

The `/methodology` page contains:
1. **How we score safety** — formula, weights, data inputs
2. **How we calculate cost** — fee averaging, daily→monthly conversion
3. **Data freshness** — last update timestamp
4. **Limitations** — what the data can't tell you
5. **Corrections** — how facilities can request updates

---

## Implementation

- `lib/citations.js` — source definitions + `buildCitations()` helper
- `scripts/sync-noco-to-charts.cjs` — adds `sources` array to each facility
- `scripts/guard-data-quality.mjs` — validates all facilities have ≥1 source
- UI: superscript numbers link to methodology anchors
