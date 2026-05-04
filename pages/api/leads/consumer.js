const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = String(req.body?.email || "").trim().toLowerCase();
  const name = String(req.body?.name || "").trim();
  const city = String(req.body?.city || "").trim();
  const intent = String(req.body?.intent || "consumer_mvp").trim();
  const facilities = Array.isArray(req.body?.facilities) ? req.body.facilities.slice(0, 12) : [];
  const notes = String(req.body?.notes || "").trim();

  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Valid email required" });

  const webhookUrl =
    process.env.DISCORD_CONCIERGE_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;

  if (webhookUrl?.startsWith("https://discord.com/api/webhooks/")) {
    const description = [
      `**Intent:** ${intent}`,
      `**Name:** ${name || "N/A"}`,
      `**Email:** ${email}`,
      `**City:** ${city || "N/A"}`,
      facilities.length ? `**Facilities:** ${facilities.join(", ")}` : "",
      notes ? `**Notes:** ${notes}` : "",
    ].filter(Boolean).join("\n");

    const discordRes = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{ title: "New Consumer MVP Lead", description, color: 0x12cd87, timestamp: new Date().toISOString() }],
      }),
    });

    if (!discordRes.ok) {
      console.error("Consumer lead webhook failed", discordRes.status, await discordRes.text().catch(() => ""));
    }
  }

  return res.status(200).json({ ok: true });
}
