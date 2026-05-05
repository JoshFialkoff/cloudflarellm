const { normalizeRedirectPath, sessionCookie, verifyToken } = require("../../../lib/serverAuth");

export default function handler(req, res) {
  const payload = verifyToken(req.query?.token);
  if (!payload || payload.kind !== "magic" || !payload.email) {
    return res.status(400).send("Invalid or expired sign-in link.");
  }

  res.setHeader("Set-Cookie", sessionCookie(payload.email, {
    resultSnapshot: payload.resultSnapshot || null,
  }));
  res.writeHead(302, { Location: normalizeRedirectPath(payload.redirectTo) });
  res.end();
}
