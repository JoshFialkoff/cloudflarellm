/**
 * POST /api/comparisons/share
 *
 * Share a comparison via email or SMS.
 * Captures sender info (for lead generation) and sends a formatted
 * comparison to the recipient.
 *
 * Body:
 *   facilitySlugs  string[]  — 2-4 facility slugs
 *   method         'email' | 'sms'
 *   senderName     string    — who's sharing
 *   senderEmail    string    — sender's email (for lead capture)
 *   recipientEmail string    — required for email method
 *   recipientPhone string    — required for sms method (E.164 format recommended)
 *   message        string    — optional personal message
 *
 * Env:
 *   RESEND_API_KEY                — Resend API key (email)
 *   TWILIO_ACCOUNT_SID            — Twilio Account SID (SMS)
 *   TWILIO_AUTH_TOKEN             — Twilio Auth Token (SMS)
 *   TWILIO_PHONE_NUMBER           — Twilio phone number to send from (SMS)
 *
 * Response:
 *   { ok: true, sent: true } or { error: "..." }
 */

import { MASSACHUSETTS_FACILITIES_BY_SLUG } from '../../../lib/massachusettsFacilities';
import {
  buildShareableLink,
  buildComparisonEmailContent,
  buildComparisonSmsContent,
} from '../../../lib/comparisonSharing';
import { getPosthogServer } from '../../../lib/posthogServer';

const MAX_COMPARE = 4;
const MIN_COMPARE = 2;

// ---------------------------------------------------------------------------
// Resend (email)
// ---------------------------------------------------------------------------

function getResendApiKey() {
  const key = process.env.RESEND_API_KEY;
  return typeof key === 'string' ? key.trim() : '';
}

async function sendEmail({ to, subject, html, text }) {
  const key = getResendApiKey();
  if (!key) {
    return { sent: false, reason: 'missing_resend_api_key' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM || 'Assistedly <hello@assistedly.ai>',
      to,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Email provider returned ${response.status}${body ? `: ${body}` : ''}`);
  }

  return { sent: true };
}

// ---------------------------------------------------------------------------
// Twilio (SMS)
// ---------------------------------------------------------------------------

function getTwilioCredentials() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  return { sid: sid?.trim(), token: token?.trim(), from: from?.trim() };
}

/**
 * Normalize a phone number to E.164 format (+1XXXXXXXXXX).
 * Accepts: (617) 555-0101, 6175550101, +16175550101, etc.
 */
function normalizePhone(raw) {
  if (!raw) return '';
  // Strip everything except digits and leading +
  const cleaned = String(raw).replace(/[^\d+]/g, '');
  // If it starts with +, use as-is (caller provided E.164)
  if (cleaned.startsWith('+')) return cleaned;
  // If it's 10 digits, assume US and prepend +1
  if (cleaned.length === 10) return `+1${cleaned}`;
  // If it's 11 digits and starts with 1, prepend +
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  // Otherwise return as-is (Twilio will error if invalid)
  return `+${cleaned}`;
}

/**
 * Send SMS via Twilio REST API directly (no SDK dependency needed at runtime).
 * Falls back gracefully if Twilio is not configured.
 */
async function sendSms({ to, body }) {
  const { sid, token, from } = getTwilioCredentials();

  if (!sid || !token || !from) {
    return { sent: false, reason: 'missing_twilio_credentials', smsBody: body };
  }

  const recipient = normalizePhone(to);
  if (!recipient) {
    return { sent: false, reason: 'invalid_phone_number', smsBody: body };
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');

  const params = new URLSearchParams();
  params.append('To', recipient);
  params.append('From', from);
  params.append('Body', body);

  const response = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.message || data.error_message || `Twilio returned ${response.status}`;
    throw new Error(errorMsg);
  }

  return { sent: true, messageSid: data.sid, status: data.status };
}

// ---------------------------------------------------------------------------
// Analytics helper
// ---------------------------------------------------------------------------

function captureServerEvent(event, properties = {}) {
  try {
    const ph = getPosthogServer();
    if (!ph) return;
    ph.capture({
      distinctId: 'comparison_sharing_server',
      event,
      properties,
    });
  } catch {
    // Non-blocking
  }
}

// ---------------------------------------------------------------------------
// Lead capture helper
// ---------------------------------------------------------------------------

async function captureLead(senderName, senderEmail, slugs, intent, leadMagnet) {
  if (!senderEmail || !senderEmail.includes('@')) return;
  try {
    await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'https://assistedly.ai'}/api/leads/consumer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: senderName,
        email: senderEmail,
        intent,
        leadMagnet,
        page: '/compare',
        facilities: slugs,
      }),
    }).catch(() => {});
  } catch {
    // non-blocking
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body || {};

    // Validate facility slugs
    const slugs = Array.isArray(body.facilitySlugs)
      ? body.facilitySlugs.slice(0, MAX_COMPARE).map(s => String(s || '').trim()).filter(Boolean)
      : [];

    if (slugs.length < MIN_COMPARE) {
      return res.status(400).json({ error: 'Select at least 2 facilities to compare.' });
    }

    const facilities = slugs
      .map(slug => MASSACHUSETTS_FACILITIES_BY_SLUG[slug])
      .filter(Boolean);

    if (facilities.length < MIN_COMPARE) {
      return res.status(400).json({ error: 'Could not find those facilities.' });
    }

    const method = body.method === 'sms' ? 'sms' : 'email';
    const senderName = String(body.senderName || 'A family member').trim().slice(0, 100);
    const senderEmail = String(body.senderEmail || '').trim().toLowerCase();
    const message = String(body.message || '').trim().slice(0, 500);
    const comparisonUrl = buildShareableLink(slugs);

    // ---- EMAIL ----
    if (method === 'email') {
      const recipientEmail = String(body.recipientEmail || '').trim().toLowerCase();
      if (!recipientEmail || !recipientEmail.includes('@')) {
        return res.status(400).json({ error: 'Please provide a valid recipient email address.' });
      }

      await captureLead(senderName, senderEmail, slugs, 'comparison_sharing', 'comparison-share');

      const { subject, html, text } = buildComparisonEmailContent({
        senderName,
        recipientEmail,
        facilities,
        message,
        comparisonUrl,
      });

      await sendEmail({ to: recipientEmail, subject, html, text });

      captureServerEvent('comparison_shared', {
        method: 'email',
        facility_count: facilities.length,
        facility_slugs: slugs.join(','),
      });

      return res.status(200).json({
        ok: true,
        sent: true,
        recipientEmail,
        method: 'email',
      });
    }

    // ---- SMS ----
    const smsText = buildComparisonSmsContent({
      senderName,
      facilities,
      comparisonUrl,
    });

    const recipientPhone = String(body.recipientPhone || '').trim();

    // If Twilio is configured and a phone number is provided, send via Twilio
    const twilio = getTwilioCredentials();
    const twilioConfigured = Boolean(twilio.sid && twilio.token && twilio.from);
    let smsResult = { sent: false };

    if (twilioConfigured && recipientPhone) {
      try {
        smsResult = await sendSms({ to: recipientPhone, body: smsText });
      } catch (err) {
        console.error('[comparisons/share] Twilio error:', err.message);
        // Fall back to returning the text for manual copy
        smsResult = { sent: false, reason: `twilio_error: ${err.message}`, smsBody: smsText };
      }
    } else {
      smsResult = { sent: false, reason: 'no_twilio_or_phone', smsBody: smsText };
    }

    await captureLead(senderName, senderEmail, slugs, 'comparison_sharing_sms', 'comparison-share-sms');

    captureServerEvent('comparison_shared', {
      method: 'sms',
      facility_count: facilities.length,
      facility_slugs: slugs.join(','),
      sent_via_twilio: smsResult.sent,
    });

    return res.status(200).json({
      ok: true,
      sent: smsResult.sent,
      smsText,
      smsSent: smsResult.sent,
      messageSid: smsResult.messageSid,
      recipientPhone: recipientPhone || undefined,
      method: 'sms',
      smsHint: smsResult.sent
        ? 'SMS sent successfully.'
        : 'Copy the text above to send via your messaging app.',
    });
  } catch (error) {
    console.error('[comparisons/share] Error:', error.message);
    return res.status(500).json({ error: error.message || 'Could not send comparison.' });
  }
}
