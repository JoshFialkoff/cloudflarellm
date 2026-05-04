const { createMagicToken } = require("../../../lib/serverAuth");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function sendEmail(email, magicLink) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.AUTH_EMAIL_FROM || "Assistedly <hello@assistedly.ai>",
      to: email,
      subject: "Your assistedly.AI sign-in link",
      html: `<p>Click to sign in:</p><p><a href="${magicLink}">${magicLink}</a></p><p>This link expires in 30 minutes.</p>`,
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
  const token = createMagicToken(email);
  const magicLink = `${proto}://${host}/api/auth/verify?token=${encodeURIComponent(token)}`;

  try {
    const delivery = await sendEmail(email, magicLink);
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
