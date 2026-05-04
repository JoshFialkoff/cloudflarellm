const { getSession } = require("../../../lib/serverAuth");

export default function handler(req, res) {
  const session = getSession(req);
  return res.status(200).json({ authenticated: Boolean(session), email: session?.email || "" });
}
