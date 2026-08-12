import { resolveGraph, graphStats } from "lib/intent-data/identityGraph";

export default function handler(req, res) {
  const { domain, email, stats } = req.query;

  if (stats === "true" || stats === "1") {
    return res.status(200).json({ ok: true, data: graphStats() });
  }

  const result = resolveGraph({ domain, email });
  res.status(200).json({ ok: true, data: result });
}
