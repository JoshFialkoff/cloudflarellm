const { resolveMagicLinkRedirect, sessionCookie, verifyToken } = require("../../../lib/serverAuth");
const { appendAuthVerifiedQuery } = require("../../../lib/authRedirectQuery");
const { upsertUserFromAuth, resolveUserRecord } = require("../../../lib/userRoles");
const { startDripCampaign } = require("../../../lib/dripCampaign");

export default async function handler(req, res) {
  const payload = verifyToken(req.query?.token);
  if (!payload || payload.kind !== "magic" || !payload.email) {
    return res.status(400).send("Invalid or expired sign-in link.");
  }

  const userRecord = await resolveUserRecord(payload.email);
  const isNewUser = !userRecord.createdAt;

  if (isNewUser) {
    await startDripCampaign(payload.email);
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
