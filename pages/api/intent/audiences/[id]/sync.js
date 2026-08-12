import { getAudience } from "lib/intent-data/audiences";
import { getContact } from "lib/intent-data/contacts";
import { syncAudienceToTwenty } from "lib/intent-data/integrations/twenty";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { id } = req.query;
  const audience = getAudience(id);
  if (!audience) {
    return res.status(404).json({ error: "Audience not found" });
  }

  const contacts = (audience.contactIds || []).map(getContact).filter(Boolean);
  const body = req.body || {};
  const destination = body.destination || "twenty";

  let syncResult;
  switch (destination) {
    case "twenty":
      syncResult = await syncAudienceToTwenty({ audience, contacts });
      break;
    default:
      syncResult = { success: false, note: `Unknown destination: ${destination}` };
  }

  res.status(200).json({ ok: true, data: syncResult });
}
