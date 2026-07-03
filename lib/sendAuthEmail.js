const { buildMagicLinkEmail } = require("./magicLinkEmail");

function getResendApiKey() {
  const key = process.env.RESEND_API_KEY;
  return typeof key === "string" ? key.trim() : "";
}

/**
 * @returns {Promise<{ sent: boolean, reason?: string }>}
 */
async function sendMagicLinkEmail(email, magicLink, emailContext) {
  const key = getResendApiKey();
  if (!key) {
    return { sent: false, reason: "missing_resend_api_key" };
  }

  const { subject, html, text } = await buildMagicLinkEmail(magicLink, emailContext);

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM || "Assistedly <hello@updates.assistedly.ai>",
      to: email,
      subject,
      html,
      text,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Email provider returned ${response.status}${body ? `: ${body}` : ""}`);
  }

  return { sent: true };
}

module.exports = {
  getResendApiKey,
  sendMagicLinkEmail,
};