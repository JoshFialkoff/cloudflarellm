export default function handler(req, res) {
  res.status(200).json({ ok: true, service: "aidp", version: "0.1.0" });
}
