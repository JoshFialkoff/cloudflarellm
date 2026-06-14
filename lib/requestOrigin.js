function normalizeOrigin(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed.replace(/\/+$/, "");
  if (/^[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:\/.*)?$/i.test(trimmed)) {
    return `https://${trimmed}`.replace(/\/+$/, "");
  }
  return "";
}

function isLoopbackHost(host) {
  const hostname = String(host || "").split(":")[0].replace(/^\[|\]$/g, "").toLowerCase();
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "0.0.0.0"
  );
}

function resolveConfiguredPublicOrigin() {
  const candidates = [
    process.env.AUTH_PUBLIC_URL,
    process.env.DEV_PUBLIC_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITE_URL,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeOrigin(candidate);
    if (normalized) return normalized;
  }

  return "https://assistedly.ai";
}

/**
 * Public origin for absolute URLs in emails and redirects.
 * Prefers forwarded headers; falls back when the request host is loopback.
 * @param {import('http').IncomingMessage} req
 * @returns {string} e.g. https://agent1.assistedly.ai
 */
function resolveRequestOrigin(req) {
  let host = req.headers["x-forwarded-host"] || req.headers.host;
  let proto = req.headers["x-forwarded-proto"] || "https";

  if (host) host = String(host).split(",")[0].trim();
  if (proto) proto = String(proto).split(",")[0].trim();

  if (!host || isLoopbackHost(host)) {
    return resolveConfiguredPublicOrigin();
  }

  return `${proto}://${host}`;
}

module.exports = {
  isLoopbackHost,
  resolveConfiguredPublicOrigin,
  resolveRequestOrigin,
};
