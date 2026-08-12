import { MODELS } from "lib/intent-data/models";

export default function handler(req, res) {
  res.status(200).json({ ok: true, models: Object.keys(MODELS) });
}
