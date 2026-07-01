const { createMagicToken, normalizeRedirectPath, resolveMagicLinkRedirect } = require("../../../lib/serverAuth");
const { saveResultSnapshot } = require("../../../lib/authResultStore");
const { sendMagicLinkEmail } = require("../../../lib/sendAuthEmail");
const { resolveRequestOrigin } = require("../../../lib/requestOrigin");
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

  const origin = resolveRequestOrigin(req);
  const resultSnapshot = sanitizeResultSnapshot(req.body?.resultSnapshot);
  const snapshotId = resultSnapshot ? saveResultSnapshot(email, resultSnapshot) : null;
  const authSurface = String(req.body?.authSurface || "").trim() || "magic_link_form";
  const redirectTo = resolveMagicLinkRedirect({
    authSurface,
    redirectTo: normalizeRedirectPath(req.body?.redirectTo, "/results"),
  });
  const emailContext = {
    zip: req.body?.zip,
    facilityType: req.body?.facilityType,
    location: req.body?.location,
    resultSnapshot,
  };
  const token = createMagicToken(email, {
    redirectTo,
    snapshotId,
    resultSnapshot: snapshotId ? null : resultSnapshot,
    authSurface,
  });
  const magicLink = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;

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
    // Outside production (or when explicitly allowed), fall back to test mode:
    // return the clickable link in the response so local/dev sign-in still works
    // even when the email provider rejects the send (e.g. unverified domain).
    const allowTestFallback =
      process.env.NODE_ENV !== "production" ||
      process.env.AUTH_ALLOW_TEST_LINK_FALLBACK === "1";
    if (allowTestFallback) {
      return res.status(200).json({
        ok: true,
        sent: false,
        magicLink,
        reason: "email_delivery_failed",
      });
    }
    return res.status(502).json({ error: "Could not send sign-in link" });
  }
}
