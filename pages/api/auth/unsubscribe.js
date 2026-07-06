/**
 * Unsubscribe endpoint: adds the email to Resend's suppression list
 * so no future emails are sent to that address.
 *
 * Accepts GET (link click) and POST (programmatic).
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getResendApiKey() {
  const key = process.env.RESEND_API_KEY;
  return typeof key === "string" ? key.trim() : "";
}

async function suppressEmail(email) {
  const key = getResendApiKey();
  if (!key) return { ok: false, reason: "missing_resend_api_key" };

  const response = await fetch("https://api.resend.com/suppressions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    // 422 usually means already suppressed — that's fine
    if (response.status === 422) return { ok: true, already_suppressed: true };
    throw new Error(`Resend suppression API returned ${response.status}${body ? `: ${body}` : ""}`);
  }

  return { ok: true, already_suppressed: false };
}

export default async function handler(req, res) {
  // Allow GET (direct link click from email) and POST (programmatic unsubscribe)
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const email = req.method === "GET"
    ? String(req.query?.email || "").trim().toLowerCase()
    : String(req.body?.email || "").trim().toLowerCase();

  if (!email || !EMAIL_RE.test(email)) {
    if (req.method === "GET") {
      // Show a simple page for link clicks
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(400).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f9f6f2;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem;"><div style="background:#fff;border-radius:12px;padding:2rem;max-width:400px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.08);"><h1 style="color:#6d1247;font-size:1.25rem;">Missing email</h1><p style="color:#666;">The unsubscribe link was malformed. Please contact support.</p></div></body></html>`);
    }
    return res.status(400).json({ error: "Valid email required" });
  }

  try {
    const result = await suppressEmail(email);
    if (req.method === "GET") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(200).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f9f6f2;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem;"><div style="background:#fff;border-radius:12px;padding:2rem;max-width:400px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.08);"><span style="font-size:2.5rem;display:block;margin-bottom:0.5rem;">✅</span><h1 style="color:#6d1247;font-size:1.25rem;margin:0 0 0.5rem;">You're unsubscribed</h1><p style="color:#666;margin:0 0 0.25rem;">We've removed <strong>${email.replace(/[<>&"]/g, "")}</strong> from our mailing list.</p><p style="color:#999;font-size:0.85rem;">You won't receive any more emails from Assistedly.ai.</p></div></body></html>`);
    }
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("Unsubscribe failed:", error);
    if (req.method === "GET") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(500).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe</title><body style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#f9f6f2;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:1rem;"><div style="background:#fff;border-radius:12px;padding:2rem;max-width:400px;text-align:center;box-shadow:0 1px 3px rgba(0,0,0,0.08);"><h1 style="color:#6d1247;font-size:1.25rem;">Something went wrong</h1><p style="color:#666;">Please try again or contact support.</p></div></body></html>`);
    }
    return res.status(502).json({ error: "Failed to unsubscribe" });
  }
}