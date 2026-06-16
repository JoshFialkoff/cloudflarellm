const { resolveMagicLinkRedirect, sessionCookie, verifyToken } = require("../../../lib/serverAuth");
const { appendAuthVerifiedQuery } = require("../../../lib/authRedirectQuery");
const { upsertUserFromAuth } = require("../../../lib/userRoles");

export default async function handler(req, res) {
  const payload = verifyToken(req.query?.token);
  if (!payload || payload.kind !== "magic" || !payload.email) {
    return res.status(400).send("Invalid or expired sign-in link.");
  }

  const user = await upsertUserFromAuth(payload.email);

  res.setHeader("Set-Cookie", sessionCookie(payload.email, {
    role: user?.role,
    snapshotId: payload.snapshotId || null,
    resultSnapshot: payload.snapshotId ? null : payload.resultSnapshot || null,
  }));
  const redirectPath = appendAuthVerifiedQuery(
    resolveMagicLinkRedirect(payload),
    payload.authSurface,
  );
  res.writeHead(302, { Location: redirectPath });
  res.end();
}
