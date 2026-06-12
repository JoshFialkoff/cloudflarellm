const { createMagicToken, normalizeRedirectPath } = require("../../../lib/serverAuth");
const { buildMagicLinkEmail } = require("../../../lib/magicLinkEmail");
const { sanitizeResultSnapshot } = require("../../../lib/resultSnapshot");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendEmail(email, magicLink, emailContext) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false };

  const { subject, html, text } = buildMagicLinkEmail(magicLink, emailContext);

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
      html,
      text,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider returned ${response.status}`);
  }
  return { sent: true };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: "Valid email required" });
  }

  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const resultSnapshot = sanitizeResultSnapshot(req.body?.resultSnapshot);
  const redirectTo = normalizeRedirectPath(req.body?.redirectTo);
  const emailContext = {
    zip: req.body?.zip,
    facilityType: req.body?.facilityType,
    location: req.body?.location,
    resultSnapshot,
  };
  const token = createMagicToken(email, { redirectTo, resultSnapshot });
  const magicLink = `${proto}://${host}/api/auth/verify?token=${encodeURIComponent(token)}`;

  try {
    const delivery = await sendEmail(email, magicLink, emailContext);
    return res.status(200).json({
      ok: true,
      sent: delivery.sent,
      magicLink: delivery.sent ? undefined : magicLink,
    });
  } catch (error) {
    console.error("Magic link email failed", error);
    return res.status(502).json({ error: "Could not send sign-in link" });
  }
}
