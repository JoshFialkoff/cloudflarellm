const { saveResultSnapshot } = require('../../../lib/authResultStore');
const { sanitizeResultSnapshot } = require('../../../lib/resultSnapshot');
const { checkRateLimit } = require('../../../lib/rateLimit');
const { recordConsent } = require('../../../lib/consentStore');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/wizard/save-progress
 *
 * Saves wizard progress for later restoration.
 *
 * Body:
 *   - email (required) – user's email for magic link
 *   - wizardState (required) – current wizard fields
 *   - authSurface (optional) – defaults to 'homepage_wizard_save'
 *
 * Response:
 *   - ok: true
 *   - snapshotId: string – ID for later retrieval
 *   - magicLink: string (dev only) – clickable link if email not configured
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Valid email required' });
  }

  const wizardState = req.body?.wizardState;
  if (!wizardState || typeof wizardState !== 'object') {
    return res.status(400).json({ error: 'Wizard state required' });
  }

  // Rate limit: max 5 saves per email per hour
  const rateCheck = checkRateLimit(`wizard-save:${email}`, { maxRequests: 5, windowMs: 60 * 60 * 1000 });
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: 'Too many saves. Please wait before saving again.',
      retryAfterMs: rateCheck.retryAfterMs,
    });
  }

  const authSurface = String(req.body?.authSurface || '').trim() || 'homepage_wizard_save';

  // Build snapshot compatible with resultSnapshot schema
  const snapshot = {
    kind: 'wizard_save',
    version: 1,
    createdAt: new Date().toISOString(),
    title: `Wizard progress — ${wizardState.urgency || 'no urgency'}`,
    inputs: {
      urgency: wizardState.urgency || '',
      monthlyBudget: wizardState.monthly_budget ?? null,
      zip: wizardState.zip_code || '',
      careType: wizardState.care_type || '',
      location: wizardState.dify_location || '',
      scenarioSelected: wizardState.scenario_selected || '',
      step: wizardState.step || '',
    },
    results: {},
  };

  const sanitized = sanitizeResultSnapshot(snapshot);
  const snapshotId = sanitized ? saveResultSnapshot(email, sanitized) : null;

  if (!snapshotId) {
    return res.status(500).json({ error: 'Could not save wizard progress' });
  }

  // Record consent for saving progress
  recordConsent(email, {
    authSurface,
    hasWizardState: true,
    snapshotId,
    ip: req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '',
    userAgent: req.headers['user-agent'] || '',
  });

  return res.status(200).json({
    ok: true,
    snapshotId,
  });
}
