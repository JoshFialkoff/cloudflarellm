#!/usr/bin/env node
/**
 * Event Taxonomy Guard
 *
 * Ensures every posthog.capture() and dataLayer.push({event}) uses
 * a canonical name defined in docs/event-taxonomy.md.
 */

import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const errors = []
function fail(msg) { errors.push(msg) }

// ─── Canonical event names from docs/event-taxonomy.md ───────────
const POSTHOG_EVENTS = new Set([
  'intake_started','intake_step_complete','intake_completed','intake_abandoned',
  'search_executed','facility_viewed','compare_initiated','filter_applied',
  'location_changed','score_tab_switched','radius_changed',
  'auth_prompt_shown','auth_prompt_completed','auth_prompt_dismissed',
  'chat_message_sent','chat_response_received','chat_source_clicked',
  'partner_landing_viewed','partner_referral_submitted',
  'partner_landing_click','partner_consent_given','partner_consent_denied',
  'partner_assessment_start','partner_assessment_step_complete','partner_assessment_completed',
  'partner_snapshot_viewed','partner_facility_search',
  // Legacy wizard events — deprecate gradually
  'wizard_started','wizard_step_entry','wizard_completed','wizard_dropped_off',
  'wizard_ai_responded','wizard_facilities_shown','chat_stream_first_token_ms',
  // Retargeting / experiments
  'retargeting_eligible','wizard_path_variant_shown',
  // Typebot
  'typebot_completed','typebot_question_answered',
  // GA4-named events also used in PostHog
  'generate_lead','sign_up','search','view_item','select_content','page_view',
  '$pageview','$identify','$set',
])

const GA4_EVENTS = new Set([
  'generate_lead','sign_up','search','view_item','select_content','page_view',
])

// ─── Helpers ─────────────────────────────────────────────────────
function walk(dir, extSet) {
  const out = []
  const files = readdirSync(dir)
  for (const f of files) {
    const full = join(dir, f)
    const s = statSync(full)
    if (s.isDirectory() && f !== 'node_modules' && !f.startsWith('.')) {
      out.push(...walk(full, extSet))
    } else if (extSet.has(f.split('.').pop())) {
      out.push(full)
    }
  }
  return out
}

// ─── Scan ──────────────────────────────────────────────────────────
const files = walk('.', new Set(['js','jsx','ts','tsx','mjs','cjs']))

for (const file of files) {
  if (file.includes('node_modules')) continue
  if (file.includes('guard-event-taxonomy.mjs')) continue
  const src = readFileSync(file, 'utf8')

  // posthog.capture('unknown')
  const phRe = /posthog\.capture\(['"`]([^'"`]+)['"`]/g
  let m
  while ((m = phRe.exec(src)) !== null) {
    const name = m[1]
    if (!POSTHOG_EVENTS.has(name)) {
      fail(`${file}: posthog.capture('${name}') not in event taxonomy. Add to docs/event-taxonomy.md or correct the name.`)
    }
  }

  // dataLayer.push({ event: 'unknown' })
  const dlRe = /dataLayer\.push\([^)]*event\s*:\s*['"`]([^'"`]+)['"`]/g
  while ((m = dlRe.exec(src)) !== null) {
    const name = m[1]
    if (!GA4_EVENTS.has(name)) {
      fail(`${file}: dataLayer event '${name}' not in GA4 taxonomy. Add to docs/event-taxonomy.md or correct the name.`)
    }
  }
}

// ─── Report ────────────────────────────────────────────────────────
if (errors.length > 0) {
  console.error('\n❌ EVENT TAXONOMY GUARD FAILED')
  for (const e of errors) console.error('   ' + e)
  console.error('')
  process.exit(1)
}

console.log('✅ EVENT TAXONOMY GUARD PASSED')
