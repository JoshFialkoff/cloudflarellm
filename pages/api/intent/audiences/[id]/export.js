import { getAudience } from "lib/intent-data/audiences";
import { getAccount } from "lib/intent-data/accounts";
import { getContact } from "lib/intent-data/contacts";

export default function handler(req, res) {
  const { id } = req.query;
  const format = req.query.format || "json";

  const audience = getAudience(id);
  if (!audience) {
    return res.status(404).json({ error: "Audience not found" });
  }

  const accounts = (audience.accountIds || []).map(getAccount).filter(Boolean);
  const contacts = (audience.contactIds || []).map(getContact).filter(Boolean);

  if (format === "csv") {
    const rows = [
      ["type", "id", "name", "email", "domain", "industry", "title"].join(","),
      ...accounts.map((a) => ["account", a.id, a.name, "", a.domain, a.industry, ""].join(",")),
      ...contacts.map((c) => ["contact", c.id, `${c.firstName} ${c.lastName}`, c.email, "", "", c.title].join(",")),
    ];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="audience-${id}.csv"`);
    return res.status(200).send(rows.join("\n"));
  }

  res.status(200).json({
    ok: true,
    data: { audience, accounts, contacts },
  });
}
