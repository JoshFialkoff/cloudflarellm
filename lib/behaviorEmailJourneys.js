/**
 * Behavior-Triggered Email Journeys (deep-link restoration)
 * Reuses existing patterns: PostHog (posthogClient), dripCampaign, consentStore,
 * sendAuthEmail/sendReviewRequest patterns, rateLimit, and idempotency via short-lived keys.
 *
 * Env flags (see .env.example additions):
 *   BEHAVIOR_EMAILS_ENABLED=true
 *   BEHAVIOR_EMAIL_LOOKBACK_HOURS=72
 *   BEHAVIOR_EMAIL_COOLDOWN_DAYS=14
 *   BEHAVIOR_EMAIL_MAX_PER_USER=3
 */

import { PostHog } from 'posthog-node';
import { consentStore } from './consentStore.js';
import { rateLimit } from './rateLimit.js';
import { dripCampaign } from './dripCampaign.js'; // reuse queue pattern if present
import { sendAuthEmail } from './sendAuthEmail.js'; // reuse email transport + templating

const PH = new PostHog(process.env.POSTHOG_API_KEY, {
  host: process.env.POSTHOG_HOST || 'https://us.posthog.com',
});

const ENABLED = process.env.BEHAVIOR_EMAILS_ENABLED === 'true';
const LOOKBACK_H = parseInt(process.env.BEHAVIOR_EMAIL_LOOKBACK_HOURS || '72', 10);
const COOLDOWN_D = parseInt(process.env.BEHAVIOR_EMAIL_COOLDOWN_DAYS || '14', 10);
const MAX_PER_USER = parseInt(process.env.BEHAVIOR_EMAIL_MAX_PER_USER || '3', 10);

// Idempotency store (simple in-memory for MVP; swap for Redis/DB in prod)
const sentJourneyKeys = new Set();

function makeJourneyKey(userId, journey, step) {
  return `${userId}:${journey}:${step}:${Math.floor(Date.now() / (1000 * 3600 * 24))}`;
}

function hasConsent(email) {
  return consentStore.hasMarketingConsent?.(email) ?? true; // fall back to existing guard
}

async function canSend(userId, email) {
  if (!ENABLED) return false;
  if (!hasConsent(email)) return false;
  if (await rateLimit.isRateLimited(`behavior:${userId}`, MAX_PER_USER, COOLDOWN_D * 86400)) return false;
  return true;
}

function buildDeepLink(path, params = {}) {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://assistedly.ai');
  url.pathname = path;
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  // Include restore token or step context for deep resumption
  return url.toString();
}

async function sendJourneyEmail({ to, subject, html, userId, journey, step }) {
  const key = makeJourneyKey(userId, journey, step);
  if (sentJourneyKeys.has(key)) return { skipped: 'duplicate' };
  const res = await sendAuthEmail({ to, subject, html }); // reuse existing sender
  if (res?.ok) sentJourneyKeys.add(key);
  return res;
}

/* ---------------- Journey 1: Abandoned Wizard ---------------- */
export async function runAbandonedWizardJourney() {
  if (!ENABLED) return;
  // Query PostHog for "wizard_started" without "wizard_completed" in window
  const events = await PH.query({
    kind: 'Events',
    select: ['uuid', 'distinct_id', 'properties', 'timestamp'],
    where: [
      { event: 'wizard_started' },
      { event: 'wizard_completed', operator: 'is_not_set' },
    ],
    date_from: `-${LOOKBACK_H}h`,
  });

  for (const ev of events.results || []) {
    const userId = ev.distinct_id;
    const email = ev.properties?.$email || ev.properties?.email;
    if (!email || !(await canSend(userId, email))) continue;

    const lastStep = ev.properties?.lastStep || 'start';
    const link = buildDeepLink('/wizard', { restore: lastStep, utm_source: 'email', utm_campaign: 'abandoned_wizard' });

    await sendJourneyEmail({
      to: email,
      subject: 'Finish finding your best match – resume in one click',
      html: `<p>Hi there,</p><p>You started your assisted living search but didn’t finish. Tap below to pick up exactly where you left off:</p><p><a href="${link}">Resume wizard</a></p>`,
      userId,
      journey: 'abandoned_wizard',
      step: lastStep,
    });
  }
}

/* ---------------- Journey 2: Shortlist without Intro ---------------- */
export async function runShortlistNoContactJourney() {
  if (!ENABLED) return;
  const events = await PH.query({
    kind: 'Events',
    select: ['distinct_id', 'properties', 'timestamp'],
    where: [
      { event: 'shortlist_add' },
      { event: 'partner_intro_requested', operator: 'is_not_set' },
      { event: 'get_matched', operator: 'is_not_set' },
    ],
    date_from: `-${LOOKBACK_H}h`,
  });

  for (const ev of events.results || []) {
    const userId = ev.distinct_id;
    const email = ev.properties?.$email;
    if (!email || !(await canSend(userId, email))) continue;

    const link = buildDeepLink('/shortlist', { action: 'get-matched', utm_source: 'email', utm_campaign: 'shortlist_nudge' });
    await sendJourneyEmail({
      to: email,
      subject: 'Ready to connect with your shortlisted homes?',
      html: `<p>Your shortlist is waiting. One click starts the matching process:</p><p><a href="${link}">Get matched now</a></p>`,
      userId,
      journey: 'shortlist_no_contact',
      step: 'shortlist',
    });
  }
}

/* ---------------- Journey 3: Facility Detail without Action ---------------- */
export async function runFacilityDetailNoActionJourney() {
  if (!ENABLED) return;
  const events = await PH.query({
    kind: 'Events',
    select: ['distinct_id', 'properties', 'timestamp'],
    where: [
      { event: 'facility_detail_view' },
      { event: 'get_matched', operator: 'is_not_set' },
      { event: 'lead_submit', operator: 'is_not_set' },
    ],
    date_from: `-${LOOKBACK_H}h`,
  });

  for (const ev of events.results || []) {
    const userId = ev.distinct_id;
    const email = ev.properties?.$email;
    const facilitySlug = ev.properties?.facilitySlug || 'explore';
    if (!email || !(await canSend(userId, email))) continue;

    const link = buildDeepLink(`/massachusetts/${facilitySlug}`, { cta: 'intro', utm_source: 'email', utm_campaign: 'facility_followup' });
    await sendJourneyEmail({
      to: email,
      subject: `Questions about ${facilitySlug.replace(/-/g, ' ')}? Let’s get you answers`,
      html: `<p>You viewed details on a facility. Ready for an introduction or more options?</p><p><a href="${link}">Request intro</a></p>`,
      userId,
      journey: 'facility_detail_no_action',
      step: facilitySlug,
    });
  }
}

// Scheduler entry point (can be called from existing cron or queue worker)
export async function runAllBehaviorJourneys() {
  await Promise.allSettled([
    runAbandonedWizardJourney(),
    runShortlistNoContactJourney(),
    runFacilityDetailNoActionJourney(),
  ]);
}
