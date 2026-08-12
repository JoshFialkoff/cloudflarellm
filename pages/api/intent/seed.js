import { seedDemoData } from "lib/intent-data/seed";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const result = seedDemoData();
  res.status(200).json({ ok: true, seeded: result });
}
