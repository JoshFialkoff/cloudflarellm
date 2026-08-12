import { listAudiences, addAudience, buildAudienceFromCriteria } from "lib/intent-data/audiences";

export default function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, data: listAudiences() });
  }
  if (req.method === "POST") {
    const body = req.body || {};
    let payload = body;
    if (body.criteria) {
      const { accountIds, contactIds } = buildAudienceFromCriteria(body.criteria);
      payload = { ...body, accountIds, contactIds };
    }
    const audience = addAudience(payload);
    return res.status(201).json({ ok: true, data: audience });
  }
  return res.status(405).json({ error: "Method not allowed" });
}
