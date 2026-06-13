const crypto = require("crypto");

const AUTH_COOKIE = "assistedly_auth";
const MAGIC_LINK_TTL_MS = 30 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_AUTH_REDIRECT = "/find-safest?signed_in=1";

function getSecret() {
  return process.env.AUTH_MAGIC_LINK_SECRET || process.env.NEXTAUTH_SECRET || "local-assistedly-dev-secret";
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload) {
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifyToken(token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", getSecret()).update(body).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

function createMagicToken(email, sessionData = {}) {
  return signPayload({
    email,
    kind: "magic",
    redirectTo: sessionData.redirectTo,
    resultSnapshot: sessionData.resultSnapshot,
    authSurface: sessionData.authSurface || null,
    exp: Date.now() + MAGIC_LINK_TTL_MS,
  });
}

function createSessionToken(email, sessionData = {}) {
  return signPayload({
    email,
    kind: "session",
    resultSnapshot: sessionData.resultSnapshot,
    exp: Date.now() + SESSION_TTL_MS,
  });
}

function normalizeRedirectPath(value, fallback = DEFAULT_AUTH_REDIRECT) {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return fallback;

  try {
    const parsed = new URL(raw, "https://assistedly.ai");
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

function parseCookies(req) {
  return Object.fromEntries(
    String(req.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf("=");
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      }),
  );
}

function getSession(req) {
  const token = parseCookies(req)[AUTH_COOKIE];
  const payload = verifyToken(token);
  if (!payload || payload.kind !== "session") return null;
  return {
    email: payload.email,
    resultSnapshot: payload.resultSnapshot || null,
  };
}

function sessionCookie(email, sessionData = {}) {
  const token = createSessionToken(email, sessionData);
  return `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${Math.floor(
    SESSION_TTL_MS / 1000,
  )}; HttpOnly; SameSite=Lax; Secure`;
}

module.exports = {
  AUTH_COOKIE,
  createMagicToken,
  getSession,
  normalizeRedirectPath,
  sessionCookie,
  verifyToken,
};
