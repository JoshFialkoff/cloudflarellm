const { getResendApiKey } = require("./sendAuthEmail");
const { getCampaign } = require("./marketingContent");

async function sendReviewRequestEmail(email) {
  const key = getResendApiKey();
  if (!key) {
    console.error("Missing Resend API key for evangelist campaign");
    return { sent: false, reason: "missing_resend_api_key" };
  }

  const campaign = await getCampaign("Review Request Email (Phase 3)");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM || "Assistedly <hello@assistedly.ai>",
      to: email,
      subject: campaign.subject,
      html: campaign.body,
      text: campaign.body,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`Resend API returned ${response.status}${body ? `: ${body}` : ""}`);
    return { sent: false, reason: "resend_api_error" };
  }

  return { sent: true };
}

module.exports = {
  sendReviewRequestEmail,
};
