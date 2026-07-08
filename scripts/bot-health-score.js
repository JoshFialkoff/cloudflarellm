#!/usr/bin/env node
// Bot Health Score — real PostHog query script
// Requires POSTHOG_PERSONAL_API_KEY + POSTHOG_PROJECT_ID in .env.local
// Usage: node --env-file=.env.local scripts/bot-health-score.js [YYYY-MM-DD]

const { execFileSync } = require('node:child_process');

// Pull a secret from the macOS Keychain (fallback when not in env/.env.local)
function keychain(service) {
  try {
    return execFileSync('security', ['find-generic-password', '-s', service, '-w'], {
      encoding: 'utf8',
    }).trim();
  } catch {
    return undefined;
  }
}

const POSTHOG_KEY = process.env.POSTHOG_PERSONAL_API_KEY || keychain('POSTHOG_PERSONAL_API_KEY');
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID || keychain('POSTHOG_PROJECT_ID');
const PH_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.posthog.com';
const PH_CAPTURE_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || keychain('NEXT_PUBLIC_POSTHOG_KEY');

async function captureBotHealthAlert(properties) {
  if (!PH_CAPTURE_KEY) {
    console.warn('NEXT_PUBLIC_POSTHOG_KEY not found — cannot capture bot_health_alert to PostHog');
    return;
  }

  try {
    await fetch(`${PH_HOST}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: PH_CAPTURE_KEY,
        event: 'bot_health_alert',
        properties,
        timestamp: new Date().toISOString(),
        distinct_id: 'bot-health-monitor',
      }),
    });
  } catch (err) {
    console.error('Failed to capture bot_health_alert:', err.message);
  }
}

if (!POSTHOG_KEY || !PROJECT_ID) {
  console.error('Missing POSTHOG_PERSONAL_API_KEY or POSTHOG_PROJECT_ID (checked env, .env.local, and macOS Keychain)');
  process.exit(1);
}

const targetDate = process.argv[2] || (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
})();

async function posthogQuery(query) {
  const res = await fetch(`${PH_HOST}/api/projects/${PROJECT_ID}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${POSTHOG_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) throw new Error(`PostHog API ${res.status}: ${await res.text()}`);
  return res.json();
}

async function getEventCount(event, date) {
  const result = await posthogQuery({
    kind: 'HogQLQuery',
    query: `SELECT count() AS c FROM events WHERE event = '${event}' AND toDate(timestamp) = '${date}'`,
  });
  return Number(result?.results?.[0]?.[0] ?? 0);
}

async function getUniqueSessions(events, date) {
  const list = Array.isArray(events) ? events.map(e => `'${e}'`).join(',') : `'${events}'`;
  const result = await posthogQuery({
    kind: 'HogQLQuery',
    query: `SELECT count(DISTINCT distinct_id) AS c FROM events WHERE event IN (${list}) AND toDate(timestamp) = '${date}'`,
  });
  return Number(result?.results?.[0]?.[0] ?? 0);
}

async function getAvgSteps(date) {
  const result = await posthogQuery({
    kind: 'HogQLQuery',
    query: `SELECT avg(toFloat(properties.percent_complete)) AS avg_pct FROM events WHERE event = 'wizard_step_entry' AND toDate(timestamp) = '${date}' AND JSONLength(properties) > 0`,
  });
  const avgPct = Number(result?.results?.[0]?.[0] ?? 0);
  return (avgPct / 100) || 0; // normalize 0–1
}

async function main() {
  const dateStr = targetDate;

  // 1) Raw counts
  const [startedTyp, startedChat, engagedTyp, engagedWiz, completed, leads] = await Promise.all([
    getEventCount('typebot_started', dateStr),
    getEventCount('chat_started', dateStr),
    getEventCount('typebot_question_answered', dateStr),
    getEventCount('wizard_step_entry', dateStr),
    getEventCount('typebot_completed', dateStr),
    getEventCount('lead_submitted', dateStr),
  ]);

  // 2) Normalized session counts
  const startedSessions = await getUniqueSessions(['typebot_started', 'chat_started'], dateStr);
  const engagedSessions = await getUniqueSessions(['typebot_question_answered', 'wizard_step_entry'], dateStr);
  const completedSessions = completed; // typebot_completed
  const leadSessions = leads;

  // 3) Depth
  const depthScore = await getAvgSteps(dateStr);

  // 4) Rates
  const leadRate = startedSessions > 0 ? leadSessions / startedSessions : 0;
  const completionRate = startedSessions > 0 ? completedSessions / startedSessions : 0;
  const engagementRate = startedSessions > 0 ? engagedSessions / startedSessions : 0;

  // 5) Composite score
  const score =
    0.45 * leadRate +
    0.30 * completionRate +
    0.15 * engagementRate +
    0.10 * depthScore;

  const record = {
    date: dateStr,
    started_sessions: startedSessions,
    engaged_sessions: engagedSessions,
    completed_sessions: completedSessions,
    lead_sessions: leadSessions,
    depth_score: depthScore,
    effectiveness_score: score,
  };

  console.log(JSON.stringify(record, null, 2));

  // Fire a bot_health_alert to PostHog when the effectiveness score
  // drops below the alert threshold (or when there is zero traffic).
  const ALERT_THRESHOLD = Number(process.env.BOT_HEALTH_ALERT_THRESHOLD || '0.2');
  const anomalyType =
    startedSessions === 0 ? 'no_traffic' : score < ALERT_THRESHOLD ? 'low_effectiveness' : null;

  if (anomalyType) {
    await captureBotHealthAlert({
      date: dateStr,
      score,
      threshold: ALERT_THRESHOLD,
      anomalyType,
      started_sessions: startedSessions,
      lead_sessions: leadSessions,
      completed_sessions: completedSessions,
    });
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
