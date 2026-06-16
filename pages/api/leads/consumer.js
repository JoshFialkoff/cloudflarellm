import { normalizePartnerTrack, PARTNER_TRACKS } from "../../../lib/leadPartnerRouting";
import { saveLead } from "../../../lib/mvpDataStore";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  const name = String(req.body?.name || "").trim();
  const city = String(req.body?.city || "").trim();
  const town = String(req.body?.town || city || "").trim();
  const careNeed = String(req.body?.careNeed || "").trim();
  const phone = String(req.body?.phone || "").trim().slice(0, 32);
  const intent = String(req.body?.intent || "consumer_mvp").trim();
  const flow = String(req.body?.flow || "").trim();
  const leadMagnet = String(req.body?.leadMagnet || "").trim();
  const page = String(req.body?.page || "").trim();
  const partnerTrack = normalizePartnerTrack(req.body?.partnerTrack);
  const facilities = Array.isArray(req.body?.facilities) ? req.body.facilities.slice(0, 12) : [];
  const notes = String(req.body?.notes || "").trim();

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Valid email required" });

  if (flow === "get_matched" && !partnerTrack) {
    return res.status(400).json({ error: "Choose how you want to be matched" });
  }

  await saveLead({
    email,
    name,
    city,
    town,
    careNeed,
    intent,
    flow,
    leadMagnet,
    page,
    partnerTrack,
    facilities,
    notes,
  });

  const webhookUrl =
    process.env.DISCORD_CONCIERGE_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl?.startsWith("https://discord.com/api/webhooks/")) {
    return res.status(200).json({ ok: true, queued: true });
  }

  const trackMeta = partnerTrack ? PARTNER_TRACKS[partnerTrack] : null;
  const discordTitle =
    flow === "get_matched" ? "Get matched — Phase 2 lead" : "New Consumer MVP Lead";

  const description = [
    `**Intent:** ${intent}`,
    trackMeta ? `**Route to:** ${trackMeta.routeTo}` : "",
    trackMeta
      ? `**Internal pricing guide (manual):** ${trackMeta.internalPriceBand}`
      : "",
    `**Name:** ${name || "N/A"}`,
    `**Email:** ${email}`,
    phone ? `**Phone:** ${phone}` : "",
    `**City:** ${city || "N/A"}`,
    careNeed ? `**Care need:** ${careNeed}` : "",
    leadMagnet ? `**Lead magnet:** ${leadMagnet}` : "",
    page ? `**Page:** ${page}` : "",
    facilities.length ? `**Facilities:** ${facilities.join(", ")}` : "",
    notes ? `**Notes:** ${notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const discordRes = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      embeds: [{ title: discordTitle, description, color: 0x12cd87, timestamp: new Date().toISOString() }],
    }),
  });

  if (!discordRes.ok) {
    console.error("Consumer lead webhook failed", discordRes.status, await discordRes.text().catch(() => ""));
    return res.status(502).json({ error: "Could not submit your request. Please try again." });
  }

  return res.status(200).json({ ok: true });
}
