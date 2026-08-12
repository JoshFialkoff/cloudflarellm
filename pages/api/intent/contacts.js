import { listContacts, addContact } from "lib/intent-data/contacts";

export default function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, data: listContacts() });
  }
  if (req.method === "POST") {
    const contact = addContact(req.body || {});
    return res.status(201).json({ ok: true, data: contact });
  }
  return res.status(405).json({ error: "Method not allowed" });
}
