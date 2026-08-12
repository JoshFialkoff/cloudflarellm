import { listAccounts, addAccount } from "lib/intent-data/accounts";

export default function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, data: listAccounts() });
  }
  if (req.method === "POST") {
    const account = addAccount(req.body || {});
    return res.status(201).json({ ok: true, data: account });
  }
  return res.status(405).json({ error: "Method not allowed" });
}
