/**
 * Liveness check for the Node process (use from origin host or probes).
 * Does not validate databases or external services.
 */
export default function handler(req, res) {
    if (req.method !== "GET") {
        res.setHeader("Allow", "GET");
        return res.status(405).end();
    }
    res.status(200).json({ ok: true });
}
