const { verifySourceToken } = require("../../lib/sourceAccessToken");
const { resolveFacilitySourceAttestation } = require("../../lib/facilitySourceAttestation");

const ALLOWED_HOSTS = new Set([
  "assistedly.ai",
  "www.assistedly.ai",
  "agent1.assistedly.ai",
  "agent2.assistedly.ai",
  "agent3.assistedly.ai",
  "dev.assistedly.ai",
  "localhost",
  "127.0.0.1",
]);

const rateBuckets = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function isRateLimited(ip) {
  const now = Date.now();
  const bucket = rateBuckets.get(ip) || { count: 0, resetAt: now + RATE_WINDOW_MS };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + RATE_WINDOW_MS;
  }
  bucket.count += 1;
  rateBuckets.set(ip, bucket);
  return bucket.count > RATE_LIMIT;
}

function hasAllowedReferer(req) {
  const referer = String(req.headers.referer || "");
  if (!referer) return false;
  try {
    const host = new URL(referer).hostname;
    return ALLOWED_HOSTS.has(host);
  } catch {
    return false;
  }
}

function looksLikeBot(req) {
  const ua = String(req.headers["user-agent"] || "").toLowerCase();
  if (!ua) return true;
  return /bot|crawler|spider|curl|wget|python-requests|scrapy|headless/i.test(ua);
}

export default function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = clientIp(req);
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests" });
  }

  if (looksLikeBot(req) || !hasAllowedReferer(req)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const token = String(req.body?.token || "").trim();
  const payload = verifySourceToken(token);
  if (!payload) {
    return res.status(400).json({ error: "Invalid or expired source link" });
  }

  const attestation = resolveFacilitySourceAttestation(payload.slug, payload.sourceId);
  if (!attestation) {
    return res.status(404).json({ error: "Source record not found" });
  }

  return res.status(200).json({
    redirectUrl: attestation.dashboardUrl,
  });
}
