const { getSession } = require("../../../lib/serverAuth");
const { getAverageCostByCity } = require("../../../lib/nocodb");
const { checkRateLimit } = require("../../../lib/rateLimit");

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const session = getSession(req);
  if (!session) {
    return res.status(401).json({ error: "Sign in required" });
  }

  const ip = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown";
  const limit = checkRateLimit(`api-answers-cost-by-city:${ip}`, {
    maxRequests: 60,
    windowMs: 60 * 1000,
  });
  if (!limit.allowed) {
    res.setHeader("Retry-After", Math.ceil(limit.retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many requests" });
  }

  try {
    const result = await getAverageCostByCity();
    return res.status(200).json(result);
  } catch (err) {
    console.error("/api/answers/cost-by-city error:", err);
    return res.status(502).json({ error: "Failed to load cost data" });
  }
}
