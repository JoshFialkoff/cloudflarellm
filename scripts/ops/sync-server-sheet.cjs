/**
 * Sync server health analysis rows to Google Sheets (service account).
 *
 * Env:
 *   GOOGLE_SERVICE_ACCOUNT_JSON — full JSON key for webhook-service-account@n8n-416-23.iam.gserviceaccount.com
 *   GOOGLE_SHEET_TAB — worksheet name (default: "Server health")
 *
 * Usage:
 *   node scripts/ops/sync-server-sheet.cjs --analysis reports/server-health/<stamp>/analysis.json
 *   node scripts/ops/sync-server-sheet.cjs --latest
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const INVENTORY = require("./server-inventory.json");

const SPREADSHEET_ID = "1MeALpdEOYb0IMjJGLd6f_dUDjms84JcmtQDafOCKTNM";
const SHEET_TAB = process.env.GOOGLE_SHEET_TAB || "Server health";
const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function loadCredentials() {
  const raw = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || "").trim();
  if (!raw) {
    throw new Error(
      "Missing GOOGLE_SERVICE_ACCOUNT_JSON (service account JSON for " +
        (INVENTORY.spreadsheetServiceAccountEmail || "the shared editor account") +
        "). Add as Cursor cloud agent secret — never commit or paste in chat.",
    );
  }
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  }
}

function base64url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

async function getAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: SCOPES.join(" "),
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const sign = crypto.createSign("RSA-SHA256");
  sign.update(unsigned);
  sign.end();
  const signature = sign
    .sign(creds.private_key)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const jwt = `${unsigned}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    throw new Error(`Google token exchange failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function sheetsFetch(token, urlPath, options = {}) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${urlPath}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Sheets API ${urlPath} failed (${res.status}): ${(await res.text()).slice(0, 400)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

async function ensureSheetTab(token) {
  const meta = await sheetsFetch(token, "?fields=sheets.properties(title,sheetId)");
  const existing = (meta.sheets || []).find((s) => s.properties?.title === SHEET_TAB);
  if (existing) return existing.properties.sheetId;

  const created = await sheetsFetch(token, ":batchUpdate", {
    method: "POST",
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: SHEET_TAB } } }],
    }),
  });
  return created.replies[0].addSheet.properties.sheetId;
}

function analysisToValues(analysis) {
  const header = [
    "ip",
    "hostname",
    "role",
    "status",
    "load_1m",
    "mem_used_pct",
    "disk_root_pct",
    "uptime_days",
    "needs_reboot",
    "issues",
    "checked_utc",
  ];
  const rows = (analysis.servers || []).map((r) => [
    r.ip,
    r.hostname,
    r.role,
    r.status,
    r.load_1m,
    r.mem_used_pct,
    r.disk_root_pct,
    r.uptime_days,
    r.needs_reboot,
    r.issues,
    r.checked_utc,
  ]);
  rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return [header, ...rows];
}

function resolveAnalysisPath(argv) {
  const idx = argv.indexOf("--analysis");
  if (idx >= 0) return path.resolve(argv[idx + 1]);
  if (argv.includes("--latest")) {
    const root = path.join(__dirname, "../../reports/server-health");
    const dirs = fs.existsSync(root)
      ? fs.readdirSync(root).filter((d) => fs.statSync(path.join(root, d)).isDirectory()).sort()
      : [];
    if (!dirs.length) throw new Error("No health snapshots found.");
    return path.join(root, dirs[dirs.length - 1], "analysis.json");
  }
  throw new Error("Usage: --latest | --analysis <path>");
}

async function main() {
  const analysisPath = resolveAnalysisPath(process.argv.slice(2));
  const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
  const creds = loadCredentials();

  if (
    INVENTORY.spreadsheetServiceAccountEmail &&
    creds.client_email !== INVENTORY.spreadsheetServiceAccountEmail
  ) {
    console.warn(
      `Warning: JSON client_email (${creds.client_email}) differs from inventory (${INVENTORY.spreadsheetServiceAccountEmail}).`,
    );
  }

  const token = await getAccessToken(creds);
  await ensureSheetTab(token);

  const values = analysisToValues(analysis);
  const range = `${SHEET_TAB}!A1`;
  await sheetsFetch(token, `/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ range, majorDimension: "ROWS", values }),
  });

  console.log(
    JSON.stringify({
      ok: true,
      spreadsheetId: SPREADSHEET_ID,
      tab: SHEET_TAB,
      rowsWritten: values.length - 1,
      url: INVENTORY.spreadsheetUrl,
      analysisPath,
    }),
  );
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
