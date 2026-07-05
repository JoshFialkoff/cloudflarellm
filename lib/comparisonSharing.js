/**
 * comparisonSharing — Build email/SMS content for sharing a comparison report.
 *
 * Exports:
 *   buildShareableLink(slugs)        → absolute URL
 *   buildComparisonEmailContent(...)  → { subject, html, text }
 *   buildComparisonSmsText(...)       → plain text string
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://assistedly.ai';

/**
 * Build the public comparison URL from facility slugs.
 */
export function buildShareableLink(slugs) {
  if (!Array.isArray(slugs) || slugs.length < 2) return '';
  return `${BASE_URL}/compare?facilities=${slugs.join(',')}`;
}

/**
 * Format a monthly price range consistently.
 */
function formatPriceRange(min, max) {
  const fmt = (n) => '$' + Number(n).toLocaleString('en-US');
  return `${fmt(min)}–${fmt(max)}/mo`;
}

/**
 * Build a full comparison summary table for the email body.
 */
function buildEmailComparisonTable(facilities) {
  if (!facilities || facilities.length === 0) return '';

  const rows = [
    { label: 'Monthly Cost', values: facilities.map(f => formatPriceRange(f.monthlyMin, f.monthlyMax)) },
    { label: 'Rating', values: facilities.map(f => (f.rating ? `⭐ ${f.rating}/5` : '—')) },
    { label: 'Care Types', values: facilities.map(f => f.careTypes?.join(', ') || '—') },
    { label: 'Compliance', values: facilities.map(f => f.complianceRating || '—') },
    { label: 'Capacity', values: facilities.map(f => (f.capacity ? `${f.capacity} residents` : '—')) },
  ];

  let html = '<table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px;">';
  html += '<thead><tr style="background:#4a7c7e;color:#fff;">';
  html += '<th style="padding:10px 12px;text-align:left;border:1px solid #ddd;">Feature</th>';
  facilities.forEach(f => {
    html += `<th style="padding:10px 12px;text-align:left;border:1px solid #ddd;">${escapeHtml(f.name)}</th>`;
  });
  html += '</tr></thead><tbody>';

  rows.forEach(row => {
    html += '<tr>';
    html += `<td style="padding:10px 12px;border:1px solid #ddd;font-weight:600;background:#f9f6f2;">${escapeHtml(row.label)}</td>`;
    row.values.forEach(v => {
      html += `<td style="padding:10px 12px;border:1px solid #ddd;">${escapeHtml(v)}</td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table>';
  return html;
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build the full email payload for a shared comparison.
 * Uses the assistedly.ai brand styling from the saved email templates.
 */
export function buildComparisonEmailContent({ senderName, recipientEmail, facilities, message, comparisonUrl }) {
  const facilityNames = facilities.map(f => f.name).join(' vs ');
  const tableHtml = buildEmailComparisonTable(facilities);

  const subject = `${senderName || 'Someone'} shared an assisted living comparison with you`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#f9f6f2; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
    table { border-collapse:collapse; }
    @media only screen and (max-width:600px) {
      .container { width:100% !important; }
      td[class="cell"] { display:block !important; width:100% !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#f9f6f2;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9f6f2;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table class="container" role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="padding:32px 32px 16px;text-align:center;background:#071e18;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="vertical-align:middle;">
                    <svg width="40" height="40" viewBox="0 0 100 100" style="display:block;margin:0 auto 8px;">
                      <circle cx="50" cy="50" r="48" fill="#ffffff" stroke="#c4956a" stroke-width="4"/>
                      <path d="M50 85 C25 60 15 45 15 35 C15 22 28 15 40 22 L50 30 L60 22 C72 15 85 22 85 35 C85 45 75 60 50 85Z" fill="#4a7c7e"/>
                    </svg>
                  </td>
                </tr>
              </table>
              <h1 style="color:#ffffff;font-size:22px;margin:8px 0 4px;font-weight:800;">Assistedly.ai</h1>
              <p style="color:#c4956a;font-size:13px;margin:0;">Unbiased AI Finds Best Assisted Living in Massachusetts</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 32px;">
              <h2 style="color:#6d1247;font-size:20px;margin:0 0 8px;">Assisted Living Comparison</h2>
              <p style="color:#333333;font-size:15px;line-height:1.5;margin:0 0 16px;">
                ${escapeHtml(senderName || 'A family member or friend')} shared an assisted living facility comparison with you.
              </p>

              ${message ? `<p style="color:#666666;font-size:14px;line-height:1.5;font-style:italic;margin:0 0 16px;padding:12px 16px;background:#f9f6f2;border-radius:12px;border-left:3px solid #c4956a;">"${escapeHtml(message)}"</p>` : ''}

              <p style="color:#333333;font-size:14px;font-weight:600;margin:0 0 8px;">${escapeHtml(facilityNames)}</p>

              ${tableHtml}

              <p style="color:#666666;font-size:13px;line-height:1.5;margin:12px 0 0;">
                This comparison was built using Assistedly.ai — an unbiased AI tool that helps Massachusetts families find the best assisted living options.
              </p>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 32px 24px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:12px;background:#4a7c7e;padding:12px 32px;text-align:center;">
                    <a href="${escapeHtml(comparisonUrl)}" style="color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;display:block;">
                      View Full Comparison →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Stats -->
          <tr>
            <td style="padding:20px 32px;background:#4a7c7e;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 12px;">
                    <span style="color:#c4956a;font-size:20px;font-weight:800;">${facilities.length}</span>
                    <br><span style="color:#ffffff;font-size:12px;">Facilities Compared</span>
                  </td>
                  <td align="center" style="padding:8px 12px;">
                    <span style="color:#c4956a;font-size:20px;font-weight:800;">🔍</span>
                    <br><span style="color:#ffffff;font-size:12px;">AI-Powered Analysis</span>
                  </td>
                  <td align="center" style="padding:8px 12px;">
                    <span style="color:#c4956a;font-size:20px;font-weight:800;">💝</span>
                    <br><span style="color:#ffffff;font-size:12px;">Family-Focused</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 32px;background:#071e18;text-align:center;">
              <svg width="24" height="24" viewBox="0 0 100 100" style="display:inline-block;vertical-align:middle;">
                <path d="M50 85 C25 60 15 45 15 35 C15 22 28 15 40 22 L50 30 L60 22 C72 15 85 22 85 35 C85 45 75 60 50 85Z" fill="#4a7c7e"/>
              </svg>
              <span style="color:#ffffff;font-size:13px;font-weight:600;vertical-align:middle;margin-left:6px;">Assistedly.ai</span>
              <p style="color:#666666;font-size:11px;margin:8px 0 0;line-height:1.4;">
                Assistedly.ai does not provide medical advice, diagnosis, or treatment.<br>
                Always verify facility information directly before making decisions.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    `${senderName || 'Someone'} shared an assisted living comparison with you on Assistedly.ai.`,
    '',
    `Facilities compared: ${facilityNames}`,
    '',
    ...(message ? [`"${message}"`, ''] : []),
    ...facilities.map(f => `- ${f.name}: ${formatPriceRange(f.monthlyMin, f.monthlyMax)} | Rating: ${f.rating ? `${f.rating}/5` : 'N/A'} | ${f.careTypes?.join(', ') || ''}`),
    '',
    `View the full comparison: ${comparisonUrl}`,
    '',
    '— Assistedly.ai',
    'Unbiased AI Finds Best Assisted Living in Massachusetts',
  ].join('\n');

  return { subject, html, text };
}

/**
 * Build SMS text for sharing a comparison.
 */
export function buildComparisonSmsContent({ senderName, facilities, comparisonUrl }) {
  const names = facilities.map(f => f.name).join(', ');
  const lines = [
    `${senderName || 'Someone'} shared assisted living options with you on Assistedly.ai:`,
    '',
    names,
    '',
    ...facilities.map(f => `${f.name}: ${formatPriceRange(f.monthlyMin, f.monthlyMax)} — ${f.rating ? `⭐${f.rating}` : ''}`),
    '',
    `Compare them here: ${comparisonUrl}`,
  ];
  return lines.join('\n');
}
