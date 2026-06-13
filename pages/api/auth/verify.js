const { normalizeRedirectPath, sessionCookie, verifyToken } = require("../../../lib/serverAuth");
const { appendAuthVerifiedQuery } = require("../../../lib/authRedirectQuery");

export default function handler(req, res) {
  const payload = verifyToken(req.query?.token);
  if (!payload || payload.kind !== "magic" || !payload.email) {
    return res.status(400).send("Invalid or expired sign-in link.");
  }

  res.setHeader("Set-Cookie", sessionCookie(payload.email, {
    resultSnapshot: payload.resultSnapshot || null,
  }));
  const redirectPath = appendAuthVerifiedQuery(
    normalizeRedirectPath(payload.redirectTo),
    payload.authSurface,
  );
  res.writeHead(302, { Location: redirectPath });
  res.end();
}
