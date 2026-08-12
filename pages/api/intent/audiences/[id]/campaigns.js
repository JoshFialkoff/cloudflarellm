import { getAudience } from "lib/intent-data/audiences";
import { getStore } from "lib/intent-data/store";

export default function handler(req, res) {
  const { id } = req.query;
  const audience = getAudience(id);
  if (!audience) {
    return res.status(404).json({ error: "Audience not found" });
  }

  const campaigns = getStore().campaigns?.filter((c) => c.audienceId === id) || [];
  res.status(200).json({ ok: true, data: campaigns });
}
