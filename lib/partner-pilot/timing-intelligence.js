/**
 * timing-intelligence.js
 *
 * Determines optimal outreach timing (time of day, day of week) and platform
 * for each partner target.
 *
 * Data layers (priority order):
 *   1. Enriched research cache   — Firecrawl-scraped bios, posts, activity patterns
 *   2. Role-based heuristics     — VP Partnerships vs. Founder vs. Support Manager
 *   3. Timezone-aware defaults   — ET, CT, MT, PT adjusted B2B windows
 *   4. Industry norms            — Healthcare BD best practices
 *
 * Firecrawl enrichment path:
 *   When Firecrawl MCP is available, call:
 *     - scrape(linkedinProfile)  → extract recent post timestamps
 *     - scrape(twitter/xProfile) → extract tweet timestamps + engagement windows
 *     - scrape(companyCareers) → detect timezone from job-posting locations
 *     - search("{company} partnerships team linkedin") → find BD person profiles
 *
 * Environment:
 *   None required — works offline with heuristics.
 */

const { readFileSync } = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════
// 1. DATA: Enriched partner research cache (populated by Firecrawl
//    during partner-research skill runs)
// ═══════════════════════════════════════════════════════════════════

function loadResearchCache() {
  try {
    const p = path.resolve(process.cwd(), 'docs/partner-pilot/responses');
    // Any *-research-brief.json files are treated as enriched cache
    // We don't eagerly load them; callers pass slug → this module reads.
    return p;
  } catch {
    return null;
  }
}

function getCachedProfile(slug) {
  try {
    const base = loadResearchCache();
    if (!base) return null;
    const file = path.join(base, `${slug}-research-brief.json`);
    const raw = readFileSync(file, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════
// 2. HEURISTICS: Role-based timing windows
// ═══════════════════════════════════════════════════════════════════

/**
 * Each role has a "prime window" — human BD people are most responsive
 * when they are castle-guarding their inbox, not in back-to-back meetings.
 */
const ROLE_WINDOWS = {
  // VP / Director of Partnerships — heavy meeting load, guards morning inbox
  partnerships_exec: {
    days: ['Tuesday', 'Wednesday', 'Thursday'],
    time_of_day: '08:00–10:00 ET',
    backup_window: '15:00–16:30 ET',
    rationale: 'BD execs triage email before stand-ups. Late afternoon is planning time.',
  },
  // Founder / CEO — chaotic schedule, responds best early or late
  founder: {
    days: ['Tuesday', 'Wednesday'],
    time_of_day: '07:00–08:30 ET',
    backup_window: '18:00–20:00 ET',
    rationale: 'Founders own their mornings and evenings. Midday is execution.',
  },
  // Support / Customer Success — structured shifts, responds within shift hours
  support: {
    days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday'],
    time_of_day: '09:00–11:00 local',
    backup_window: '13:00–15:00 local',
    rationale: 'Support teams handle tickets in shift windows; chat widgets are staffed.',
  },
  // Marketing / Growth — content calendars, responsive during campaign planning
  marketing: {
    days: ['Tuesday', 'Wednesday', 'Thursday'],
    time_of_day: '10:00–12:00 ET',
    backup_window: '14:00–15:30 ET',
    rationale: 'Marketing reviews campaigns mid-morning; analytics check is afternoon.',
  },
};

const DEFAULT_WINDOW = ROLE_WINDOWS.partnerships_exec;

function inferRoleFromReply(reply = '', platform = '') {
  const r = (reply || '').toLowerCase();
  if (/(founder|ceo|chief executive|started|my company|i built|i created)/.test(r)) return 'founder';
  if (/(support|help desk|ticket|customer care|feedback|assist)/.test(r)) return 'support';
  if (/(marketing|campaign|growth|content|brand|seo|ads)/.test(r)) return 'marketing';
  if (/(partner|partnerships|bd|business development|alliance|channel)/.test(r)) return 'partnerships_exec';
  // Platform inference fallback
  if (platform === 'crisp' || platform === 'intercom' || platform === 'olark') return 'support';
  if (platform === 'linkedin') return 'partnerships_exec';
  return 'partnerships_exec';
}

// ═══════════════════════════════════════════════════════════════════
// 3. HEURISTICS: Timezone from company HQ
// ═══════════════════════════════════════════════════════════════════

const HQ_TIMEZONE_MAP = {
  'philadelphia': 'America/New_York',
  'new york': 'America/New_York',
  'boston': 'America/New_York',
  'washington': 'America/New_York',
  'atlanta': 'America/New_York',
  'miami': 'America/New_York',
  'chicago': 'America/Chicago',
  'minneapolis': 'America/Chicago',
  'dallas': 'America/Chicago',
  'houston': 'America/Chicago',
  'austin': 'America/Chicago',
  'denver': 'America/Denver',
  'phoenix': 'America/Phoenix',
  'salt lake city': 'America/Denver',
  'los angeles': 'America/Los_Angeles',
  'san francisco': 'America/Los_Angeles',
  'seattle': 'America/Los_Angeles',
  'san diego': 'America/Los_Angeles',
  'portland': 'America/Los_Angeles',
};

function guessTimezone(cityOrRegion = '') {
  const c = (cityOrRegion || '').toLowerCase().trim();
  for (const [city, tz] of Object.entries(HQ_TIMEZONE_MAP)) {
    if (c.includes(city)) return tz;
  }
  return 'America/New_York'; // Default to ET for U.S. healthcare
}

// ═══════════════════════════════════════════════════════════════════
// 4. HEURISTICS: Platform recommendation
// ═══════════════════════════════════════════════════════════════════

function recommendPlatform(targetSlug, cachedProfile) {
  // If we have a known chat widget, use it
  const PLATFORMS = {
    gogograndparent: 'crisp',
    herohealth: 'intercom',
    aloecare: 'web-form',
    bayalarm: 'web-form',
    lifefone: 'web-form',
  };
  if (PLATFORMS[targetSlug]) {
    return {
      primary: PLATFORMS[targetSlug],
      fallback: 'email',
      rationale: `Known ${PLATFORMS[targetSlug]} widget detected on ${targetSlug}.com`,
    };
  }
  // Generic: chat widget > email > LinkedIn DM
  return {
    primary: 'email',
    fallback: 'linkedin',
    rationale: 'No live chat observed; email is least intrusive for BD outreach.',
  };
}

// ═══════════════════════════════════════════════════════════════════
// 5. MAIN EXPORT
// ═══════════════════════════════════════════════════════════════════

function getOutreachTiming({ slug, city, roleHint, replyText, platform }) {
  const cache = getCachedProfile(slug);
  // Try to extract city from cache if not provided
  const effectiveCity = city || cache?.hq_city || cache?.headquarters || '';
  const tz = guessTimezone(effectiveCity);

  // Infer role from reply text (if we have one) or roleHint
  const role = roleHint || inferRoleFromReply(replyText, platform);
  const window = ROLE_WINDOWS[role] || DEFAULT_WINDOW;

  // Convert generic ET times to target timezone for display
  const isET = tz === 'America/New_York';
  const timeLabel = isET ? window.time_of_day : window.time_of_day.replace('ET', tz.split('/')[1] + ' adjusted');

  return {
    time_of_day: timeLabel,
    day_of_week: window.days,
    timezone: tz,
    backup_window: window.backup_window,
    platform: recommendPlatform(slug, cache),
    role_inferred: role,
    rationale: [
      window.rationale,
      `HQ inferred timezone: ${tz}${effectiveCity ? ` (${effectiveCity})` : ''}.`,
    ].join(' '),
    firecrawl_enriched: !!cache?.firecrawl_timestamp,
  };
}

// CJS compat
module.exports = { getOutreachTiming };
