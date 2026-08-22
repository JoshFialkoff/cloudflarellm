# Assistedly.ai Analytics Nomenclature Sync Audit

**Date:** 2026-08-16 • **Scope:** PostHog ↔ GA4/GTM event naming parity

---

## Executive Summary

The Assistedly.ai codebase fires analytics events to both **PostHog** (primary product analytics) and **GA4/GTM** (conversion tracking, paid-media attribution). Most event names are synced correctly, but **four critical patterns** create mismatches that break GTM triggers, fragment conversion reporting, and make funnel analysis unreliable across the two systems.

### Severity
| Issue | Severity | Impact |
|---|---|---|
| `captureNextdoorEvent` / `captureAIEvent` replace `_` with spaces for dataLayer | 🔴 Critical | GTM triggers expecting `snake_case` never fire |
| `captureWithExperiment` sends to PostHog only (no dataLayer bridge) | 🟡 High | ~12 PostHog events never reach GA4 |
| `registrationCTAAnalytics.js` non-conversion events = PostHog only | 🟡 High | Registration funnel invisible in GA4 |
| `botPlayerAnalytics.js` uses Title Case for one event | 🟠 Medium | Breaks snake_case convention in both systems |

---

## 1. Canonical Event Nomenclature Map

### Funnel / Conversion Events

| Canonical Event | PostHog Name | GA4 Name (dataLayer/GTM) | Sync Status | Notes |
|---|---|---|---|---|
| Page view | `$pageview` | `page_view` | ⚠️ Divergent | Standard naming; acceptable |
| Wizard started | `wizard_started` | `wizard_started` | ✅ Synced | Via `AssistedlyWizard.js` |
| Wizard step entry | `wizard_step_entry` | `wizard_step_entry` | ✅ Synced (indirect) | Only via `landingAnalytics.js` in free-text path |
| Wizard completed | `wizard_completed` | `wizard_completed` | ✅ Synced (indirect) | Only in `AssistedlyWizard.js` PostHog; no explicit GA4 push |
| Wizard dropped off | `wizard_dropped_off` | `wizard_dropped_off` | ⚠️ Partial | Only PostHog in `AssistedlyWizard.js` |
| Chat/typebot started | `typebot_started` | `typebot_started` | ✅ Synced | `chatAnalytics.js` → both |
| Chat/typebot question answered | `typebot_question_answered` | `typebot_question_answered` | ✅ Synced | `chatAnalytics.js` → both |
| Chat/typebot completed | `typebot_completed` | `typebot_completed` | ✅ Synced | `chatAnalytics.js` → both |
| Lead submitted | `lead_submitted` | `lead_submitted` | ✅ Synced | `chatAnalytics.js` → both |
| Typebot step viewed | `typebot_step_viewed` | `typebot_step_viewed` | ✅ Synced | `botPlayerAnalytics.js` → `captureLandingEvent` |
| Typebot conversion | — | `typebot_conversion` | 🔴 GA4 only | `botPlayerAnalytics.js` → `pushConversionDataLayer` only |
| Start Typebot Conversation | `Start Typebot Conversation` | `Start Typebot Conversation` | ⚠️ Title Case | Non-standard naming; should be `typebot_conversation_started` |
| Generate lead | `generate_lead` | `generate_lead` | ⚠️ Partial | Auth + CTA analytics push to GA4 for conversions only |

### Auth / Registration Events

| Canonical Event | PostHog Name | GA4 Name | Sync Status | Notes |
|---|---|---|---|---|
| Auth email focused | `auth_email_focused` | `auth_email_focused` | ✅ Synced | `authAnalytics.js` via `captureEvent` → `pushLandingDataLayer` |
| Auth email typing started | `auth_email_typing_started` | `auth_email_typing_started` | ✅ Synced | Same |
| Auth form submitted | `auth_form_submitted` | `auth_form_submitted` | ✅ Synced | Same |
| Auth magic link sent | `auth_magic_link_sent` | `auth_magic_link_sent` | ✅ Synced | Same + direct `pushConversionDataLayer` |
| Auth magic link verified | `auth_magic_link_verified` | `auth_magic_link_verified` | ✅ Synced | Same |
| Auth signed in | `auth_signed_in` | `auth_signed_in` | ✅ Synced | Same |
| Auth results page viewed | `auth_results_page_viewed` | `auth_results_page_viewed` | ✅ Synced | Same |
| Auth results data viewed | `auth_results_data_viewed` | `auth_results_data_viewed` | ✅ Synced | Same |
| Wizard save prompt shown | `wizard_save_prompt_shown` | `wizard_save_prompt_shown` | ✅ Synced | Same |
| Wizard save success | `wizard_save_success` | `wizard_save_success` | ✅ Synced | Same + conversion push |
| Email signup focused | `email_signup_focused` | `email_signup_focused` | ✅ Synced | Same |
| Email signup submitted | `email_signup_submitted` | `email_signup_submitted` | ✅ Synced | Same |

### CTA / Registration Funnel Events

| Canonical Event | PostHog Name | GA4 Name | Sync Status | Notes |
|---|---|---|---|---|
| Share results CTA shown | `share_results_cta_shown` | **NONE** | 🔴 PostHog only | `registrationCTAAnalytics.js` |
| Share results CTA expanded | `share_results_cta_expanded` | **NONE** | 🔴 PostHog only | Same |
| Share results form focused | `share_results_form_focused` | **NONE** | 🔴 PostHog only | Same |
| Share results form typing started | `share_results_form_typing_started` | **NONE** | 🔴 PostHog only | Same |
| Share results submitted | `share_results_submitted` | `share_results_submitted` | ✅ Synced | Conversion → `pushConversionDataLayer` |
| Save results CTA shown | `save_results_cta_shown` | **NONE** | 🔴 PostHog only | Same |
| Save results CTA clicked | `save_results_cta_clicked` | **NONE** | 🔴 PostHog only | Same |
| Save results submitted | `save_results_submitted` | `save_results_submitted` | ✅ Synced | Conversion → `pushConversionDataLayer` |
| Chat email capture shown | `chat_email_capture_shown` | **NONE** | 🔴 PostHog only | Same |
| Chat email capture focused | `chat_email_capture_focused` | **NONE** | 🔴 PostHog only | Same |
| Chat email capture typing started | `chat_email_capture_typing_started` | **NONE** | 🔴 PostHog only | Same |
| Chat email capture submitted | `chat_email_capture_submitted` | `chat_email_capture_submitted` | ✅ Synced | Conversion → `pushConversionDataLayer` |
| Find safest submitted | `find_safest_submitted` | `find_safest_submitted` | ✅ Synced | Conversion → `pushConversionDataLayer` |

### Intake / Matched Flow Events

| Canonical Event | PostHog Name | GA4 Name | Sync Status | Notes |
|---|---|---|---|---|
| Intake start | `intake_start` | `intake_start` | ✅ Synced | `intakeAnalytics.js` → both |
| Intake step complete | `intake_step_complete` | `intake_step_complete` | ✅ Synced | Same |
| Intake complete | `intake_complete` | `intake_complete` | ✅ Synced | Same |
| Matched result click | `matched_result_click` | `matched_result_click` | ✅ Synced | Same |
| Inquiry from matched flow | `inquiry_from_matched_flow` | `inquiry_from_matched_flow` | ✅ Synced | Same |
| Get matched submitted | `get_matched_submitted` | **NONE** | 🔴 PostHog only | `pages/get-matched.js` → `captureWithExperiment` only |
| Email capture submitted | `email_capture_submitted` | **NONE** | 🔴 PostHog only | `ConsumerLeadCapture.js` → `captureWithExperiment` only |

### Shortlist / Compare Events

| Canonical Event | PostHog Name | GA4 Name | Sync Status | Notes |
|---|---|---|---|---|
| Shortlist add | `shortlist_add` | `shortlist_add` | ✅ Synced | `shortlistAnalytics.js` → both |
| Shortlist remove | `shortlist_remove` | `shortlist_remove` | ✅ Synced | Same |
| Compare open | `compare_open` | `compare_open` | ✅ Synced | Same |
| Compare submit inquiry | `compare_submit_inquiry` | `compare_submit_inquiry` | ✅ Synced | Same |

### Action Goals

| Canonical Event | PostHog Name | GA4 Name | Sync Status | Notes |
|---|---|---|---|---|
| Ask an advisor clicked | `action_goal` (label) | `action_goal` (label) | ✅ Synced | `actionGoalTracking.js` → both |
| Content search box clicked | `action_goal` (label) | `action_goal` (label) | ✅ Synced | Same |
| Download shortlist clicked | `action_goal` (label) | `action_goal` (label) | ✅ Synced | Same |
| Top nav search clicked | `action_goal` (label) | `action_goal` (label) | ✅ Synced | Same |

### AI / NextDoor Campaign Events

| Canonical Event | PostHog Name | GA4 Name (dataLayer) | Sync Status | Notes |
|---|---|---|---|---|
| AI intake start | `ai_intake_start` | `ai intake start` | 🔴 **MISMATCH** | `captureAIEvent` replaces `_` with spaces |
| Nextdoor intake complete | `nextdoor_intake_complete` | `nextdoor intake complete` | 🔴 **MISMATCH** | `captureNextdoorEvent` replaces `_` with spaces |
| Nextdoor event (generic) | `nextdoor_*` | `nextdoor *` | 🔴 **MISMATCH** | All NextDoor events |
| AI event (generic) | `ai_*` | `ai *` | 🔴 **MISMATCH** | All AI events |

### Results Satisfaction Events

| Canonical Event | PostHog Name | GA4 Name | Sync Status | Notes |
|---|---|---|---|---|
| Results satisfaction rated | `results_satisfaction_rated` | `results_satisfaction_rated` | ✅ Synced | `chatAnalytics.js` → both |
| Results satisfaction comment | `results_satisfaction_comment` | `results_satisfaction_comment` | ✅ Synced | Same |
| Results satisfaction dismissed | `results_satisfaction_dismissed` | `results_satisfaction_dismissed` | ✅ Synced | Same |

### Wizard / Typebot Performance Events

| Canonical Event | PostHog Name | GA4 Name | Sync Status | Notes |
|---|---|---|---|---|
| Wizard AI responded | `wizard_ai_responded` | **NONE** | 🔴 PostHog only | `AssistedlyWizard.js` |
| Chat stream first token ms | `chat_stream_first_token_ms` | **NONE** | 🔴 PostHog only | Same |
| Wizard facilities shown | `wizard_facilities_shown` | **NONE** | 🔴 PostHog only | Same |
| Wizard path variant shown | `wizard_path_variant_shown` | **NONE** | 🔴 PostHog only | `wizardBudgetScenariosExperiment.js` |
| Hero variant shown | `hero_variant_shown` | **NONE** | 🔴 PostHog only | `pages/index.js` → `captureWithExperiment` |
| Retargeting eligible | `retargeting_eligible` | **NONE** | 🔴 PostHog only | `retargetingTracker.js` |

### Privacy / Consent Events

| Canonical Event | PostHog Name | GA4 Name | Sync Status | Notes |
|---|---|---|---|---|
| Hero CTA click | `hero_cta_click` | `hero_cta_click` | ⚠️ Conditional | `privacyAnalytics.js` — only if explicitly called |
| Cost calculator complete | `cost_calculator_complete` | `cost_calculator_complete` | ⚠️ Conditional | Same |
| Email submission | `email_submission` | `email_submission` | ⚠️ Conditional | Same |
| Phone submission | `phone_submission` | `phone_submission` | ⚠️ Conditional | Same |
| Business model page view | `business_model_page_view` | `business_model_page_view` | ⚠️ Conditional | Same |

---

## 2. Critical Issues

### Issue 1: `captureNextdoorEvent` / `captureAIEvent` Mangle Event Names for GA4 (🔴)

**Location:** `lib/posthogClient.js` lines 228 and 270

```js
window.dataLayer.push({
  event: event.replace(/_/g, " "), // GTM-friendly display name
  ...
})
```

**Problem:** Events like `nextdoor_intake_complete` become `nextdoor intake complete` in dataLayer. Any GTM Custom Event trigger configured to fire on `nextdoor_intake_complete` will **never fire**. This breaks all NextDoor and AI-assistant campaign tracking in GA4.

**Events Affected:**
- `ai_intake_start` → `ai intake start`
- `nextdoor_intake_complete` → `nextdoor intake complete`
- All future `ai_*` and `nextdoor_*` events

**Fix:** Remove the `.replace(/_/g, " ")` call. GTM triggers work with snake_case event names natively.

---

### Issue 2: `captureWithExperiment` is PostHog-Only (🟡)

**Location:** `lib/posthogClient.js` lines 176–194

```js
export function captureWithExperiment(event, properties) {
  // Only calls posthog.capture(event, {...})
  // No dataLayer / GA4 bridge
}
```

**Problem:** Approximately 12 event call-sites use `captureWithExperiment`, but the function only sends to PostHog. GA4 never sees these events.

**Files Affected:**
- `pages/get-matched.js` → `get_matched_submitted`
- `components/ConsumerLeadCapture.js` → `email_capture_submitted`
- `pages/index.js` / `pages/index-video.js` → `hero_variant_shown`
- `lib/intakeAnalytics.js` → `intake_start`, `intake_step_complete`, etc. (but these are redundantly pushed via `push({...})`)
- `lib/landingAnalytics.js` → `captureLandingEvent` wraps `captureWithExperiment` but **also** pushes `pushLandingDataLayer` — OK

**Partially OK:** `intakeAnalytics.js` and `landingAnalytics.js` wrap `captureWithExperiment` with their own dataLayer push, so they're actually synced. But `FacilityDeepDive.js`, `ConsumerLeadCapture.js`, and `get-matched.js` do not.

**Fix options:**
1. **Preferred:** Add a dataLayer push inside `captureWithExperiment` itself (universal fix).
2. **Alternative:** Patch each call-site to also call `pushLandingDataLayer` or `pushConversionDataLayer`.

---

### Issue 3: Registration CTA Non-Conversion Events = PostHog Only (🟡)

**Location:** `lib/registrationCTAAnalytics.js`

```js
function captureEvent(event, properties = {}, { asConversion = false } = {}) {
  posthog.capture(event, merged);        // always
  if (asConversion) {
    pushConversionDataLayer({ event, ...merged }); // only on conversion
  }
}
```

**Problem:** Micro-conversion events (`share_results_cta_shown`, `save_results_cta_clicked`, `chat_email_capture_focused`, etc.) only go to PostHog. GA4 cannot build a registration CTA funnel.

**Events affected (8):**
- `share_results_cta_shown`
- `share_results_cta_expanded`
- `share_results_form_focused`
- `share_results_form_typing_started`
- `share_results_failed`
- `save_results_cta_shown`
- `save_results_cta_clicked`
- `chat_email_capture_shown`
- `chat_email_capture_focused`
- `chat_email_capture_typing_started`

**Fix:** Add `pushLandingDataLayer({ event, ...merged })` in all branches, not just conversion.

---

### Issue 4: `botPlayerAnalytics.js` Title Case Event (🟠)

**Location:** `lib/botPlayerAnalytics.js` line ~102

```js
captureLandingEvent("Start Typebot Conversation", {
  ...baseProps(),
  funnel_stage: "chat_started",
  ...
})
```

**Problem:** This event uses Title Case with spaces (`Start Typebot Conversation`) instead of snake_case. It goes to both PostHog and dataLayer because it uses `captureLandingEvent`, but it breaks the snake_case convention used by every other event. GTM triggers and GA4 event reporting become inconsistent.

**Fix:** Rename to `typebot_conversation_started` in both PostHog and GA4.

---

## 3. Safe / Synced Event Families

These event families are correctly wired to both PostHog and GA4 with matching names:

- ✅ **Auth events** (`authAnalytics.js`)
- ✅ **Chat / typebot events** (`chatAnalytics.js`)
- ✅ **Intake events** (`intakeAnalytics.js`)
- ✅ **Shortlist / compare events** (`shortlistAnalytics.js`)
- ✅ **Action goals** (`actionGoalTracking.js`)
- ✅ **Landing events** (`landingAnalytics.js` + `captureLandingEvent`)

---

## 4. Recommended Fixes (Priority Order)

### P0 — Fix `captureNextdoorEvent` / `captureAIEvent` underscore replacement
**File:** `lib/posthogClient.js`
**Change:** Remove `.replace(/_/g, " ")` on lines 228 and 270.
**Risk:** Low. Any GTM triggers already configured for spaced names would need updating, but it's unlikely any exist since no spaced-name triggers would have been created knowingly.

### P1 — Universalize `captureWithExperiment` to also push to dataLayer
**File:** `lib/posthogClient.js`
**Change:** Add `pushLandingDataLayer({ event, ...properties })` inside `captureWithExperiment`.
**Risk:** Low. May create duplicate dataLayer events for files that already push separately (`intakeAnalytics.js`, `landingAnalytics.js`). Verify those files won't double-push.

### P1 — Fix `registrationCTAAnalytics.js` to always push to dataLayer
**File:** `lib/registrationCTAAnalytics.js`
**Change:** Add `pushLandingDataLayer({ event, ...merged })` in the non-conversion branch.
**Risk:** Low.

### P2 — Rename Title Case event in `botPlayerAnalytics.js`
**File:** `lib/botPlayerAnalytics.js`
**Change:** `"Start Typebot Conversation"` → `"typebot_conversation_started"`
**Risk:** Low. Update any PostHog dashboards / GTM triggers that reference the old name.

### P2 — Audit orphaned PostHog-only events
These events may be intentionally PostHog-only (performance/engagement, not conversion), but should be reviewed:
- `wizard_ai_responded`
- `chat_stream_first_token_ms`
- `wizard_facilities_shown`
- `wizard_path_variant_shown`
- `retargeting_eligible`
- `hero_variant_shown`

If any are needed for GA4 conversion modeling or paid-media attribution, add `pushLandingDataLayer` calls.

---

## 5. Appendix: PostHog Dashboards Using These Events

From PostHog MCP audit:

| Dashboard | ID | Relevant Events |
|---|---|---|
| 🎯 Wizard Funnel Optimization | 1796607 | `wizard_started`, `wizard_step_entry`, `wizard_dropped_off`, `wizard_completed` |
| AI chat CPA & conversion tracking | 1465164 | `typebot_started`, `typebot_question_answered`, `typebot_completed`, `lead_submitted` |
| Conversion & UX monitoring | 1412066 | `action_goal`, `generate_lead` |
| Paid Campaign Readiness | 1973792 | `generate_lead`, `lead_submitted` |
| 🌐 Core web metrics | 1797672 | `$pageview`, `$web_vitals` |
| Save & Continue feature health | 1817433 | `wizard_save_success`, `wizard_save_started` |

---

*Audit compiled from: `lib/posthogClient.js`, `lib/gtag.js`, `lib/authAnalytics.js`, `lib/chatAnalytics.js`, `lib/intakeAnalytics.js`, `lib/registrationCTAAnalytics.js`, `lib/shortlistAnalytics.js`, `lib/actionGoalTracking.js`, `lib/botPlayerAnalytics.js`, `lib/landingAnalytics.js`, `lib/conversionDataLayer.js`, `lib/privacyAnalytics.js`, `components/AssistedlyWizard.js`, `pages/get-matched.js`, `pages/index.js`, `pages/index-video.js`, `components/ConsumerLeadCapture.js`, `components/FacilityDeepDive.js`, `components/PostHogAppViewTracker.jsx`, `lib/wizardBudgetScenariosExperiment.js`, `lib/retargetingTracker.js`*
