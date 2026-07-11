import crypto from 'crypto';

const PASSWORD_HASH = crypto.createHash('sha256').update('assistedly2026').digest('hex');
const COOKIE_NAME = 'fd_preview_auth';
const COOKIE_SECRET = process.env.AUTH_MAGIC_LINK_SECRET || 'local-assistedly-dev-secret';

export function verifyPreviewCookie(req) {
  const raw = req.cookies?.[COOKIE_NAME];
  if (!raw) return false;
  const [token, sig] = raw.split('.');
  if (!token || !sig) return false;
  const expected = crypto.createHmac('sha256', COOKIE_SECRET).update(token).digest('base64url');
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return false;
  } catch {
    return false;
  }
  const payload = JSON.parse(Buffer.from(token, 'base64url').toString());
  return payload.exp > Date.now();
}

export default function handler(req, res) {
  if (req.method === 'GET') {
    const ok = verifyPreviewCookie(req);
    return res.status(ok ? 200 : 401).json({ ok });
  }

  if (req.method === 'POST') {
    const { password } = req.body || {};
    const given = crypto.createHash('sha256').update(String(password || '')).digest('hex');
    if (given !== PASSWORD_HASH) {
      return res.status(401).json({ error: 'wrong password' });
    }
    const payload = Buffer.from(JSON.stringify({ exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
    const sig = crypto.createHmac('sha256', COOKIE_SECRET).update(payload).digest('base64url');
    res.setHeader('Set-Cookie', `${COOKIE_NAME}=${payload}.${sig}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800`);
    return res.status(200).json({ ok: true });
  }

  res.status(405).end();
}
