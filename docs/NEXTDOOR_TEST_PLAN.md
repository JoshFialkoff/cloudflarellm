# Nextdoor Integration — Test Plan & NAM Configuration

## Last Updated: 2026-08-15

---

## 1. Quick Code Verification (✅ Done)

| Check | Status |
|---|---|
| `lib/nextdoorUniversalPixel.js` compiles | ✅ |
| `lib/nextdoorAnalytics.js` compiles | ✅ |
| `lib/intakeAnalytics.js` compiles | ✅ |
| `lib/authAnalytics.js` compiles | ✅ |
| `lib/chatAnalytics.js` compiles | ✅ |
| `lib/shortlistAnalytics.js` compiles | ✅ |
| `components/PostHogAppViewTracker.jsx` compiles | ✅ |
| Critical feature guard passes | ✅ |
| Full Next.js + OpenNext build passes | ✅ |

### Fixed during testing
- **Naming collision** in `lib/nextdoorAnalytics.js`: `trackNextdoorSearch` (local export) collided with imported `trackNextdoorSearch`. Aliased imports to `ndTrackSearch`, `ndTrackLead`, `ndTrackSignUp`, `ndTrackCustomConversion`. Added missing `trackNextdoorViewContent` import.

---

## 2. Event Coverage Matrix

Every key user action now fires **three pipes** simultaneously:
1. **PostHog** (`nextdoor_*` events + person properties)
2. **GA4 / GTM** (`dataLayer` events)
3. **Nextdoor Universal Pixel** (`nd_*` dataLayer events + direct `window.ndp`)

| User Action | PostHog Event | GA4 dataLayer | Nextdoor Standard Event | Nickname |
|---|---|---|---|---|
| Any page load | `$pageview` | `page_view` | `PageView` | — |
| Site search | `nextdoor_search` | `nextdoor_search` | `Search` | — |
| Intake complete | `nextdoor_intake_complete` | `nextdoor_conversion` | `Lead` | — |
| Inquiry submit | `nextdoor_inquiry_submit` | `nextdoor_conversion` | `Lead` | — |
| Compare inquiry | `compare_submit_inquiry` | `conversion` | `Lead` | — |
| Chat completed | `lead_submitted` | `conversion` | `Lead` | — |
| Magic link sent | `generate_lead` | `conversion` | `Lead` | — |
| Magic link verified | `auth_magic_link_verified` | `nextdoor_auth_verified` | `SignUp` | — |
| Wizard save success | `wizard_save_success` | `conversion` | `SignUp` | — |
| Matched result click | `nextdoor_matched_result_click` | `nextdoor_matched_result_click` | `ViewContent` | — |
| Shortlist add | `nextdoor_shortlist_add` | `nextdoor_shortlist_add` | `CustomConversion` | `shortlist_add` |
| Compare open | `nextdoor_compare_open` | `nextdoor_compare_open` | `CustomConversion` | `compare_open` |

---

## 3. GTM Configuration Checklist

### Tags to Create (Official Nextdoor Tag Template)

1. **Tag: `Nextdoor — PageView`**
   - Type: Nextdoor Pixel (from GTM Template Gallery)
   - Trigger: Custom Event `nd_page_view`
   - Event Mapping: `PageView`
   - Deduplication: use `event_id` variable

2. **Tag: `Nextdoor — Lead`**
   - Type: Nextdoor Pixel
   - Trigger: Custom Event `nd_lead`
   - Event Mapping: `Lead`
   - Include `transaction_id` = `event_id`

3. **Tag: `Nextdoor — SignUp`**
   - Type: Nextdoor Pixel
   - Trigger: Custom Event `nd_sign_up`
   - Event Mapping: `SignUp`

4. **Tag: `Nextdoor — Search`**
   - Type: Nextdoor Pixel
   - Trigger: Custom Event `nd_search`
   - Event Mapping: `Search`

5. **Tag: `Nextdoor — ViewContent`**
   - Type: Nextdoor Pixel
   - Trigger: Custom Event `nd_view_content`
   - Event Mapping: `ViewContent`

6. **Tag: `Nextdoor — Custom Conversions`**
   - Type: Nextdoor Pixel
   - Trigger: Custom Event `nd_custom_conversion`
   - Event Mapping: `CustomConversion`
   - Custom Conversion Nickname: `{{custom_conversion_nickname}}` (dataLayer variable)

### DataLayer Variables to Create

- `event_id` — Data Layer Variable
- `transaction_id` — Data Layer Variable
- `page_path` — Data Layer Variable
- `custom_conversion_nickname` — Data Layer Variable
- `facility_slug` — Data Layer Variable (optional, for enrichment)
- `inquiry_surface` — Data Layer Variable (optional, for enrichment)

---

## 4. Nextdoor Ads Manager — URL-Based Setup (Fallback)

If you prefer URL-based tracking instead of GTM event-based, add these URL contains rules:

| Nextdoor Event | URL Contains | Notes |
|---|---|---|
| `PageView` | `assistedly.ai` | Catches all pages |
| `Lead` | `/results` | Intake complete page |
| `Lead` | `/matched` | Matched results shown |
| `Lead` | `/facility/` | Facility pages (legacy) |
| `Lead` | `/compare` | Compare inquiry submitted |
| `SignUp` | `auth_verified` | Magic link verification |
| `Search` | `/search` | Directory search |
| `ViewContent` | `/facility/ma/` | App Router facility pages |
| `ViewContent` | `/massachusetts/` | Town landing pages |
| `ViewContent` | `/tools/cost-calculator` | Cost calculator |

> ⚠️ URL-based will **miss** shortlist adds, compare opens, and chat completions (client-side only, no route change).

---

## 5. Manual Browser Test Steps

### Step A: Simulate Nextdoor Traffic
Open an incognito window and visit:
```
https://assistedly.ai/?utm_source=nextdoor&utm_campaign=test-campaign-001&nd_post_id=12345
```

### Step B: Open DevTools → Console
Run:
```javascript
// Verify dataLayer is receiving Nextdoor events
window.dataLayer.filter(e => e.event && e.event.startsWith('nd_'))
```

You should see an `nd_page_view` object immediately.

### Step C: Perform Actions & Watch Console

| Action | Console Check |
|---|---|
| Search for "Springfield" | `dataLayer.filter(e => e.event === 'nd_search')` |
| Complete intake wizard | `dataLayer.filter(e => e.event === 'nd_lead')` |
| Click a matched result | `dataLayer.filter(e => e.event === 'nd_view_content')` |
| Shortlist a facility | `dataLayer.filter(e => e.event === 'nd_custom_conversion' && e.custom_conversion_nickname === 'shortlist_add')` |
| Open compare tool | `dataLayer.filter(e => e.event === 'nd_custom_conversion' && e.custom_conversion_nickname === 'compare_open')` |
| Submit inquiry on compare | `dataLayer.filter(e => e.event === 'nd_lead')` |
| Trigger magic link auth | `dataLayer.filter(e => e.event === 'nd_sign_up')` |

### Step D: Verify in Nextdoor Ads Manager
1. Go to **Assets → Pixels**
2. Open **Test Events Manager**
3. Perform the actions above
4. Confirm events appear within 1–2 minutes

---

## 6. App Router Coverage

Previously, App Router pages (`/facility/ma/[slug]`, `/massachusetts/*`, etc.) did **not** fire Nextdoor events. Fixed by adding Nextdoor tracking to `components/PostHogAppViewTracker.jsx`:

- `trackNextdoorPageView` fires on **every** App Router navigation
- `trackNextdoorPageview` (enriched) fires only for Nextdoor-attributed traffic

This ensures facility detail pages and Massachusetts hub pages build Nextdoor retargeting audiences even for cold traffic.

---

## 7. Custom Conversions to Configure in NAM

| # | Nickname | Optimize For | Expected Volume |
|---|---|---|---|
| 1 | `shortlist_add` | High intent | Medium |
| 2 | `compare_open` | Research intent | Low-Medium |
| 3 | `wizard_save` | Engagement | Medium |
| 4 | `chat_completed` | Lead gen | Low |
| 5 | `cost_calculator` | Tool usage | Low |

---

## 8. Deduplication Note

All Nextdoor events share the same `event_id` generator as GA4 (`lib/conversionDataLayer.js` → `newEventId`). When GTM passes `event_id` through the Nextdoor Tag Template, Nextdoor will deduplicate identical events automatically.

---

## 9. Environment Variables

No new env vars are required if loading via **GTM** (recommended).

If you choose manual base-code loading instead:
```bash
NEXT_PUBLIC_NEXTDOOR_PIXEL_ID=ND-XXXXXXXX
```
Then add the Nextdoor base pixel script to `pages/_document.js` or `app/layout.js` `<head>`.
