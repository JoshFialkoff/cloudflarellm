const { getResendApiKey } = require("./sendAuthEmail");
const { getCampaign } = require("./marketingContent");

async function sendDripEmail(email, subject, body) {
  const key = getResendApiKey();
  if (!key) {
    console.error("Missing Resend API key for drip campaign");
    return { sent: false, reason: "missing_resend_api_key" };
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM || "Assistedly <hello@assistedly.ai>",
      to: email,
      subject,
      html: body,
      text: body,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`Resend API returned ${response.status}${body ? `: ${body}` : ""}`);
    return { sent: false, reason: "resend_api_error" };
  }

  return { sent: true };
}

const dripCampaign = [
  { day: 1, name: "Drip Campaign: Email 1 (Day 1)" },
  { day: 3, name: "Drip Campaign: Email 2 (Day 3)" },
  { day: 7, name: "Drip Campaign: Email 3 (Day 7)" },
  { day: 14, name: "Drip Campaign: Email 4 (Day 14)" },
];

async function startDripCampaign(email) {
  for (const emailConfig of dripCampaign) {
    setTimeout(async () => {
      const campaign = await getCampaign(emailConfig.name);
      await sendDripEmail(email, campaign.subject, campaign.body);
    }, emailConfig.day * 24 * 60 * 60 * 1000);
  }
}

module.exports = {
  startDripCampaign,
};
