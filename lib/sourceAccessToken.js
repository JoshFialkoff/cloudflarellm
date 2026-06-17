const crypto = require("crypto");

const SOURCE_TOKEN_TTL_MS = 60 * 60 * 1000;

function getSourceSecret() {
  return (
    process.env.SOURCE_LINK_SECRET ||
    process.env.AUTH_MAGIC_LINK_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "local-assistedly-dev-secret"
  );
}

function base64url(input) {
  return Buffer.from(input).toString("base64url");
}

function signSourcePayload(payload) {
  const body = base64url(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", getSourceSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

function verifySourceToken(token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = crypto.createHmac("sha256", getSourceSecret()).update(body).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload.exp || Date.now() > payload.exp) return null;
  if (!payload.slug || !payload.sourceId) return null;
  return payload;
}

function createSourceToken(slug, sourceId) {
  return signSourcePayload({
    slug: String(slug || "").trim(),
    sourceId: String(sourceId || "").trim(),
    exp: Date.now() + SOURCE_TOKEN_TTL_MS,
    nonce: crypto.randomBytes(8).toString("hex"),
  });
}

module.exports = {
  SOURCE_TOKEN_TTL_MS,
  createSourceToken,
  verifySourceToken,
};
