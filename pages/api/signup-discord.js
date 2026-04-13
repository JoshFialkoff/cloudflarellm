const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req, res) {
    if (req.method !== "POST") {
        res.setHeader("Allow", "POST");
        return res.status(405).json({ error: "Method not allowed" });
    }

    const webhookUrl = process.env.DISCORD_SIGNUP_WEBHOOK_URL;
    if (!webhookUrl || !webhookUrl.startsWith("https://discord.com/api/webhooks/")) {
        return res.status(503).json({ error: "Sign-up notifications are not configured" });
    }

    const raw =
        typeof req.body?.email === "string" ? req.body.email.trim() : "";
    if (!raw || raw.length > 254 || !EMAIL_RE.test(raw)) {
        return res.status(400).json({ error: "Valid email required" });
    }

    const discordRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            embeds: [
                {
                    title: "New email signup",
                    description: raw,
                    color: 0x10b981,
                    timestamp: new Date().toISOString(),
                },
            ],
        }),
    });

    if (!discordRes.ok) {
        const text = await discordRes.text().catch(() => "");
        console.error("Discord webhook failed", discordRes.status, text);
        return res.status(502).json({ error: "Could not complete sign-up. Try again later." });
    }

    return res.status(200).json({ ok: true });
}
