/**
 * Analytics events for the guided intake funnel.
 *
 * All events push to window.dataLayer (GTM) and are non-blocking.
 * ADDITIVE: also pushes to PostHog when available, enabling NextDoor funnels.
 */

import { captureWithExperiment } from './posthogClient'
import { getNextdoorAttributionProperties, getSessionMarketingAttribution } from './marketingAttribution'

function push(event) {
  if (typeof window === 'undefined') return
  try {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push(event)
  } catch {
    // ignore
  }
}

function captureIfPosthog(eventName, props) {
  try {
    captureWithExperiment(eventName, props)
  } catch {
    /* silent — never block UX for analytics */
  }
}

/** User opened the intake flow for the first time. */
export function trackIntakeStart() {
  const props = { funnel_stage: 'intake' }
  push({ event: 'intake_start', ...props })
  captureIfPosthog('intake_start', props)
}

/** User completed one step of the intake flow. */
export function trackIntakeStepComplete(stepName, value) {
  const props = {
    funnel_stage: 'intake',
    intake_step: stepName,
    intake_value: Array.isArray(value) ? value.join(',') : String(value ?? ''),
  }
  push({ event: 'intake_step_complete', ...props })
  captureIfPosthog('intake_step_complete', props)
}

/** User completed the entire intake flow. */
export function trackIntakeComplete(answers) {
  const props = {
    funnel_stage: 'intake',
    care_needs: answers.care_needs || '',
    budget: answers.budget || '',
    location: answers.location || '',
    timing: answers.timing || '',
    priorities: Array.isArray(answers.priorities) ? answers.priorities.join(',') : '',
    conversion: true,
  }
  push({ event: 'intake_complete', ...props })
  captureIfPosthog('intake_complete', props)

  // NextDoor-specific intake-complete event (so NextDoor funnels can be isolated)
  try {
    const nd = getNextdoorAttributionProperties()
    if (nd.is_nextdoor_traffic) {
      captureIfPosthog('nextdoor_intake_complete', { ...props, ...nd })
    }
  } catch {
    /* silent */
  }

  // Standard Nextdoor Universal Pixel: intake completion = Lead
  try {
    import('./nextdoorUniversalPixel').then(({ trackNextdoorLead }) => {
      trackNextdoorLead({
        lead_source: 'intake_complete',
        care_needs: answers.care_needs || '',
        location: answers.location || '',
      })
    })
  } catch {
    /* silent */
  }
}

/** User clicked a matched facility result. */
export function trackMatchedResultClick(facilitySlug, rank, score) {
  const props = {
    funnel_stage: 'matched_results',
    facility_slug: facilitySlug,
    match_rank: rank,
    match_score: score,
  }
  push({ event: 'matched_result_click', ...props })
  captureIfPosthog('matched_result_click', props)
}

/** User submitted an inquiry from the matched flow. */
export function trackInquiryFromMatchedFlow(facilitySlug, rank) {
  const props = {
    funnel_stage: 'matched_results',
    facility_slug: facilitySlug,
    match_rank: rank,
    conversion: true,
  }
  push({ event: 'inquiry_from_matched_flow', ...props })
  captureIfPosthog('inquiry_from_matched_flow', props)
}
