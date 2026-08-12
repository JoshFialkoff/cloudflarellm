import { scoreDomain } from "lib/intent-data/intentScore";

export default async function handler(req, res) {
  const { domain } = req.query;
  if (!domain) {
    return res.status(400).json({ error: "Missing domain query param" });
  }
  try {
    const result = await scoreDomain(domain);
    res.status(200).json({ ok: true, data: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
