const { createMagicToken, normalizeRedirectPath } = require("../../../lib/serverAuth");
const { sendMagicLinkEmail } = require("../../../lib/sendAuthEmail");
const { sanitizeResultSnapshot } = require("../../../lib/resultSnapshot");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const authSurface = String(req.body?.authSurface || "").trim() || "magic_link_form";
  const token = createMagicToken(email, { redirectTo, resultSnapshot, authSurface });
  const magicLink = `${proto}://${host}/api/auth/verify?token=${encodeURIComponent(token)}`;

  try {
    const delivery = await sendMagicLinkEmail(email, magicLink, emailContext);
    return res.status(200).json({
      ok: true,
      sent: delivery.sent,
      magicLink: delivery.sent ? undefined : magicLink,
      ...(delivery.reason ? { reason: delivery.reason } : {}),
    });
  } catch (error) {
    console.error("Magic link email failed", error);
    return res.status(502).json({ error: "Could not send sign-in link" });
  }
}
