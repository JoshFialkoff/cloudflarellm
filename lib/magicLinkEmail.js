const { getCampaign } = require("./marketingContent");
const {
  cityFromZipCode,
  extractZip,
  locationZip,
  resolveLocationFromZip,
} = require("./zipLocation");

function cleanString(value, maxLength = 140) {
  return String(value || "").trim().slice(0, maxLength);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function titleCaseFacilityType(label) {
  const text = cleanString(label, 80) || "Assisted living";
  return text.replace(/\b([a-z])/g, (match) => match.toUpperCase());
}

function normalizeLocation(raw) {
  const text = cleanString(raw, 120);
  if (!text) return "";
  if (/,\s*MA\b/i.test(text)) return text;
  if (/^ZIP \d{5}/i.test(text)) return text;
  return `${text.replace(/,\s*$/, "")}, MA`;
}

function resolveMagicLinkEmailContext({ zip, facilityType, location, resultSnapshot } = {}) {
  let resolvedZip = extractZip(zip);
  let resolvedFacilityType = cleanString(facilityType, 80);
  let resolvedLocation = cleanString(location, 120);
  let locationFromRegion = false;

  if (resultSnapshot?.kind === "cost_calculator") {
    resolvedFacilityType = resolvedFacilityType || resultSnapshot.inputs?.careTypeLabel;
    if (!resolvedLocation) {
      resolvedLocation = resultSnapshot.inputs?.regionLabel || "";
      locationFromRegion = Boolean(resolvedLocation);
    }
  } else if (resultSnapshot?.kind === "safest_facilities") {
    const city = resultSnapshot.inputs?.city;
    if (!resolvedLocation && city && city !== "Massachusetts") {
      resolvedLocation = normalizeLocation(city);
    }
  } else if (resultSnapshot?.kind === "wizard_search") {
    resolvedFacilityType = resolvedFacilityType || resultSnapshot.inputs?.careTypeLabel;
    if (!resolvedZip) resolvedZip = extractZip(resultSnapshot.inputs?.zip);
    if (!resolvedLocation) resolvedLocation = cleanString(resultSnapshot.inputs?.location, 120);
  }

  resolvedFacilityType = titleCaseFacilityType(resolvedFacilityType);

  if (resolvedZip) {
    const locationZipCode = locationZip(resolvedLocation);
    if (!locationZipCode || locationZipCode !== resolvedZip) {
      resolvedLocation = resolveLocationFromZip(resolvedZip, resolvedLocation || "Massachusetts");
    }
  }

  if (!resolvedZip && resolvedLocation) {
    const zipPrefix = resolvedLocation.match(/^ZIP (\d{5})/i);
    if (zipPrefix) resolvedZip = zipPrefix[1];
    else {
      const zipMatch = resolvedLocation.match(/\b(\d{5})\b/);
      if (zipMatch) resolvedZip = zipMatch[1];
    }
  }

  if (!resolvedLocation && resolvedZip) {
    resolvedLocation = cityFromZipCode(resolvedZip) || `ZIP ${resolvedZip}, MA`;
  } else if (
    resolvedLocation &&
    !locationFromRegion &&
    !/,\s*MA\b/i.test(resolvedLocation) &&
    !/^ZIP \d{5}/i.test(resolvedLocation)
  ) {
    resolvedLocation = normalizeLocation(resolvedLocation);
  }

  if (!resolvedLocation) resolvedLocation = "Massachusetts";

  const subjectZip = resolvedZip || extractZip(resolvedLocation) || "Massachusetts";

  return {
    facilityType: resolvedFacilityType,
    zip: subjectZip,
    location: resolvedLocation,
  };
}

<<<<<<< HEAD
=======
function appendUtm(url, params) {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${params}`;
}

function buildEmailHtml(magicLink, recipientEmail) {
  const safeLink = escapeHtml(magicLink);
  const safeEmail = escapeHtml(recipientEmail || "");
  const unsubscribeLink = safeEmail
    ? `https://assistedly.ai/api/auth/unsubscribe?email=${encodeURIComponent(safeEmail)}`
    : "#";

  // UTM parameters for Google Analytics campaign tracking
  const utmSource = "email";
  const utmMedium = "email";
  const utmCampaign = "welcome";
  const utmBtn = `utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}&utm_content=sign-in-button`;
  const utmFallback = `utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}&utm_content=fallback-link`;
  const utmFooter = `utm_source=${utmSource}&utm_medium=${utmMedium}&utm_campaign=${utmCampaign}&utm_content=footer-link`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Welcome to Assistedly.ai</title>
</head>
<body style="margin:0;padding:24px 12px;background-color:#f9f6f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#333333;line-height:1.7;">

  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">
    Your one-time sign-in link to Assistedly.ai — find the best assisted living in Massachusetts.
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="max-width:600px;">
    <tr>
      <td>

        <div style="max-width:600px;margin:0 auto;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header: photo strip with centered heart logo -->
          <div style="background:#ffffff;padding:0;position:relative;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">
              <tr>
                <td width="50%" style="padding:4px 0 4px 4px;vertical-align:top;">
                  <img src="https://assistedly.ai/banner/banner-1.png" alt="" width="100%" style="display:block;width:100%;height:auto;border-radius:8px 0 0 8px;max-height:200px;object-fit:cover;border:0;">
                </td>
                <td width="50%" style="padding:4px 4px 4px 0;vertical-align:top;">
                  <img src="https://assistedly.ai/banner/banner-3.png" alt="" width="100%" style="display:block;width:100%;height:auto;border-radius:0 8px 8px 0;max-height:200px;object-fit:cover;border:0;">
                </td>
              </tr>
            </table>
            <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;">
              <span style="display:inline-flex;align-items:center;justify-content:center;width:56px;height:56px;border-radius:50%;background:#ffffff;border:3px solid #c4956a;box-shadow:0 2px 8px rgba(0,0,0,0.15);">
                <svg viewBox="0 0 24 24" width="30" height="30" fill="#4a7c7e" focusable="false" style="display:block;">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
                </svg>
              </span>
            </div>
            <div style="text-align:center;padding:14px 24px 10px;">
              <div style="font-size:22px;font-weight:700;color:#4a7c7e;letter-spacing:-0.01em;">Assistedly.ai</div>
              <div style="font-size:14px;color:#666666;margin-top:2px;">Unbiased AI Finds Best Assisted Living in Massachusetts</div>
            </div>
          </div>

          <!-- Body -->
          <div style="padding:36px 40px 32px;background-color:#ffffff;">

            <h1 style="font-size:22px;font-weight:800;color:#6d1247;line-height:1.3;letter-spacing:-0.02em;margin:0 0 16px;">Welcome to Assistedly.ai! 🎉</h1>
            <p style="font-size:16px;color:#333333;line-height:1.7;margin:0 0 16px;">Thank you for your interest in <strong style="color:#333333;">Assistedly.ai</strong>. We're honored to help you find the right assisted living facility for your loved one.</p>

            <h2 style="text-align:center;font-size:18px;font-weight:700;color:#6d1247;line-height:1.3;margin:0 0 12px;">Your One-Time Sign-In Link</h2>
            <p style="text-align:center;font-size:16px;color:#333333;line-height:1.7;margin:0 0 16px;">Click the button below to sign in and get started:</p>

            <div style="text-align:center;margin:24px 0;">
              <!--[if mso]>
              <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${appendUtm(safeLink, utmBtn)}" style="height:48px;v-text-anchor:middle;width:220px;" arcsize="25%" strokecolor="#4a7c7e" fillcolor="#4a7c7e">
                <w:anchorlock/>
                <center style="color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:16px;font-weight:700;">Sign In to Assistedly.ai</center>
              </v:roundrect>
              <![endif]-->
              <!--[if !mso]><!-->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:12px;background-color:#4a7c7e;text-align:center;">
                    <a href="${appendUtm(safeLink, utmBtn)}" style="display:inline-block;padding:14px 32px;font-size:16px;font-weight:700;color:#ffffff;background-color:#4a7c7e;border-radius:12px;text-decoration:none;text-align:center;">Sign In to Assistedly.ai</a>
                  </td>
                </tr>
              </table>
              <!--<![endif]-->
            </div>

            <p style="text-align:center;font-size:14px;color:#666666;margin:0 0 20px;">
              ⏳ This link will expire in <strong>24 hours</strong>.
            </p>

            <p style="font-size:14px;color:#666666;margin:0 0 8px;">If the button above doesn't work, copy and paste this link into your browser:</p>
            <div style="background:#f9f6f2;border:1px solid #e6e6e9;border-radius:12px;padding:14px 18px;margin:16px 0;word-break:break-all;font-size:13px;color:#4a7c7e;line-height:1.5;">
              <a href="${appendUtm(safeLink, utmFallback)}" style="color:#4a7c7e;font-weight:600;text-decoration:none;">${safeLink}</a>
            </div>

            <hr style="border:none;border-top:1px solid #e6e6e9;margin:20px 0;">

            <!-- Mission callout -->
            <div style="background:linear-gradient(135deg,#f4fbf8,#f7fafc);border:1px solid #dcefe7;border-radius:20px;padding:20px 24px;margin:20px 0;">
              <p style="margin:0;font-size:15px;color:#666666;line-height:1.6;">💝 <strong style="color:#6d1247;">Our Mission:</strong> At Assistedly.ai, my mission is to provide transparent and unbiased data to help you find the best assisted living facilities in Massachusetts. We're here to help you every step of the way.</p>
            </div>

            <!-- Values -->
            <h2 style="text-align:center;font-size:18px;font-weight:700;color:#6d1247;line-height:1.3;margin:0 0 12px;">Why Families Trust Assistedly.ai</h2>

            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0 8px;">
              <tr>
                <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
                  <div style="background:#f9f6f2;border:1px solid #e6e6e9;border-radius:12px;padding:16px 18px;margin-bottom:12px;text-align:center;">
                    <span style="font-size:24px;display:block;margin-bottom:6px;">🔒</span>
                    <div style="font-size:14px;font-weight:700;color:#6d1247;margin-bottom:4px;">Your Privacy Protected</div>
                    <p style="font-size:13px;color:#666666;line-height:1.5;margin:0;">We never sell your personal info to facilities. No salespeople will call.</p>
                  </div>
                </td>
                <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
                  <div style="background:#f9f6f2;border:1px solid #e6e6e9;border-radius:12px;padding:16px 18px;margin-bottom:12px;text-align:center;">
                    <span style="font-size:24px;display:block;margin-bottom:6px;">📊</span>
                    <div style="font-size:14px;font-weight:700;color:#6d1247;margin-bottom:4px;">Data &gt; Pretty Pictures</div>
                    <p style="font-size:13px;color:#666666;line-height:1.5;margin:0;">We analyze compliance records, staffing ratios, and real reviews.</p>
                  </div>
                </td>
              </tr>
              <tr>
                <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
                  <div style="background:#f9f6f2;border:1px solid #e6e6e9;border-radius:12px;padding:16px 18px;margin-bottom:12px;text-align:center;">
                    <span style="font-size:24px;display:block;margin-bottom:6px;">🔍</span>
                    <div style="font-size:14px;font-weight:700;color:#6d1247;margin-bottom:4px;">Unbiased Info</div>
                    <p style="font-size:13px;color:#666666;line-height:1.5;margin:0;">Facilities don't pay us for placement — just honest recommendations.</p>
                  </div>
                </td>
                <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
                  <div style="background:#f9f6f2;border:1px solid #e6e6e9;border-radius:12px;padding:16px 18px;margin-bottom:12px;text-align:center;">
                    <span style="font-size:24px;display:block;margin-bottom:6px;">💝</span>
                    <div style="font-size:14px;font-weight:700;color:#6d1247;margin-bottom:4px;">Helping Families</div>
                    <p style="font-size:13px;color:#666666;line-height:1.5;margin:0;">We're working to help seniors get better care through our platform.</p>
                  </div>
                </td>
              </tr>
            </table>

            <hr style="border:none;border-top:1px solid #e6e6e9;margin:20px 0;">

            <!-- Stats -->
            <div style="background:#4a7c7e;border-radius:12px;padding:16px;margin:20px 0;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="text-align:center;padding:4px 8px;">
                    <span style="font-size:20px;font-weight:800;color:#c4956a;display:block;">500+</span>
                    <span style="font-size:12px;color:rgba(255,255,255,0.8);font-weight:500;">MA Facilities Listed</span>
                  </td>
                  <td style="text-align:center;padding:4px 8px;">
                    <span style="font-size:20px;font-weight:800;color:#c4956a;display:block;">100%</span>
                    <span style="font-size:12px;color:rgba(255,255,255,0.8);font-weight:500;">Privacy Protected</span>
                  </td>
                  <td style="text-align:center;padding:4px 8px;">
                    <span style="font-size:20px;font-weight:800;color:#c4956a;display:block;">$0</span>
                    <span style="font-size:12px;color:rgba(255,255,255,0.8);font-weight:500;">Always Free</span>
                  </td>
                </tr>
              </table>
            </div>

            <h2 style="font-size:18px;font-weight:700;color:#6d1247;line-height:1.3;margin:0 0 12px;">What to Expect Next</h2>
            <p style="font-size:16px;color:#333333;line-height:1.7;margin:0 0 16px;">In the coming days, we'll send you more information about how to get the most out of our platform — including:</p>
            <ul style="color:#333333;line-height:1.7;margin:0 0 16px;padding-left:20px;">
              <li>Tips for comparing facilities side-by-side</li>
              <li>How to use our compliance tracking tools</li>
              <li>Guides for touring and evaluating facilities</li>
            </ul>
            <p style="font-size:16px;color:#333333;line-height:1.7;margin:0 0 16px;">If you have any questions, simply reply to this email. We're here to help. ❤️</p>

            <p style="margin:0;">
              Be well,<br>
              <strong style="color:#333333;">Josh Fialkoff, Founder</strong>
            </p>

          </div>

          <!-- Footer -->
          <div style="background:#071e18;padding:24px 40px 20px;text-align:center;">
            <div style="font-size:16px;font-weight:700;color:#ffffff;margin-bottom:8px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="#4a7c7e" focusable="false" style="display:inline-block;vertical-align:middle;margin-right:4px;">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"></path>
              </svg>
              Assistedly.ai
            </div>
            <p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;margin:0 0 6px;">Massachusetts's most trusted AI-powered assisted living finder.</p>
            <p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.6;margin:0 0 6px;">
              <a href="https://assistedly.ai/?${utmFooter}" style="color:rgba(255,255,255,0.65);text-decoration:underline;">Visit Our Website</a> &nbsp;·&nbsp;
              <a href="${unsubscribeLink}" style="color:rgba(255,255,255,0.65);text-decoration:underline;">Unsubscribe</a>
            </p>
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.35);">
              &copy; 2026 Assistedly.ai. All rights reserved.
            </p>
          </div>

        </div>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" width="100%" style="max-width:600px;">
          <tr>
            <td style="padding:12px 24px;text-align:center;">
              <p style="font-size:11px;color:#999999;margin:0;">
                You received this email because you signed up for Assistedly.
                <a href="${unsubscribeLink}" style="color:#999999;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

>>>>>>> origin/main
async function buildMagicLinkEmail(magicLink, context = {}) {
  const { facilityType, zip, location } = resolveMagicLinkEmailContext(context);
  const safeLink = escapeHtml(magicLink);

<<<<<<< HEAD
  const campaign = await getCampaign("Welcome Email (Phase 1)");
  const subject = campaign.subject;
  const body = campaign.body.replace("[Magic Link]", magicLink);
  const html = body.replace("[Magic Link]", `<a href="${safeLink}">${safeLink}</a>`);

  return { subject, html, text: body };
=======
  const subject = "Welcome to Assistedly! Here's your sign-in link.";

  // Plain text fallback
  const text = [
    `Thank you for your interest in Assistedly.`,
    ``,
    `Here is your one-time sign-in link:`,
    `${magicLink}`,
    ``,
    `This link will expire in 24 hours.`,
    ``,
    `At Assistedly, my mission is to provide transparent and unbiased data to help you find the best assisted living facilities in Massachusetts. We're here to help you every step of the way.`,
    ``,
    `In the coming days, we'll send you more information about how to get the most out of our platform.`,
    ``,
    `To unsubscribe, visit: https://assistedly.ai/api/auth/unsubscribe?email=${encodeURIComponent(context.email || "")}`,
  ].join('\n');

  // Styled HTML version
  const html = buildEmailHtml(magicLink, context.email);

  return { subject, html, text };
>>>>>>> origin/main
}

module.exports = {
  buildMagicLinkEmail,
  resolveMagicLinkEmailContext,
};