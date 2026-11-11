#!/usr/bin/env python3
"""Add pinned tool-model ordering to the scheduled refresh + DST-aware 02:07 ET crons."""
from pathlib import Path

# ── src/index.js: preserve curated tool order across auto-refresh ────────────
p = Path("src/index.js")
src = p.read_text()

old = """async function runScheduledUpdate(env) {
  const startedAt = new Date().toISOString();
  console.log(`[scheduled] Model catalog refresh started at ${startedAt}`);
  try {
    const catalog = await fetchModelCatalog(env);
    console.log(`[scheduled] Fetched ${catalog.length} models from catalog`);
    const { coding, general, tool, complex, detailed } = selectBestModels(catalog);
"""
assert src.count(old) == 1, f"Expected runScheduledUpdate head exactly once, found {src.count(old)}"

new = """// ─── Pinned model order (survives auto-refresh) ──────────────────────────────
// KV key per tier: if present, auto-refresh keeps the pinned models FIRST (in
// pinned order, dropping any no longer in the catalog) and appends the rest of
// the auto-selected models. Set via:
//   npx wrangler kv key put "router:tool_models_pinned" '[...]' --remote --binding=ROUTER_KV
const KV_PIN_KEYS = { tool: "router:tool_models_pinned" };

async function getPinnedModels(env, tier) {
  try {
    const raw = await kvGet(env, KV_PIN_KEYS[tier]);
    if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) return arr; }
  } catch {}
  return [];
}

async function runScheduledUpdate(env) {
  const startedAt = new Date().toISOString();
  console.log(`[scheduled] Model catalog refresh started at ${startedAt}`);
  try {
    const catalog = await fetchModelCatalog(env);
    console.log(`[scheduled] Fetched ${catalog.length} models from catalog`);
    const selected = selectBestModels(catalog);
    const { coding, general, complex, detailed } = selected;
    let tool = selected.tool;
    const pinned = await getPinnedModels(env, "tool");
    if (pinned.length) {
      const pinnedSet = new Set(pinned);
      const kept = pinned.filter((n) => tool.includes(n));
      const rest = tool.filter((n) => !pinnedSet.has(n));
      tool = [...kept, ...rest];
      console.log(`[scheduled] Tool tier: ${kept.length} pinned kept in curated order, ${rest.length} auto-selected appended${kept.length < pinned.length ? `, ${pinned.length - kept.length} pinned pruned (not in catalog)` : ""}`);
    }
"""
src = src.replace(old, new, 1)
p.write_text(src)
print("src/index.js: pinned tool-order merge added to runScheduledUpdate")

# ── wrangler.jsonc: DST-aware 02:07 ET daily refresh ─────────────────────────
w = Path("wrangler.jsonc")
wsrc = w.read_text()
oldc = """    "crons": [
      "6 4 * * *",
      "6 5 * * *",
      "*/5 * * * *"
    ]"""
assert wsrc.count(oldc) == 1, f"Expected old crons block exactly once, found {wsrc.count(oldc)}"
newc = """    "crons": [
      "7 7 * 11,12,1,2 *",
      "7 6 * 3-10 *",
      "*/5 * * * *"
    ]"""
wsrc = wsrc.replace(oldc, newc, 1)
w.write_text(wsrc)
print("wrangler.jsonc: crons -> 02:07 ET daily (DST-aware) + 5-min watchdog")
print("  7 7 * 11,12,1,2 *  = 07:07 UTC = 02:07 EST (Nov-Feb)")
print("  7 6 * 3-10 *       = 06:07 UTC = 02:07 EDT (Mar-Oct)")
