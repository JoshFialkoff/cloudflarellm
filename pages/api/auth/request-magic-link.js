const { createMagicToken, normalizeRedirectPath, resolveMagicLinkRedirect } = require("../../../lib/serverAuth");
const { saveResultSnapshot } = require("../../../lib/authResultStore");
const { sendMagicLinkEmail } = require("../../../lib/sendAuthEmail");
const { resolveRequestOrigin } = require("../../../lib/requestOrigin");
const { sanitizeResultSnapshot } = require("../../../lib/resultSnapshot");
const { checkRateLimit } = require("../../../lib/rateLimit");
const { recordConsent } = require("../../../lib/consentStore");

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

  // Rate limit: max 3 requests per email per 5 minutes
  const rateCheck = checkRateLimit(`magic-link:${email}`, { maxRequests: 3, windowMs: 5 * 60 * 1000 });
  if (!rateCheck.allowed) {
    return res.status(429).json({
      error: "Too many requests. Please wait before requesting another sign-in link.",
      retryAfterMs: rateCheck.retryAfterMs,
    });
  }

  const origin = resolveRequestOrigin(req);
  const resultSnapshot = sanitizeResultSnapshot(req.body?.resultSnapshot);
  const snapshotId = resultSnapshot ? saveResultSnapshot(email, resultSnapshot) : null;
  const authSurface = String(req.body?.authSurface || "").trim() || "magic_link_form";
  const redirectTo = resolveMagicLinkRedirect({
    authSurface,
    redirectTo: normalizeRedirectPath(req.body?.redirectTo, "/results"),
  });

  // Record consent: user explicitly submitted their email
  recordConsent(email, {
    authSurface,
    redirectTo,
    hasResultSnapshot: Boolean(resultSnapshot),
    ip: req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "",
    userAgent: req.headers["user-agent"] || "",
  });

  const emailContext = {
    email,
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