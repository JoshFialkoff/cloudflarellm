const { recordUserAuth, getUserByEmail } = require("../../lib/mvpDataStore");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clampInt(value, min, max, fallback) {
    const n = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
}

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const webhookUrl =
        process.env.DISCORD_CONCIERGE_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL;
    if (
        !webhookUrl ||
        !webhookUrl.startsWith("https://discord.com/api/webhooks/")
    ) {
        return res
            .status(503)
            .json({ error: "Concierge notifications are not configured" });
    }

    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim();
    const phone = String(req.body?.phone || "").trim();
    const city = String(req.body?.city || "").trim();
    const budget = String(req.body?.budget || "").trim();
    const timeline = String(req.body?.timeline || "").trim();
    const careLevel = String(req.body?.careLevel || "").trim();
    const notes = String(req.body?.notes || "").trim();
    const scoreFit = clampInt(req.body?.scoreFit, 0, 100, 0);
    const scoreSpeed = clampInt(req.body?.scoreSpeed, 0, 100, 0);
    const scoreRisk = clampInt(req.body?.scoreRisk, 0, 100, 0);

    if (!name || name.length > 120) {
        return res.status(400).json({ error: "Valid name required" });
    }
    if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
        return res.status(400).json({ error: "Valid email required" });
    }

    const description = [
        `**Name:** ${name}`,
        `**Email:** ${email}`,
        `**Phone:** ${phone || "N/A"}`,
        `**Target city/region:** ${city || "N/A"}`,
        `**Budget:** ${budget || "N/A"}`,
        `**Move timeline:** ${timeline || "N/A"}`,
        `**Care level:** ${careLevel || "N/A"}`,
        "",
        "**Private-Pay Fit Preview**",
        `- Fit score: ${scoreFit}/100`,
        `- Speed-to-move-in score: ${scoreSpeed}/100`,
        `- Hidden-fee risk score: ${scoreRisk}/100`,
        "",
        `**Notes:** ${notes || "N/A"}`,
    ].join("\n");

    const discordRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            embeds: [
                {
                    title: "New Concierge Shortlist Intake",
                    description,
                    color: 0x12cd87,
                    timestamp: new Date().toISOString(),
                },
            ],
        }),
    });

    if (!discordRes.ok) {
        const text = await discordRes.text().catch(() => "");
        console.error("Concierge webhook failed", discordRes.status, text);
        return res
            .status(502)
            .json({ error: "Could not submit your request. Please try again." });
    }

    const user = await getUserByEmail(email);
    await recordUserAuth(email, user?.role || "registered_user", {
      usedConsultation: true,
    });

    return res.status(200).json({ ok: true });
}
