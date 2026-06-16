const { getSession } = require("../../../lib/serverAuth");
const {
  getDashboardSummary,
} = require("../../../lib/mvpDataStore");
const { isAdminRole, resolveUserRecord } = require("../../../lib/userRoles");

export default async function handler(req, res) {
  const session = getSession(req);
  if (!session?.email) {
    return res.status(401).json({ error: "Sign in required" });
  }

  const user = await resolveUserRecord(session.email);
  if (!isAdminRole(user.role)) {
    return res.status(403).json({ error: "Admin access required" });
  }

  return res.status(200).json(await getDashboardSummary());
}
