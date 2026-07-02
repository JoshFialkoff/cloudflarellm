/**
 * Analytics events for the guided intake funnel.
 *
 * All events push to window.dataLayer (GTM) and are non-blocking.
 */

function push(event) {
  if (typeof window === 'undefined') return
  try {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push(event)
  } catch {
    // ignore
  }
}

/** User opened the intake flow for the first time. */
export function trackIntakeStart() {
  push({ event: 'intake_start', funnel_stage: 'intake' })
}

/** User completed one step of the intake flow. */
export function trackIntakeStepComplete(stepName, value) {
  push({
    event: 'intake_step_complete',
    funnel_stage: 'intake',
    intake_step: stepName,
    intake_value: Array.isArray(value) ? value.join(',') : String(value ?? ''),
  })
}

/** User completed the entire intake flow. */
export function trackIntakeComplete(answers) {
  push({
    event: 'intake_complete',
    funnel_stage: 'intake',
    care_needs: answers.care_needs || '',
    budget: answers.budget || '',
    location: answers.location || '',
    timing: answers.timing || '',
    priorities: Array.isArray(answers.priorities) ? answers.priorities.join(',') : '',
  })
}

/** User clicked a matched facility result. */
export function trackMatchedResultClick(facilitySlug, rank, score) {
  push({
    event: 'matched_result_click',
    funnel_stage: 'matched_results',
    facility_slug: facilitySlug,
    match_rank: rank,
    match_score: score,
  })
}

/** User submitted an inquiry from the matched flow. */
export function trackInquiryFromMatchedFlow(facilitySlug, rank) {
  push({
    event: 'inquiry_from_matched_flow',
    funnel_stage: 'matched_results',
    facility_slug: facilitySlug,
    match_rank: rank,
  })
}
