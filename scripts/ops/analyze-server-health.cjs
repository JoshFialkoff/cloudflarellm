/**
 * Summarize server health JSON snapshots and suggest low-traffic reboot windows.
 *
 * Usage:
 *   node scripts/ops/analyze-server-health.mjs reports/server-health/<stamp>
 *   node scripts/ops/analyze-server-health.mjs --latest
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "../..");
const HEALTH_ROOT = path.join(ROOT, "reports/server-health");
const INVENTORY = require("./server-inventory.json");

function latestDir() {
  if (!fs.existsSync(HEALTH_ROOT)) return null;
  const dirs = fs
    .readdirSync(HEALTH_ROOT)
    .filter((d) => fs.statSync(path.join(HEALTH_ROOT, d)).isDirectory())
    .sort();
  return dirs.length ? path.join(HEALTH_ROOT, dirs[dirs.length - 1]) : null;
}

function readSnapshots(dir) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "run-meta.json")
    .map((f) => {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const hostKey = f.replace(/\.json$/, "");
      return { hostKey, ...raw };
    });
}

function memPct(totalKb, availKb) {
  if (!totalKb) return null;
  const used = totalKb - availKb;
  return Math.round((used / totalKb) * 100);
}

function uptimeDays(sec) {
  return sec == null ? null : Math.round((sec / 86400) * 10) / 10;
}

function severity(row) {
  const issues = [];
  if (row.disk_root_pct >= 90) issues.push("disk_critical");
  else if (row.disk_root_pct >= 80) issues.push("disk_warn");
  const memUsed = memPct(row.mem_total_kb, row.mem_available_kb);
  if (memUsed != null && memUsed >= 90) issues.push("mem_critical");
  else if (memUsed != null && memUsed >= 80) issues.push("mem_warn");
  if (row.load_1m != null && row.mem_total_kb) {
    const coresGuess = Math.max(1, Math.round(row.mem_total_kb / 1024 / 1024));
    if (row.load_1m > coresGuess * 1.5) issues.push("load_high");
  }
  if (row.needs_reboot) issues.push("reboot_required");
  if (row.error) issues.push("unreachable");
  return issues;
}

function rebootWindowNote() {
  // Generic UTC guidance until per-server access logs are collected post-approval.
  return {
    recommendedUtc: "04:00–06:00 UTC (Sun–Wed)",
    rationale:
      "Default low-traffic window for US/EU sites until nginx/apache/docker access logs are analyzed per host.",
    nextStep:
      "After !!APPROVED, run scripts/ops/analyze-traffic-windows.sh on each host to refine.",
  };
}

function toSpreadsheetRow(serverMeta, snap) {
  const memUsed = memPct(snap.mem_total_kb, snap.mem_available_kb);
  return {
    server: serverMeta?.id || snap.hostKey,
    host: serverMeta?.host || "",
    role: serverMeta?.role || "",
    status: snap.error ? "unreachable" : severity(snap).length ? "attention" : "ok",
    load_1m: snap.load_1m ?? "",
    mem_used_pct: memUsed ?? "",
    disk_root_pct: snap.disk_root_pct ?? "",
    uptime_days: uptimeDays(snap.uptime_seconds) ?? "",
    needs_reboot: snap.needs_reboot ? "yes" : "no",
    issues: severity(snap).join(", "),
    checked_utc: snap.timestamp_utc || "",
  };
}

function main() {
  const arg = process.argv[2];
  const dir = arg === "--latest" || !arg ? latestDir() : path.resolve(arg);
  if (!dir || !fs.existsSync(dir)) {
    console.error("No health snapshot directory found.");
    process.exit(1);
  }

  const snaps = readSnapshots(dir);
  const byHost = Object.fromEntries(INVENTORY.servers.map((s) => [s.alias || s.id, s]));

  const rows = snaps.map((snap) => {
    const meta = byHost[snap.hostKey] || byHost[snap.host];
    const issues = severity(snap);
    return {
      ...toSpreadsheetRow(meta, snap),
      rebootWindow: issues.includes("reboot_required") ? rebootWindowNote() : null,
    };
  });

  const summary = {
    collectedFrom: dir,
    keystashUser: INVENTORY.keystashUsername,
    spreadsheetUrl: INVENTORY.spreadsheetUrl,
    approvalRequired: INVENTORY.approvalToken,
    servers: rows,
    actionsPendingApproval: rows
      .filter((r) => r.issues.includes("reboot_required") || r.issues.includes("disk_critical"))
      .map((r) => ({
        server: r.server,
        issue: r.issues,
        suggestedAction:
          r.issues.includes("disk_critical")
            ? "Investigate disk usage; cleanup before reboot"
            : "Schedule maintenance reboot",
        rebootWindow: rebootWindowNote(),
      })),
  };

  const outJson = path.join(dir, "analysis.json");
  fs.writeFileSync(outJson, JSON.stringify(summary, null, 2));

  const csvHeader =
    "server,host,role,status,load_1m,mem_used_pct,disk_root_pct,uptime_days,needs_reboot,issues,checked_utc";
  const csv = [
    csvHeader,
    ...rows.map((r) =>
      [
        r.server,
        r.host,
        r.role,
        r.status,
        r.load_1m,
        r.mem_used_pct,
        r.disk_root_pct,
        r.uptime_days,
        r.needs_reboot,
        r.issues,
        r.checked_utc,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(","),
    ),
  ].join("\n");
  fs.writeFileSync(path.join(dir, "spreadsheet-import.csv"), csv);

  console.log(JSON.stringify(summary, null, 2));
}

main();
