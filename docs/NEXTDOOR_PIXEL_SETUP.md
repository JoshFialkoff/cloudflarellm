# Nextdoor Universal Pixel Setup — Assistedly.ai

> **Last updated:** 2026-08-15

## What changed in code

A new module `lib/nextdoorUniversalPixel.js` now fires **standard Nextdoor Universal Pixel events** on top of the existing PostHog + GA4 dataLayer pipeline.

Every key conversion on assistedly.ai now pushes:
- **PostHog** (existing `nextdoor_*` events for cohorts)
- **GA4 / GTM** (existing `dataLayer` events)
- **Nextdoor Universal Pixel** (new standard events: `PageView`, `Lead`, `SignUp`, `Search`, `ViewContent`, `CustomConversion`)

## Event → URL mapping for NAM (Nextdoor Ads Manager)

If you are using **URL-based event mapping** in NAM, add these URL patterns:

| Nextdoor Event | URL "contains" rule | Page / Action |
|---|---|---|
| **Page view** | `https://assistedly.ai/` | Already configured |
| **Lead** | `https://assistedly.ai/results` | Intake wizard completes |
| **Lead** | `https://assistedly.ai/matched` | Matched results shown |
| **Lead** | `https://assistedly.ai/facility/` | Facility detail inquiry / deep dive |
| **Lead** | `https://assistedly.ai/compare` | Compare tool inquiry submitted |
| **Sign up** | `https://assistedly.ai/` + query `auth_verified=1` | Magic link verified |
| **Search** | `https://assistedly.ai/search` | Facility directory search |
| **View content** | `https://assistedly.ai/facility/` | Facility detail pages |
| **View content** | `https://assistedly.ai/massachusetts/` | Town / local content pages |
| **View content** | `https://assistedly.ai/tools/cost-calculator` | Cost calculator tool |

> ⚠️ **Important:** URL-based mapping only catches **page loads**. Many conversions (inquiry submits, shortlist adds, chat completions) happen **client-side without a URL change**. For the most accurate reporting, use **event-based tracking** (see next section).

## GTM Event-Based Setup (Recommended for accuracy)

Create Custom Event triggers in GTM that listen for these `dataLayer` events:

| dataLayer `event` | Nextdoor Tag Template mapping | Fires when |
|---|---|---|
| `nd_page_view` | `PageView` | Every route change (all users) |
| `nd_lead` | `Lead` | Intake complete, inquiry submit, compare inquiry, chat lead |
| `nd_sign_up` | `SignUp` | Magic link verified, wizard save success |
| `nd_search` | `Search` | Site search performed |
| `nd_view_content` | `ViewContent` | Matched result click, facility page |
| `nd_custom_conversion` | `CustomConversion 1–10` | Shortlist add, compare open, etc. |

### Trigger examples in GTM

1. **Trigger: `nd_lead`**
   - Type: Custom Event
   - Event name: `nd_lead`

2. **Trigger: `nd_sign_up`**
   - Type: Custom Event
   - Event name: `nd_sign_up`

3. **Trigger: `nd_custom_conversion`**
   - Type: Custom Event
   - Event name: `nd_custom_conversion`
   - (Optional) Fire on: `custom_conversion_nickname` equals `shortlist_add`

## Recommended Custom Conversions

Use **Custom Conversion 1–5** in the Nextdoor Tag Template with these nicknames:

| Custom Conversion # | Nickname | Code trigger | Business meaning |
|---|---|---|---|
| **1** | `shortlist_add` | `trackNextdoorCustomConversion("shortlist_add")` | User favorited a facility |
| **2** | `compare_open` | `trackNextdoorCustomConversion("compare_open")` | User opened side-by-side compare |
| **3** | `wizard_save` | `trackNextdoorCustomConversion("wizard_save")` | User saved intake progress |
| **4** | `chat_completed` | `trackNextdoorCustomConversion("chat_completed")` | AI chat finished as lead |
| **5** | `cost_calculator` | `trackNextdoorCustomConversion("cost_calculator")` | Cost calculator fully used |

> **Why custom conversions?** Nextdoor’s standard `Lead` event captures the **conversion**, but custom conversions let you optimize creative/targeting for **micro-conversions** (e.g., people who shortlist are higher intent).

## Environment variable

If you ever load the Nextdoor base pixel manually (instead of GTM), set:

```bash
NEXT_PUBLIC_NEXTDOOR_PIXEL_ID=ND-XXXXXXXX
```

Most teams should **load the pixel via GTM** using the official Nextdoor Tag Template (updated June 2025) rather than embedding the base code directly.

## Testing

1. Open the site with `utm_source=nextdoor` in the URL.
2. Open browser DevTools → Network tab → filter `nextdoor` or `public_pixels`.
3. Perform actions (intake, search, shortlist, inquiry).
4. In NAM, go to **Assets → Pixels → Test Events Manager** to verify firing.

## Event deduplication

Every event now carries a shared `event_id` (and `transaction_id`).
- **GA4** uses it for deduplication automatically.
- **Nextdoor** uses it when passed through the GTM template.
- **PostHog** uses distinct event names + person properties.
