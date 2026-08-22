# Event Taxonomy — Assistedly.ai

> **Rule:** Every `posthog.capture()` and `dataLayer.push()` MUST use a name from this document.  
> **Guard:** `npm run guard:event-taxonomy` validates the codebase against this list.

---

## Wizard / Intake (Legacy — migrate to `intake_*`)

| Canonical Name | PostHog | GA4 | Description |
|---|---|---|---|
| `wizard_started` | `wizard_started` | — | Legacy wizard begin |
| `wizard_step_entry` | `wizard_step_entry` | — | Legacy wizard step start |
| `wizard_completed` | `wizard_completed` | — | Legacy wizard submit |
| `wizard_dropped_off` | `wizard_dropped_off` | — | Legacy wizard abandonment |
| `wizard_ai_responded` | `wizard_ai_responded` | — | Legacy AI response |
| `wizard_facilities_shown` | `wizard_facilities_shown` | — | Legacy results render |
| `chat_stream_first_token_ms` | `chat_stream_first_token_ms` | — | Dify latency metric |

> **Deprecation plan:** Rename `wizard_*` → `intake_*` incrementally. Keep both in taxonomy until migration complete.

---

## Intake Funnel

| Canonical Name | PostHog | GA4 (via GTM) | GTM Trigger | Conversion | Description |
|---|---|---|---|---|---|
| `intake_started` | `intake_started` | `generate_lead` | `intake_.*` | ✅ | User clicks "Get Started" on intake |
| `intake_step_complete` | `intake_step_complete` | — | `intake_.*` | — | Each step progress (step number in properties) |
| `intake_completed` | `intake_completed` | `sign_up` | `intake_.*` | ✅ | All steps submitted |
| `intake_abandoned` | `intake_abandoned` | — | — | — | 60s inactive or closed tab before completion |

**Required properties:** `step` (number), `total_steps` (number), `source_page` (string)

---

## Search & Discovery

| Canonical Name | PostHog | GA4 | Trigger | Description |
|---|---|---|---|---|
| `search_executed` | `search_executed` | `search` | `search_.*` | User submits search query |
| `facility_viewed` | `facility_viewed` | `view_item` | `facility_.*` | Facility detail page loaded |
| `compare_initiated` | `compare_initiated` | `select_content` | `compare_.*` | User adds facility to comparison |
| `filter_applied` | `filter_applied` | — | — | Cost, care type, or location filter used |

**Required properties:** `query` (string, Search), `facility_id` (string, Facility), `filter_type` (string, Filter)

---

## Location & Scores

| Canonical Name | PostHog | GA4 | Trigger | Description |
|---|---|---|---|---|
| `location_changed` | `location_changed` | — | — | City/radius updated in Scores tab |
| `score_tab_switched` | `score_tab_switched` | — | — | User switches between safest/top-rated/affordable |
| `radius_changed` | `radius_changed` | — | — | Mile radius dropdown changed |

---

## Lead Capture (Soft Gate)

| Canonical Name | PostHog | GA4 | Conversion | Description |
|---|---|---|---|---|
| `auth_prompt_shown` | `auth_prompt_shown` | — | — | AuthCapture modal rendered after results |
| `auth_prompt_completed` | `auth_prompt_completed` | `sign_up` | ✅ | User completes login/signup at soft gate |
| `auth_prompt_dismissed` | `auth_prompt_dismissed` | — | — | User closes without completing |

---

## Chat / Ask

| Canonical Name | PostHog | GA4 | Description |
|---|---|---|---|
| `chat_message_sent` | `chat_message_sent` | — | Free-text question submitted |
| `chat_response_received` | `chat_response_received` | — | Dify returns answer |
| `chat_source_clicked` | `chat_source_clicked` | `select_content` | User clicks citation link in chat |

---

## Typebot / External Chat

| Canonical Name | PostHog | GA4 | Description |
|---|---|---|---|
| `typebot_completed` | `typebot_completed` | — | Typebot flow finished |
| `typebot_question_answered` | `typebot_question_answered` | — | Each Typebot answer |

## Retargeting

| Canonical Name | PostHog | GA4 | Description |
|---|---|---|---|
| `retargeting_eligible` | `retargeting_eligible` | — | User qualifies for ad retargeting |

## Experiments

| Canonical Name | PostHog | GA4 | Description |
|---|---|---|---|
| `wizard_path_variant_shown` | `wizard_path_variant_shown` | — | A/B variant rendered |

## Partner Pilot (Current)

| Canonical Name | PostHog | GA4 | Description |
|---|---|---|---|
| `partner_landing_viewed` | `partner_landing_viewed` | `page_view` | Co-branded landing page load |
| `partner_landing_click` | `partner_landing_click` | — | CTA click on partner page |
| `partner_consent_given` | `partner_consent_given` | — | Consent checkbox accepted |
| `partner_consent_denied` | `partner_consent_denied` | — | Consent checkbox declined |
| `partner_assessment_start` | `partner_assessment_start` | — | Assessment flow begins |
| `partner_assessment_step_complete` | `partner_assessment_step_complete` | — | Assessment step done |
| `partner_assessment_completed` | `partner_assessment_completed` | — | Full assessment submitted |
| `partner_snapshot_viewed` | `partner_snapshot_viewed` | — | Partner results page loaded |
| `partner_facility_search` | `partner_facility_search` | `search` | Search from partner context |
| `partner_referral_submitted` | `partner_referral_submitted` | `generate_lead` | Lead form on partner page |

---

## Page Views

| Canonical Name | PostHog | GA4 | Description |
|---|---|---|---|
| `pageview` | `$pageview` | `page_view` | Automatically tracked by both |

> **Rule:** Never fire a custom `pageview` event. Use PostHog `$pageview` + GA4 `page_view` natively.

---

## Naming Convention

```
<domain>_<action>

Domains:  intake | search | facility | compare | filter | location | score | auth | chat | partner
Actions:  started | completed | abandoned | executed | viewed | initiated | applied | changed | switched | sent | received | clicked
```

---

## Properties Standard

```javascript
// Every event SHOULD include
{
  distinct_id: string,     // PostHog person ID
  $current_url: string,    // auto by PostHog
  $referrer: string,       // auto by PostHog
  source_page: string,     // where the action originated
  version: string,         // app version / deploy hash
}
```

---

## Guard Integration

`scripts/guard-event-taxonomy.mjs` scans:
- `posthog.capture('...')` → must match PostHog column
- `dataLayer.push({ event: '...' })` → must match GA4 column
- Any unknown event name → **FAIL**

To add a new event:
1. Add row to this document
2. Update `guard-event-taxonomy.mjs` allowlist
3. Update GTM trigger if GA4 tag needed
4. Update GTM tag payload if new conversion
