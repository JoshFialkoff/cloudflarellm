const { execFileSync } = require("node:child_process");

function wrangler(args) {
  const out = execFileSync("npx", ["wrangler", ...args, "--binding=ROUTER_KV", "--config", "wrangler.jsonc"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  return out.trim();
}

const kvGet = (key) => wrangler(["kv", "key", "get", key, "--remote"]);
const kvPut = (key, val, remote) => wrangler(["kv", "key", "put", key, val, ...(remote ? ["--remote"] : [])]);

const deepseek = "@cf/deepseek-ai/deepseek-v4-flash-0731";
const kimi = "@cf/moonshotai/kimi-k2.7-code";
const gpt = "@cf/openai/gpt-oss-120b";

// ── router:tool_models ───────────────────────────────────────────────────────
const models = JSON.parse(kvGet("router:tool_models"));
if (!Array.isArray(models)) throw new Error("router:tool_models is not a JSON array");
const others = models.filter((m) => ![deepseek, kimi, gpt].includes(m));
if (others.length < 3) throw new Error(`Need at least 3 other models to place ${gpt} at #6, found ${others.length}`);
const ordered = [deepseek, kimi, ...others.slice(0, 3), gpt, ...others.slice(3)];
if (ordered[5] !== gpt) throw new Error("Sanity check failed: gpt-oss-120b not at position 6");
kvPut("router:tool_models", JSON.stringify(ordered), true);
console.log(`tool_models: ${models.length} -> ${ordered.length} models; #1=${ordered[0].split("/").pop()}, #2=${ordered[1].split("/").pop()}, #6=${ordered[5].split("/").pop()}`);

// ── router:enforce ───────────────────────────────────────────────────────────
const rules = JSON.parse(kvGet("router:enforce"));
if (!Array.isArray(rules)) throw new Error("router:enforce is not a JSON array");
const updated = [
  ...rules.filter((r) => !(r && r.pattern === "*" && r.tier === "complex")),
  { pattern: "*", tier: "complex" },
];
kvPut("router:enforce", JSON.stringify(updated), true);
console.log(`enforce: ${rules.length} -> ${updated.length} rules; last=${JSON.stringify(updated[updated.length - 1])}`);

// ── mirror to local miniflare store so wrangler dev matches production ──────
kvPut("router:tool_models", JSON.stringify(ordered), false);
kvPut("router:enforce", JSON.stringify(updated), false);

// ── read-back verification (remote) ──────────────────────────────────────────
const verifyModels = JSON.parse(kvGet("router:tool_models"));
if (verifyModels[0] !== deepseek || verifyModels[1] !== kimi || verifyModels[5] !== gpt) {
  throw new Error("Read-back verification FAILED for router:tool_models");
}
const verifyRules = JSON.parse(kvGet("router:enforce"));
const last = verifyRules[verifyRules.length - 1];
if (!last || last.pattern !== "*" || last.tier !== "complex") {
  throw new Error("Read-back verification FAILED for router:enforce");
}
console.log("VERIFIED: remote KV read-back matches expected state");
