const { getSession } = require("../../lib/serverAuth");
const {
  isPremiumRole,
  resolveUserRecord,
} = require("../../lib/userRoles");
const {
  listComparisonsByOwner,
  saveComparison,
} = require("../../lib/mvpDataStore");

export default async function handler(req, res) {
  const session = getSession(req);
  const user = session?.email ? await resolveUserRecord(session.email) : null;

  if (!session || !user) {
    return res.status(401).json({ error: "Sign in to manage saved comparisons." });
  }

  if (req.method === "GET") {
    const comparisons = await listComparisonsByOwner(user.email);
    return res.status(200).json({ comparisons });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!isPremiumRole(user.role)) {
    return res.status(402).json({
      error: "Premium membership is required to save comparison reports.",
    });
  }

  const facilitySlugs = Array.isArray(req.body?.facilitySlugs)
    ? req.body.facilitySlugs.slice(0, 4).map((slug) => String(slug || "").trim()).filter(Boolean)
    : [];

  if (facilitySlugs.length < 2) {
    return res.status(400).json({ error: "Choose at least two facilities." });
  }

  const comparison = await saveComparison({
    ownerEmail: user.email,
    title: String(req.body?.title || "Saved comparison").trim(),
    facilitySlugs,
  });

  return res.status(200).json({ ok: true, comparison });
}
