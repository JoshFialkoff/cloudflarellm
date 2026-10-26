// ─────────────────────────────────────────────────────────────────────────────
// smart-llm-router — Cloudflare Workers (v17)
//
// Routes every prompt to the best LLM for the task with tiers:
//   coding / general / tool / complex (research & agentic)
// Reliability fixes in this version:
//   • Bulletproof message normalization — Goose sends content as arrays,
//     nulls, tool messages, and "developer" role; these used to 400 at the
//     model API ("oneOf at '/' not met"). Now every message is coerced to a
//     clean { role, content: string|null, tool_calls?, tool_call_id?, name? }
//     and malformed messages are DROPPED instead of forwarded.
//   • Output budget raised (was capped at 2048 tokens → token-limit deaths).
//   • New "complex" tier for research/agentic tasks (web research, scraping,
//     lead gen, contact-detail extraction) routed to the strongest models.
//   • Ops endpoints: /v1/classify (dry-run routing), /v1/logs (request log),
//     /v1/enforce (KV routing rules — no redeploy), /v1/report (CSV for
//     Google Sheets).
// ─────────────────────────────────────────────────────────────────────────────

import { getSandbox, Sandbox } from "@cloudflare/sandbox";

export { Sandbox };


// ─── Sandbox SDK 1.0 (Durable Object container) ───────────────────────────────

// ─── Model Router: per-tier model lists ───────────────────────────────────────

const CODING_MODELS_FALLBACK = [
  "@cf/deepseek-ai/deepseek-v4-flash-0731",
  "@cf/moonshotai/kimi-k2.7-code",
  "@cf/openai/gpt-oss-120b",
];

const GENERAL_MODELS_FALLBACK = [
  "@cf/zai-org/glm-4.7-flash",
  "@cf/openai/gpt-oss-120b",
  "@cf/moonshotai/kimi-k2.6",
];

const TOOL_MODELS_FALLBACK = [
  "@cf/moonshotai/kimi-k2.6",
  "@cf/openai/gpt-oss-120b",
];

// Strongest models for research / agentic / multi-step tasks (web research,
// scraping, lead gen, enrichment, long scripts, contact extraction).
const COMPLEX_MODELS_FALLBACK = [
  "@cf/openai/gpt-oss-120b",
  "@cf/moonshotai/kimi-k2.7-code",
  "@cf/zai-org/glm-5.3",
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
];

const PREFERRED_CODING_MODELS = [
  "@cf/deepseek-ai/deepseek-v4-flash-0731",
  "@cf/moonshotai/kimi-k2.7-code",
  "@cf/openai/gpt-oss-120b",
  "@cf/zai-org/glm-5.3",
  "@cf/zai-org/glm-5.3-flash",
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
];

const PREFERRED_GENERAL_MODELS = [
  "@cf/zai-org/glm-4.7-flash",
  "@cf/openai/gpt-oss-120b",
  "@cf/moonshotai/kimi-k2.6",
  "@cf/zai-org/glm-5.3-flash",
];

const PREFERRED_TOOL_MODELS = [
  "@cf/moonshotai/kimi-k2.6",
  "@cf/openai/gpt-oss-120b",
  "@cf/zai-org/glm-5.3",
];

const PREFERRED_COMPLEX_MODELS = [
  "@cf/openai/gpt-oss-120b",
  "@cf/moonshotai/kimi-k2.7-code",
  "@cf/zai-org/glm-5.3",
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
];

const KV_MODELS_KEY = "router:models";
const KV_CODING_KEY = "router:coding_models";
const KV_GENERAL_KEY = "router:general_models";
const KV_TOOL_KEY = "router:tool_models";
const KV_COMPLEX_KEY = "router:complex_models";
const KV_ENFORCE_KEY = "router:enforce";
const KV_LOGS_KEY = "logs:recent";

const CAPACITY_RETRIES = 2;
const CAPACITY_RETRY_DELAY = 200;
const DEFAULT_MAX_TOKENS = 8192;
const COMPLEX_MAX_TOKENS = 16384;
const MAX_CONTINUATIONS = 3;
const CF_MODEL_MAX_CONTEXT = 24e3;
const MAX_ALLOWED_PROMPT_TOKENS = 28e3;
const MAX_LOG_ENTRIES = 200;

// Neutral default injected only when the caller sends no system message
// (Goose always sends its own system prompt, which we never override).
const ROUTER_DEFAULT_SYSTEM_PROMPT =
  "You are a helpful, expert AI assistant. Follow the user's instructions carefully. Be concise but thorough, and follow modern best practices. Prefer short, direct answers: no preamble, no re-stating the question, no filler, no bullet-point summaries unless the user asks for them. Answer in the fewest words that fully satisfy the request.";

// System prompt for the shell-agent endpoint (/agent)
const AGENT_SYSTEM_PROMPT = `You are an AI coding assistant that executes tasks by writing shell commands.

RULES (mandatory):
1. You MUST output shell commands inside fenced code blocks tagged \`\`\`bash or \`\`\`sh.
2. You MUST NOT output code in any other language block. All work goes through the shell.
3. You can run any command available in a Linux environment: git, curl, python3, node, npm, pip, cat, ls, mkdir, etc.
4. Write files using heredocs or tee. Run scripts with python3 or node.
5. After each command block, the system will execute it and return stdout/stderr.
6. Read the output, then continue with the next step or declare completion.
7. Keep each command block focused — one logical step per block.
8. If a command fails, read the error, fix it, and retry.
9. When the task is fully complete AND you have verified the deliverable (e.g. run \`cat\`/\`ls\` on files you wrote, or show the final data), respond with exactly: TASK_COMPLETE.
10. NEVER declare TASK_COMPLETE after only planning or checking tools. You must run the actual commands that produce the requested output and verify it first.

CRITICAL: Do NOT explain your reasoning before commands. Start EVERY response with a \`\`\`bash code block immediately. No preamble, no "Let me check...", no "I'll now...". Just the command.
If you need to check what tools are available, run \`which git node python3 npm curl\` once in your first command block, then proceed.

TERSENESS (mandatory):
- Output ONLY the code block. Zero prose before, between, or after commands.
- Never narrate, never summarize, never say "Done" or "Output:". The command output speaks for itself.
- Combine trivial steps into a single command (e.g. mkdir -p x && cd x && curl ...).
- Do not echo back the task or restate what you did.`;

// ─── Task classification patterns (from smart-llm-router v14) ────────────────

// Research / agentic / data-gathering prompts → "complex" tier (strongest models).
const RESEARCH_PATTERNS = [
  /\b(research|investigate|analyse|analyze|study)\b/i,
  /\b(web ?search|google|search the web|browse|look up|find online|find out)\b/i,
  /\b(scrape|scraping|crawl|crawling|extract|harvest|data mining|collect data|gather data)\b/i,
  /\b(lead ?gen|prospect|prospecting|outreach|enrichment|enrich|enriching)\b/i,
  /\b(contact details|contact info|email address|phone number|phone numbers|addresses|website urls?|websites?)\b.*\b(agency|agencies|company|companies|business|businesses|clinic|clinics|facility|facilities|vendor|vendors|provider|providers)\b/i,
  /\b(independent|locally owned|local|small|privately held|family[- ]owned|non[- ]franchise|not owned)\b.*\b(agency|agencies|company|companies|business|businesses)\b/i,
  /\b(home health|ehr|healthcare|health care|medicare|medicaid|registry|licens|certif|accredit)\b/i,
  /\b(firecrawl|dataforseo|serp|backlink|keyword research|google sheets|spreadsheet|csv|database)\b/i,
  /\b(list of|directory|find all|find every|all of the|complete list|every single)\b/i,
  /\b(compare|comparison|market|industry|competitor|competitive intelligence|tam|sam)\b/i,
  /\b(reach out|contact them|pitch|subscribe|sell to|market to|target these|onboard)\b/i,
  /\b(price|pricing|cost|rates|revenue|profit|funding|valuation|acquisition|owned by)\b/i,
  /\b(credentials|payor|payer|reimbursement|prior auth|authorization|referral|referrals)\b/i,
];

const CODING_PATTERNS = [
  /\b(javascript|typescript|python|java|go|rust|c\+\+|ruby|php|kotlin|swift|scala)\b/i,
  /\b(node\.?js|deno|bun|next\.?js|nuxt|react|vue|angular|svelte|express|fastify|hono)\b/i,
  /\.(js|ts|tsx|jsx|py|rb|go|rs|java|c|cpp|h|php|vue|svelte|css|scss|html|json|yaml|yml|toml|sql)\b/i,
  /\b(import|export|require|const|let|var|function|class|interface|type|enum|async|await|return|if|else|for|while|switch|case|break|continue|throw|try|catch|finally|new|this|super|extends|implements|static|public|private|protected|void|null|undefined|true|false)\b/i,
  /\b(useState|useEffect|useRef|useMemo|useCallback|useContext|createContext|ReactDOM|render|component|props|hook|middleware|endpoint|handler|route|schema|migration|query|mutation)\b/i,
  /```(javascript|js|typescript|ts|python|py|bash|shell|go|rust|java|c\+\+|html|css|sql|json|yaml)\b/i,
  /\b(create|write|build|implement|refactor|debug|fix|optimize|deploy|compile|transpile|lint|test|unit test)\b.*\b(code|function|component|module|file|class|script|app|application|api|backend|frontend|server|client)\b/i,
  /\b(code|function|component|module|file|class|script|app|application|api|backend|frontend|server|client)\b.*\b(create|write|build|implement|refactor|debug|fix|optimize|deploy|compile|transpile|lint|test|unit test)\b/i,
  /\b(git|npm|yarn|pnpm|pip|cargo|go mod|composer|maven|gradle|docker|kubernetes|kubectl)\b/i,
  /\b(package\.json|tsconfig\.json|wrangler\.toml|next\.config|webpack\.config|vite\.config|Dockerfile|docker-compose|\.env)\b/i,
  /\b(SELECT|INSERT|UPDATE|DELETE|CREATE TABLE|ALTER TABLE|JOIN|WHERE|GROUP BY|ORDER BY|LIMIT|INDEX|PRIMARY KEY|FOREIGN KEY)\b/i,
  /\b(regex|grep|sed|awk|curl|wget|chmod|mkdir|cd |ls |cat |echo |export |sudo)\b/i,
  /\b(python[23]?|node(?:js)?\d*|golang|deno|bun|npx|pip3?|npm|yarn|pnpm)\b/i,
  /\b(fibonacci|factorial|palindrome|anagram|fizzbuzz|prime|primes|collatz|recursion|recursive|algorithm|algorithms|binary search|tree traversal|depth-first|breadth-first|dynamic programming|sort|sorted|sorting|reverse|linked list|binary tree|hash table|hashmap|dictionary|array|arrays|string manipulation)\b/i,
  /\busing\s+(python[23]?|node(?:js)?\d*|javascript|typescript|java|go|golang|rust|c\+\+|ruby|php|kotlin|swift|scala|bash|sql)\b/i,
  /\b(print|compute|calculate|find|generate|return|implement|write|solve|convert)\b.*\b(number|numbers|sequence|series|list|array|string|value|result|output|sum|total)\b/i,
  /\b(frontend|backend|fullstack|full-stack|server-side|client-side|SSR|SSG|API route|REST|GraphQL|gRPC|WebSocket)\b/i,
];

function classifyPrompt(messages) {
  const text = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => extractMessageContent(m.content))
    .join("\n");

  let codingScore = 0;
  for (const pattern of CODING_PATTERNS) {
    const matches = text.match(new RegExp(pattern.source, pattern.flags));
    if (matches) codingScore += matches.length;
  }

  let researchScore = 0;
  for (const pattern of RESEARCH_PATTERNS) {
    // Count distinct pattern families (not capture groups) to avoid inflation.
    if (text.match(new RegExp(pattern.source, pattern.flags))) researchScore += 1;
  }

  const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
  if (lastUserMsg) {
    const lastText = extractMessageContent(lastUserMsg.content);
    if (/```/.test(lastText) && /\b(javascript|js|typescript|ts|python|py|jsx|tsx|bash|shell|go|rust|java)\b/i.test(lastText)) {
      codingScore += 5;
    }
  }

  const isCoding = codingScore >= 3;
  // Research/agentic tasks win over coding — they need the strongest models.
  const baseTier = researchScore >= 2 ? "complex" : isCoding ? "coding" : "general";
  console.log(`[classifier] codingScore=${codingScore} researchScore=${researchScore} baseTier=${baseTier} textLen=${text.length}`);
  return { isCoding, codingScore, researchScore, baseTier };
}

// ─── Generic helpers ──────────────────────────────────────────────────────────

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}

function apiHeaders(extra = {}) {
  return {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
    ...extra,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function safeTrim(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value).trim();
    } catch {
      return "";
    }
  }
  return String(value).trim();
}

function extractMessageContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && part.type === "text") return part.text || "";
        return "";
      })
      .join(" ");
  }
  return safeTrim(content);
}

function estimateTokens(messages, tools) {
  let chars = JSON.stringify(messages).length;
  if (tools) chars += JSON.stringify(tools).length;
  return Math.ceil(chars / 3);
}

function fitToContextWindow(messages, maxAllowedPromptTokens = MAX_ALLOWED_PROMPT_TOKENS) {
  if (messages.length <= 2) return messages;
  const systemMessages = messages.filter((m) => m.role === "system");
  let otherMessages = messages.filter((m) => m.role !== "system");
  while (estimateTokens([...systemMessages, ...otherMessages]) > maxAllowedPromptTokens && otherMessages.length > 2) {
    otherMessages.shift();
  }
  return [...systemMessages, ...otherMessages];
}

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  const out = [];
  for (const m of messages) {
    if (!m || typeof m !== "object") continue; // drop malformed messages
    let role = m.role;
    if (role === "developer") role = "system"; // OpenAI "developer" → Workers "system"
    if (!["system", "user", "assistant", "tool"].includes(role)) role = "user";
    const hasToolCalls = Array.isArray(m.tool_calls) && m.tool_calls.length > 0;
    let content;
    if (m.content !== undefined && m.content !== null) {
      content = stringifyContentPart(m.content);
    } else if (hasToolCalls) {
      content = null; // null content is only legal on assistant tool_calls messages
    } else {
      content = "";
    }
    const normalized = { role, content };
    if (hasToolCalls) normalized.tool_calls = m.tool_calls;
    if (m.tool_call_id) normalized.tool_call_id = m.tool_call_id;
    if (m.name) normalized.name = m.name;
    out.push(normalized);
  }
  return out;
}

// Recursively coerce any content shape (arrays, {type:"text"...}, tool_result
// blocks, objects) into a plain string — fixes "array not in string" 400s.
function stringifyContentPart(part) {
  if (typeof part === "string") return part;
  if (part === null || part === undefined) return "";
  if (Array.isArray(part)) {
    return part.map(stringifyContentPart).join("");
  }
  if (typeof part === "object") {
    if (typeof part.text === "string") return part.text;
    if (part.type === "tool_result" || part.type === "toolResult") {
      return part.content === undefined || part.content === null ? "" : stringifyContentPart(part.content);
    }
    try {
      return JSON.stringify(part);
    } catch {
      return "";
    }
  }
  return String(part);
}

// ─── Enforcement rules (KV-backed, no redeploy) ───────────────────────────────

async function getEnforceRules(env) {
  try {
    const raw = await kvGet(env, KV_ENFORCE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

// Returns { tier, rule } when a rule matches the conversation text, else null.
async function applyEnforceRules(env, messages, currentTier) {
  const rules = await getEnforceRules(env);
  if (!rules.length) return null;
  const text = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => extractMessageContent(m.content))
    .join("\n");
  for (const rule of rules) {
    if (!rule || !rule.pattern) continue;
    let hit = false;
    if (rule.pattern === "*") {
      hit = true;
    } else {
      try {
        hit = new RegExp(rule.pattern, "i").test(text);
      } catch {
        hit = text.toLowerCase().includes(String(rule.pattern).toLowerCase());
      }
    }
    if (hit) return { tier: rule.tier, rule: rule.pattern };
  }
  return null;
}

// ─── Output budget: raise the old 2048 cap; use catalog context windows ──────

async function outputBudget(env, modelId, promptTokens, tier, requestedMax = null) {
  const maxForTier = tier === "complex" ? COMPLEX_MAX_TOKENS : DEFAULT_MAX_TOKENS;
  let contextWindow = CF_MODEL_MAX_CONTEXT;
  try {
    const kvData = await kvGet(env, KV_MODELS_KEY);
    if (kvData) {
      const catalog = JSON.parse(kvData);
      const meta = (catalog.models || []).find((m) => m.name === modelId);
      if (meta && meta.context_window) contextWindow = Number(meta.context_window) || contextWindow;
    }
  } catch {}
  const available = Math.max(512, contextWindow - promptTokens - 200);
  // Explicit client request (e.g. agent terse cap 4096) wins over tier default,
  // but never exceeds what the model context window can actually hold.
  const cap = requestedMax ? Math.min(maxForTier, requestedMax) : maxForTier;
  return Math.min(cap, available);
}

// ─── Request logging (KV ring; errors/enforcement always, everything w/ LOG_ALL) ──

async function logRequest(env, entry) {
  if (!env.ROUTER_KV) return;
  const logAll = env.LOG_ALL === "true";
  const alwaysLog = (entry.errors && entry.errors.length > 0) || entry.enforced || entry.tokenLimitHit;
  if (!logAll && !alwaysLog) return;
  try {
    const raw = await kvGet(env, KV_LOGS_KEY);
    let logs = [];
    try {
      logs = raw ? JSON.parse(raw) : [];
    } catch {
      logs = [];
    }
    if (!Array.isArray(logs)) logs = [];
    logs.unshift(entry);
    if (logs.length > MAX_LOG_ENTRIES) logs = logs.slice(0, MAX_LOG_ENTRIES);
    await kvPut(env, KV_LOGS_KEY, JSON.stringify(logs));
  } catch {}
}

function isRetryableError(e) {
  const m = (e?.message || String(e)).toLowerCase();
  return m.includes("3040") || m.includes("capacity") || m.includes("temporarily");
}

function isFallthroughError(e) {
  const m = (e?.message || String(e)).toLowerCase();
  return m.includes("3030") || m.includes("internal server error");
}

function isContextOverflowError(e) {
  const m = (e?.message || String(e)).toLowerCase();
  return m.includes("5021") || m.includes("8007") || m.includes("context window") || m.includes("exceeded") || m.includes("maximum context");
}

function extractCodeBlocks(text) {
  const blocks = [];
  const regex = /```(?:bash|sh|shell)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) blocks.push(match[1].trim());
  return blocks;
}

function isTaskComplete(text) {
  return /\bTASK_COMPLETE\b/i.test(text);
}

// ─── Model catalog (KV-cached) ────────────────────────────────────────────────

async function getCodingModels(env) {
  const kv = await kvGet(env, KV_CODING_KEY);
  if (kv) {
    try {
      const arr = JSON.parse(kv);
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
  }
  return CODING_MODELS_FALLBACK;
}

async function getGeneralModels(env) {
  const kv = await kvGet(env, KV_GENERAL_KEY);
  if (kv) {
    try {
      const arr = JSON.parse(kv);
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
  }
  return GENERAL_MODELS_FALLBACK;
}

async function getToolModels(env) {
  const kv = await kvGet(env, KV_TOOL_KEY);
  if (kv) {
    try {
      const arr = JSON.parse(kv);
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
  }
  return TOOL_MODELS_FALLBACK;
}

async function getComplexModels(env) {
  const kv = await kvGet(env, KV_COMPLEX_KEY);
  if (kv) {
    try {
      const arr = JSON.parse(kv);
      if (Array.isArray(arr) && arr.length) return arr;
    } catch {}
  }
  return COMPLEX_MODELS_FALLBACK;
}

async function getAllModels(env) {
  const [coding, general, tool, complex] = await Promise.all([
    getCodingModels(env),
    getGeneralModels(env),
    getToolModels(env),
    getComplexModels(env),
  ]);
  return [...new Set([...coding, ...general, ...tool, ...complex])];
}

async function fetchModelCatalog(env) {
  const token = await getToken(env);
  if (!token) throw new Error("No API token available for model catalog fetch");

  const allModels = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 10) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/ai/models/search?task=Text%20Generation&per_page=100&page=${page}&hide_experimental=true`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
    if (!resp.ok) throw new Error(`Model catalog fetch failed: ${resp.status} ${resp.statusText}`);
    const data = await resp.json();
    if (!data.success || !Array.isArray(data.result)) break;
    allModels.push(...data.result);
    hasMore = data.result.length === 100;
    page++;
  }

  return allModels;
}

function filterToAvailable(preferred, catalogNames) {
  return preferred.filter((name) => catalogNames.has(name));
}

function selectBestModels(catalog) {
  const catalogNames = new Set(catalog.map((m) => m.name));
  const modelMap = new Map(catalog.map((m) => [m.name, m]));

  let coding = filterToAvailable(PREFERRED_CODING_MODELS, catalogNames);
  let general = filterToAvailable(PREFERRED_GENERAL_MODELS, catalogNames);
  let tool = filterToAvailable(PREFERRED_TOOL_MODELS, catalogNames);
  let complex = filterToAvailable(PREFERRED_COMPLEX_MODELS, catalogNames);

  const known = new Set([...PREFERRED_CODING_MODELS, ...PREFERRED_GENERAL_MODELS, ...PREFERRED_TOOL_MODELS, ...PREFERRED_COMPLEX_MODELS]);
  const newModels = catalog.filter((m) => {
    if (known.has(m.name)) return false;
    const props = m.properties || [];
    const hasFC = props.some((p) => p.property_id === "function_calling" && p.value === "true");
    const hasReasoning = props.some((p) => p.property_id === "reasoning" && p.value === "true");
    const isLora = props.some((p) => p.property_id === "lora" && p.value === "true");
    const isGuard = m.tags && m.tags.some((t) => ["moderation", "safety", "content-filtering", "guardrails"].includes(t));
    return !isLora && !isGuard && (hasFC || hasReasoning);
  });

  for (const m of newModels) {
    const props = m.properties || [];
    const hasFC = props.some((p) => p.property_id === "function_calling" && p.value === "true");
    const desc = (m.description || "").toLowerCase();
    if (desc.includes("code") || desc.includes("coding") || desc.includes("agentic")) {
      coding.push(m.name);
    } else {
      general.push(m.name);
    }
    if (hasFC) tool.push(m.name);
    if (desc.includes("agentic") || desc.includes("reasoning") || desc.includes("research") || desc.includes("tool use")) {
      complex.push(m.name);
    }
  }

  const allNames = [...new Set([...coding, ...general, ...tool, ...complex])];
  const detailed = allNames.map((name) => {
    const m = modelMap.get(name);
    if (!m) return { name, description: "", context_window: null, function_calling: false, reasoning: false };
    const props = m.properties || [];
    return {
      name: m.name,
      description: m.description || "",
      created_at: m.created_at || "",
      context_window: props.find((p) => p.property_id === "context_window")?.value || null,
      function_calling: props.some((p) => p.property_id === "function_calling" && p.value === "true"),
      reasoning: props.some((p) => p.property_id === "reasoning" && p.value === "true"),
    };
  });

  return { coding, general, tool, detailed };
}

async function runScheduledUpdate(env) {
  const startedAt = new Date().toISOString();
  console.log(`[scheduled] Model catalog refresh started at ${startedAt}`);

  try {
    const catalog = await fetchModelCatalog(env);
    console.log(`[scheduled] Fetched ${catalog.length} models from catalog`);

    const { coding, general, tool, complex, detailed } = selectBestModels(catalog);
    console.log(`[scheduled] Selected ${detailed.length} models: coding=${coding.length} general=${general.length} tool=${tool.length} complex=${complex.length}`);

    const kvData = {
      updated_at: startedAt,
      model_count: detailed.length,
      coding_models: coding,
      general_models: general,
      tool_models: tool,
      complex_models: complex,
      models: detailed,
    };

    await kvPut(env, KV_MODELS_KEY, JSON.stringify(kvData));
    await kvPut(env, KV_CODING_KEY, JSON.stringify(coding));
    await kvPut(env, KV_GENERAL_KEY, JSON.stringify(general));
    await kvPut(env, KV_TOOL_KEY, JSON.stringify(tool));
    await kvPut(env, KV_COMPLEX_KEY, JSON.stringify(complex));

    console.log(`[scheduled] Model catalog refresh complete. Stored ${detailed.length} models to KV.`);
    return { success: true, model_count: detailed.length, coding: coding.length, general: general.length, tool: tool.length, complex: complex.length, updated_at: startedAt };
  } catch (err) {
    console.error(`[scheduled] Model catalog refresh failed: ${err.message}`);
    return { success: false, error: err.message, updated_at: startedAt };
  }
}

// ─── LLM calls via Cloudflare REST (OpenAI-compatible) ────────────────────────

// Token for Cloudflare API calls. Supports either:
//   • a plain Worker secret (string binding), or
//   • a Secrets Store binding (object with .get()).
async function getToken(env) {
  const binding = env.CLOUDFLARE_API_KEY;
  if (!binding) return null;
  if (typeof binding === "string") return binding;
  if (binding && typeof binding.get === "function") return await binding.get();
  return null;
}

// KV access that gracefully degrades when the binding is absent or errors.
async function kvGet(env, key) {
  if (!env.ROUTER_KV) return null;
  try {
    return await env.ROUTER_KV.get(key);
  } catch {
    return null;
  }
}

async function kvPut(env, key, value) {
  if (!env.ROUTER_KV) return;
  try {
    await env.ROUTER_KV.put(key, value);
  } catch {}
}

async function callModelViaBinding(env, modelId, runParams, stream) {
  const input = {
    messages: runParams.messages,
    max_tokens: runParams.max_tokens || DEFAULT_MAX_TOKENS,
    stream: stream,
  };
  if (runParams.temperature !== undefined) input.temperature = runParams.temperature;
  if (runParams.top_p !== undefined) input.top_p = runParams.top_p;
  if (runParams.tools) input.tools = runParams.tools;
  if (runParams.tool_choice !== undefined) input.tool_choice = runParams.tool_choice;
  if (runParams.response_format) input.response_format = runParams.response_format;
  if (runParams.frequency_penalty !== undefined) input.frequency_penalty = runParams.frequency_penalty;
  if (runParams.presence_penalty !== undefined) input.presence_penalty = runParams.presence_penalty;
  if (runParams.stop) input.stop = runParams.stop;
  if (runParams.seed !== undefined) input.seed = runParams.seed;
  const result = await env.AI.run(modelId, input);
  if (stream) {
    return new Response(result, {
      status: 200,
      headers: { "content-type": "text/event-stream" }
    });
  }
  if (result.choices) return result;
  return {
    id: "chatcmpl-" + Date.now(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: modelId,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: result.response || null,
        ...(result.tool_calls ? { tool_calls: result.tool_calls } : {})
      },
      finish_reason: result.tool_calls ? "tool_calls" : "stop"
    }],
    usage: result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
  };
}

async function callModelViaREST(env, modelId, runParams, stream) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/ai/v1/chat/completions`;
  const body = {
    model: modelId,
    messages: runParams.messages,
    max_tokens: runParams.max_tokens || DEFAULT_MAX_TOKENS,
    stream,
  };
  if (runParams.temperature !== undefined) body.temperature = runParams.temperature;
  if (runParams.top_p !== undefined) body.top_p = runParams.top_p;
  if (runParams.tools) body.tools = runParams.tools;
  if (runParams.tool_choice !== undefined) body.tool_choice = runParams.tool_choice;
  if (runParams.response_format) body.response_format = runParams.response_format;
  if (runParams.frequency_penalty !== undefined) body.frequency_penalty = runParams.frequency_penalty;
  if (runParams.presence_penalty !== undefined) body.presence_penalty = runParams.presence_penalty;
  if (runParams.stop) body.stop = runParams.stop;
  if (runParams.seed !== undefined) body.seed = runParams.seed;

  const token = await getToken(env);
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  if (env.GATEWAY_ID) headers["cf-aig-gateway-id"] = env.GATEWAY_ID;

  const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`REST API error ${resp.status}: ${t.substring(0, 500)}`);
  }
  if (stream) {
    const ct = resp.headers.get("content-type") || "";
    if (ct.includes("text/event-stream")) {
      return { body: resp.body, stream: true };
    }
    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { error: text };
    }
    throw new Error(data?.error?.message || data?.error || data?.message || `REST API streaming not supported: ${resp.status}`);
  }
  const data = JSON.parse(await resp.text());
  if (data.choices) return data;
  if (data.result && data.success) return data.result;
  return data;
}

async function runModelWithRetry(env, modelId, runParams, stream) {
  let lastError;
  for (let attempt = 0; attempt <= CAPACITY_RETRIES; attempt++) {
    try {
      return await callModelViaBinding(env, modelId, runParams, stream);
    } catch (e) {
      lastError = e;
      if (isContextOverflowError(e)) throw e;
      if (isFallthroughError(e)) throw e;
      if (isRetryableError(e) && attempt < CAPACITY_RETRIES) {
        await sleep(CAPACITY_RETRY_DELAY);
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

async function runModelWithContinuation(env, modelId, runParams) {
  let allContent = "";
  let allToolCalls = [];
  let responseId = null;
  let created = null;
  let lastFinishReason = null;
  let continuationCount = 0;
  let currentMessages = runParams.messages.slice();
  let tokenLimitHit = false;

  while (continuationCount <= MAX_CONTINUATIONS) {
    const response = await runModelWithRetry(env, modelId, { ...runParams, messages: currentMessages }, false);
    const choice = response?.choices?.[0];
    if (!choice) throw new Error("No choices in response");
    const content = choice.message?.content ?? null;
    const toolCalls = choice.message?.tool_calls ?? null;
    const finishReason = choice.finish_reason || (toolCalls ? "tool_calls" : "stop");
    if (!responseId) responseId = response?.id;
    if (!created) created = response?.created;
    lastFinishReason = finishReason;
    if (content) allContent += content;
    if (toolCalls) allToolCalls = allToolCalls.concat(toolCalls);
    console.log(`Model ${modelId}: contentLen=${allContent?.length || 0} finish=${finishReason} continuation=${continuationCount}`);
    if (finishReason !== "length") break;
    tokenLimitHit = true;
    if (toolCalls) break;
    if (!content) break;
    continuationCount++;
    currentMessages = runParams.messages.slice();
    currentMessages.push({ role: "assistant", content: allContent });
    currentMessages.push({ role: "user", content: "Continue from where you left off. Do not repeat any previous content." });
  }
  return {
    content: allContent || null,
    toolCalls: allToolCalls.length > 0 ? allToolCalls : null,
    finishReason: lastFinishReason,
    responseId,
    created,
    tokenLimitHit,
  };
}

// ─── Core router: pick the best model for the task, with fallbacks ────────────

class RouterError extends Error {
  constructor(message, details) {
    super(message);
    this.details = details || {};
  }
}

async function callRouter(messages, env, opts = {}) {
  const tools = opts.tools;
  const startedAt = Date.now();
  const requestId = opts.requestId || "req-" + crypto.randomUUID().slice(0, 8);
  const sessionId = opts.sessionId || "anon";

  // 1. Bulletproof normalization (drops malformed messages, fixes 400s)
  let normalized = normalizeMessages(messages);

  // 2. Classify BEFORE trimming so scores see the full conversation
  const { isCoding, codingScore, researchScore, baseTier } = classifyPrompt(messages);

  // 3. Tier selection: tools → tool; enforcement rules override; research → complex
  let tier = baseTier;
  let enforceRule = null;
  if (tools && tools.length > 0) {
    tier = "tool";
  } else {
    const enforced = await applyEnforceRules(env, messages, tier);
    if (enforced) {
      tier = enforced.tier;
      enforceRule = enforced.rule;
    }
  }
  const enforced = enforceRule !== null;

  // 4. Build clean run params
  const hasSystem = normalized.some((m) => m.role === "system");
  if (!hasSystem) normalized.unshift({ role: "system", content: ROUTER_DEFAULT_SYSTEM_PROMPT });

  if (estimateTokens(normalized, tools) > MAX_ALLOWED_PROMPT_TOKENS) {
    normalized = fitToContextWindow(normalized, MAX_ALLOWED_PROMPT_TOKENS);
  }
  const safeEstimatedTokens = estimateTokens(normalized, tools);

  const runParams = { messages: normalized, max_tokens: opts.max_tokens || DEFAULT_MAX_TOKENS };
  if (opts.temperature !== undefined) runParams.temperature = opts.temperature;
  if (opts.top_p !== undefined) runParams.top_p = opts.top_p;
  if (tools) {
    runParams.tools = tools;
    runParams.tool_choice = opts.tool_choice !== undefined ? opts.tool_choice : "auto";
  }
  if (opts.response_format) runParams.response_format = opts.response_format;
  if (opts.frequency_penalty !== undefined) runParams.frequency_penalty = opts.frequency_penalty;
  if (opts.presence_penalty !== undefined) runParams.presence_penalty = opts.presence_penalty;
  if (opts.stop) runParams.stop = opts.stop;
  if (opts.seed !== undefined) runParams.seed = opts.seed;

  const explicit = opts.model && opts.model !== "smart-router" && opts.model.startsWith("@") ? [opts.model] : [];
  let modelList;
  if (tier === "tool") modelList = await getToolModels(env);
  else if (tier === "complex") modelList = [...explicit, ...(await getComplexModels(env))];
  else if (tier === "coding") modelList = [...explicit, ...(await getCodingModels(env))];
  else modelList = [...explicit, ...(await getGeneralModels(env))];
  modelList = [...new Set(modelList)];
  console.log(`[router] tier=${tier} enforced=${enforced} rule=${enforceRule || "-"} researchScore=${researchScore} models=${modelList.join(", ")}`);

  const errors = [];

  // ── Try Ollama first (first-tier) — skipped for tools & complex ───────────
  const ollamaModelName = env.OLLAMA_MODEL || "llama3";
  const ollamaEndpoint = env.OLLAMA_ENDPOINT || "";
  // Hard timeout so a slow/down Ollama can't hang the router (or /agent loop).
  const ollamaTimeoutMs = parseInt(env.OLLAMA_TIMEOUT_MS || "30000", 10) || 30000;
  // Fast-path option: skip Ollama entirely (used by the /agent loop so every
  // decision iteration uses fast Cloudflare models, not the 300s Ollama stall).
  if (ollamaEndpoint && !tools && tier !== "complex" && !opts.skipOllama) {
    const ollamaController = new AbortController();
    const ollamaTimer = setTimeout(() => ollamaController.abort(), ollamaTimeoutMs);
    try {
      const ollamaHeaders = {
        "Content-Type": "application/json",
        ...(env.OLLAMA_ACCESS_CLIENT_ID ? { "CF-Access-Client-Id": env.OLLAMA_ACCESS_CLIENT_ID } : {}),
        ...(env.OLLAMA_ACCESS_CLIENT_SECRET ? { "CF-Access-Client-Secret": env.OLLAMA_ACCESS_CLIENT_SECRET } : {}),
      };
      const ollamaResponse = await fetch(ollamaEndpoint, {
        method: "POST",
        headers: ollamaHeaders,
        body: JSON.stringify({
          model: ollamaModelName,
          messages: runParams.messages,
          max_tokens: runParams.max_tokens || DEFAULT_MAX_TOKENS,
          temperature: runParams.temperature ?? 0.7,
          stream: opts.stream === true,
        }),
        signal: ollamaController.signal,
      });
      clearTimeout(ollamaTimer);
      if (ollamaResponse.ok) {
        if (opts.stream && ollamaResponse.body) {
          await logRequest(env, { ts: new Date().toISOString(), request_id: requestId, session_id: sessionId, tier, model: "ollama/" + ollamaModelName, enforced, enforce_rule: enforceRule, research_score: researchScore, coding_score: codingScore, tokenLimitHit: false, errors: [], latency_ms: Date.now() - startedAt, streamed: true });
          return { streamBody: ollamaResponse.body, model: "ollama/" + ollamaModelName, category: tier, codingScore, researchScore, errors, enforced, enforceRule, requestId, sessionId, tokenLimitHit: false };
        }

        // Non-stream: auto-continue when Ollama hits its output cap
        // (finish_reason "length") so long generations don't truncate.
        const fetchOllama = async (msgs) => {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), ollamaTimeoutMs);
          try {
            const resp = await fetch(ollamaEndpoint, {
              method: "POST",
              headers: ollamaHeaders,
              body: JSON.stringify({
                model: ollamaModelName,
                messages: msgs,
                max_tokens: runParams.max_tokens,
                temperature: runParams.temperature ?? 0.7,
                stream: false,
              }),
              signal: ctrl.signal,
            });
            clearTimeout(timer);
            if (!resp.ok) {
              const t = await resp.text();
              throw new Error("Ollama HTTP " + resp.status + ": " + t);
            }
            return await resp.json();
          } catch (e) {
            clearTimeout(timer);
            throw e;
          }
        };

        let ollamaContent = "";
        let ollamaFinish = "stop";
        let ollamaId = "chatcmpl-ollama";
        let ollamaCreated = Math.floor(Date.now() / 1000);
        let ollamaTokenLimitHit = false;
        let ollamaMsgs = runParams.messages;
        for (let cont = 0; cont <= MAX_CONTINUATIONS; cont++) {
          const ollamaData = await fetchOllama(ollamaMsgs);
          const chunk = ollamaData?.choices?.[0]?.message?.content || ollamaData?.response || "";
          ollamaFinish = ollamaData?.choices?.[0]?.finish_reason || (chunk ? "stop" : "length");
          ollamaId = ollamaData?.id || ollamaId;
          ollamaCreated = ollamaData?.created || ollamaCreated;
          if (chunk) ollamaContent += chunk;
          if (ollamaFinish !== "length" || !chunk) break;
          ollamaTokenLimitHit = true;
          ollamaMsgs = [
            ...runParams.messages,
            { role: "assistant", content: ollamaContent },
            { role: "user", content: "Continue from where you left off. Do not repeat any previous content." },
          ];
        }
        await logRequest(env, { ts: new Date().toISOString(), request_id: requestId, session_id: sessionId, tier, model: "ollama/" + ollamaModelName, enforced, enforce_rule: enforceRule, research_score: researchScore, coding_score: codingScore, tokenLimitHit: ollamaTokenLimitHit, errors: [], latency_ms: Date.now() - startedAt, streamed: false });
        return {
          content: ollamaContent || null,
          toolCalls: null,
          finishReason: ollamaFinish,
          responseId: ollamaId,
          created: ollamaCreated,
          model: "ollama/" + ollamaModelName,
          category: tier,
          codingScore,
          researchScore,
          errors,
          enforced,
          enforceRule,
          requestId,
          sessionId,
          tokenLimitHit: ollamaTokenLimitHit,
        };
      }
      const errText = await ollamaResponse.text();
      throw new Error("Ollama HTTP " + ollamaResponse.status + ": " + errText);
    } catch (eOllama) {
      clearTimeout(ollamaTimer);
      errors.push({ model: "ollama/" + ollamaModelName, error: eOllama?.message || "ollama failed" });
      console.log("Ollama first-tier failed (" + (eOllama?.message || eOllama) + "), falling through to Cloudflare models");
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  let tokenLimitHit = false;
  for (const modelId of modelList) {
    const attemptParams = { ...runParams, max_tokens: await outputBudget(env, modelId, safeEstimatedTokens, tier, runParams.max_tokens) };
    try {
      if (opts.stream) {
        const result = await runModelWithRetry(env, modelId, attemptParams, true);
        await logRequest(env, { ts: new Date().toISOString(), request_id: requestId, session_id: sessionId, tier, model: modelId, enforced, enforce_rule: enforceRule, research_score: researchScore, coding_score: codingScore, tokenLimitHit: false, errors: [], latency_ms: Date.now() - startedAt, streamed: true });
        return { streamBody: result.body, model: modelId, category: tier, codingScore, researchScore, errors, enforced, enforceRule, requestId, sessionId, tokenLimitHit: false };
      }
      const result = await runModelWithContinuation(env, modelId, attemptParams);
      if (result.tokenLimitHit) tokenLimitHit = true;
      if (!result.content && !result.toolCalls) {
        console.log(`Model ${modelId} returned empty — falling through`);
        errors.push({ model: modelId, error: "empty response" });
        continue;
      }
      await logRequest(env, { ts: new Date().toISOString(), request_id: requestId, session_id: sessionId, tier, model: modelId, enforced, enforce_rule: enforceRule, research_score: researchScore, coding_score: codingScore, tokenLimitHit, errors: [], latency_ms: Date.now() - startedAt, streamed: false });
      return { ...result, model: modelId, category: tier, codingScore, researchScore, errors, enforced, enforceRule, requestId, sessionId, tokenLimitHit };
    } catch (e) {
      const errMsg = e?.message || String(e);
      if (isFallthroughError(e)) console.log(`Server error for ${modelId} — falling through immediately`);
      else if (isRetryableError(e)) console.log(`Capacity exhausted for ${modelId} — falling through`);
      else console.error(`Model ${modelId} failed: ${errMsg}`);
      errors.push({ model: modelId, error: errMsg });
    }
  }

  // Coding/complex models all failed → try general models as a final fallback.
  if (tier === "coding" || tier === "complex") {
    console.log(`[router] All ${tier} models failed — trying general models as fallback`);
    const generalModels = await getGeneralModels(env);
    for (const modelId of generalModels) {
      if (modelList.includes(modelId)) continue;
      try {
        const fbParams = { ...runParams, max_tokens: await outputBudget(env, modelId, safeEstimatedTokens, "general", runParams.max_tokens) };
        if (opts.stream) {
          const result = await runModelWithRetry(env, modelId, fbParams, true);
          await logRequest(env, { ts: new Date().toISOString(), request_id: requestId, session_id: sessionId, tier: tier + "-fallback", model: modelId, enforced, enforce_rule: enforceRule, research_score: researchScore, coding_score: codingScore, tokenLimitHit: false, errors: [], latency_ms: Date.now() - startedAt, streamed: true });
          return { streamBody: result.body, model: modelId, category: tier + "-fallback", codingScore, researchScore, errors, enforced, enforceRule, requestId, sessionId, tokenLimitHit: false };
        }
        const result = await runModelWithContinuation(env, modelId, fbParams);
        if (!result.content && !result.toolCalls) {
          errors.push({ model: modelId, error: "empty response" });
          continue;
        }
        const hit = result.tokenLimitHit || false;
        await logRequest(env, { ts: new Date().toISOString(), request_id: requestId, session_id: sessionId, tier: tier + "-fallback", model: modelId, enforced, enforce_rule: enforceRule, research_score: researchScore, coding_score: codingScore, tokenLimitHit: hit, errors: [], latency_ms: Date.now() - startedAt, streamed: false });
        return { ...result, model: modelId, category: tier + "-fallback", codingScore, researchScore, errors, enforced, enforceRule, requestId, sessionId, tokenLimitHit: hit };
      } catch (e) {
        errors.push({ model: modelId, error: e?.message || String(e) });
      }
    }
  }

  await logRequest(env, { ts: new Date().toISOString(), request_id: requestId, session_id: sessionId, tier, model: null, enforced, enforce_rule: enforceRule, research_score: researchScore, coding_score: codingScore, tokenLimitHit, errors, latency_ms: Date.now() - startedAt, streamed: false });
  throw new RouterError("all models failed", { category: tier, models: modelList, errors });
}


// ─── Sandbox execution (SDK 1.0) ──────────────────────────────────────────────

async function execInSandbox(env, sandboxId, command, timeoutMs) {
  const sandbox = getSandbox(env.SANDBOX, sandboxId);
  const timeout = timeoutMs || parseInt(env.EXEC_TIMEOUT_MS || "90000", 10) || 90000;
  const execPromise = (async () => {
    const process = await sandbox.exec(["/bin/bash", "-lc", command], { cwd: "/workspace" });
    const result = await process.output({ encoding: "utf8" });

    let output = "";
    if (result.stdout) output += result.stdout;
    if (result.stderr) output += (output ? "\n" : "") + `[stderr] ${result.stderr}`;
    if (result.exitCode !== 0) output += (output ? "\n" : "") + `[exit code: ${result.exitCode}]`;
    return output || "(no output)";
  })();
  return await Promise.race([
    execPromise,
    new Promise((resolve) => setTimeout(() => resolve("(timed out after " + timeout + "ms)"), timeout)),
  ]);
}

// ─── File upload helper ───────────────────────────────────────────────────────

function arrayBufferToBase64Chunked(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

function shellQuotePath(path) {
  return path.replace(/'/g, `'\\''`);
}

async function parseMultipart(request, env, sandboxId) {
  const formData = await request.formData();
  const prompt = formData.get("prompt") || "";
  const sessionId = formData.get("sessionId") || "default";
  const files = [];

  for (const [key, value] of formData.entries()) {
    if (key === "prompt" || key === "sessionId") continue;
    if (value && typeof value === "object" && "name" in value && "size" in value) {
      const fileContent = await value.arrayBuffer();
      const fileName = String(value.name).replace(/[^A-Za-z0-9._-]/g, "_");
      const filePath = `/workspace/${fileName}`;
      const base64Content = arrayBufferToBase64Chunked(fileContent);

      await execInSandbox(env, sandboxId, `echo '${base64Content}' | base64 -d > '${shellQuotePath(filePath)}'`);
      files.push({ name: fileName, path: filePath });
    }
  }

  return { prompt, sessionId, files };
}

// ─── OpenAI-compatible /v1/chat/completions handler ───────────────────────────

async function handleChatCompletions(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: { message: "invalid JSON body", type: "invalid_request_error" } }, 400);
  }

  const messages = body.messages || [];
  if (!Array.isArray(messages) || messages.length === 0) {
    return json({ error: { message: "messages required", type: "invalid_request_error" } }, 400);
  }

  const wantsStream = body.stream === true;
  const sessionId = request.headers.get("x-session-id") || body.session_id || body.sessionId || "anon";
  const startedAt = Date.now();

  try {
    const result = await callRouter(messages, env, {
      model: body.model,
      tools: body.tools,
      tool_choice: body.tool_choice,
      max_tokens: body.max_tokens,
      temperature: body.temperature,
      top_p: body.top_p,
      response_format: body.response_format,
      frequency_penalty: body.frequency_penalty,
      presence_penalty: body.presence_penalty,
      stop: body.stop,
      seed: body.seed,
      stream: wantsStream,
      sessionId,
    });

    const routerHeaders = {
      "x-router-model": result.model,
      "x-router-category": result.category,
      "x-router-classification-score": String(result.codingScore ?? 0),
      "x-router-research-score": String(result.researchScore ?? 0),
      "x-router-enforced": String(result.enforced === true),
      ...(result.enforceRule ? { "x-router-enforce-rule": result.enforceRule } : {}),
      "x-request-id": result.requestId,
      "x-session-id": sessionId,
    };

    if (wantsStream) {
      return new Response(result.streamBody, {
        headers: {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
          "access-control-allow-origin": "*",
          ...routerHeaders,
        },
      });
    }

    const assistantMessage = { role: "assistant", content: result.content };
    if (result.toolCalls && result.toolCalls.length > 0) {
      assistantMessage.tool_calls = result.toolCalls;
      if (!result.content) assistantMessage.content = null;
    }

    return new Response(
      JSON.stringify({
        id: result.responseId || "chatcmpl-" + crypto.randomUUID(),
        object: "chat.completion",
        created: result.created || Math.floor(Date.now() / 1000),
        model: result.model,
        choices: [{ index: 0, message: assistantMessage, finish_reason: result.finishReason }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        router: {
          category: result.category,
          model: result.model,
          codingScore: result.codingScore ?? 0,
          researchScore: result.researchScore ?? 0,
          enforced: result.enforced === true,
          enforceRule: result.enforceRule || null,
          requestId: result.requestId,
        },
      }),
      { headers: apiHeaders(routerHeaders) }
    );
  } catch (e) {
    const requestId = "req-" + crypto.randomUUID().slice(0, 8);
    const errMsg = e?.message || "internal error";
    await logRequest(env, {
      ts: new Date().toISOString(),
      request_id: requestId,
      session_id: sessionId,
      tier: "error",
      model: null,
      enforced: false,
      enforce_rule: null,
      research_score: 0,
      coding_score: 0,
      tokenLimitHit: false,
      errors: [{ model: "router", error: errMsg }],
      latency_ms: Date.now() - startedAt,
      streamed: false,
    });
    if (e instanceof RouterError) {
      return json({ error: { message: e.message, type: "server_error", details: e.details } }, 502, apiHeaders({ "x-request-id": requestId, "x-session-id": sessionId }));
    }
    return json({ error: { message: errMsg, type: "server_error" } }, 500, apiHeaders({ "x-request-id": requestId, "x-session-id": sessionId }));
  }
}

// ─── Shell-agent endpoint (sandboxed execution loop) ─────────────────────────

async function handleAgent(request, env, url, ctx) {
  const contentType = request.headers.get("Content-Type") || "";
  const maxIterations = parseInt(env.MAX_ITERATIONS || "25", 10);

  let userPrompt, sessionId, uploadedFiles;

  if (contentType.includes("multipart/form-data")) {
    sessionId = url.searchParams.get("sessionId") || "default";
    const sandboxId = `${env.SANDBOX_ID_PREFIX || "llm-session"}-${sessionId}`;
    const parsed = await parseMultipart(request, env, sandboxId);
    userPrompt = parsed.prompt;
    sessionId = parsed.sessionId;
    uploadedFiles = parsed.files;

    const envNote = "Environment: Linux container. Available tools: git, python3, node, npm, curl, pip, cat, ls, mkdir, tee.";
    if (uploadedFiles.length > 0) {
      const fileList = uploadedFiles.map((f) => `- ${f.path}`).join("\n");
      userPrompt = `${envNote}\n\nUploaded files:\n${fileList}\n\nTask: ${userPrompt}`;
    } else {
      userPrompt = `${envNote}\n\nTask: ${userPrompt}`;
    }
  } else {
    const body = await request.json();
    userPrompt = body.prompt;
    sessionId = body.sessionId || "default";
    uploadedFiles = [];
  }

  if (!userPrompt) {
    return json({ error: "Missing 'prompt' field" }, 400);
  }

  const sandboxId = `${env.SANDBOX_ID_PREFIX || "llm-session"}-${sessionId}`;
  // One-time bootstrap (KV-cached): ensure python3 + pip exist in the sandbox container.
  // Bounded probes + background install — never blocks the agent loop.
  const bootKey = "bootstrap:" + sandboxId;
  try {
    let booted = false;
    try { booted = (await env.ROUTER_KV.get(bootKey)) === "1"; } catch {}
    if (!booted) {
      const probe = await execInSandbox(env, sandboxId, "command -v python3", 15000);
      if (!/python3/.test(probe)) {
        // Best-effort install in the background; the agent works with shell/curl anyway.
        const install = (async () => {
          const result = await execInSandbox(env, sandboxId, "apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq python3 python3-pip", 45000);
          console.log("[bootstrap] install result:", (result || "").slice(0, 120));
        })();
        if (ctx) ctx.waitUntil(install); else await install;
      }
      try { await env.ROUTER_KV.put(bootKey, "1"); } catch {}
    }
  } catch (e) {
    console.log("[bootstrap] skipped:", e?.message || String(e));
  }
  const messages = [
    { role: "system", content: AGENT_SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ];

  const executionLog = [];
  let usedModel = null;
  let usedCategory = null;

  try {
    for (let i = 0; i < maxIterations; i++) {
    // skipOllama: every decision iteration must be fast — Ollama's 300s
    // timeout stalls the whole loop. Use fast Cloudflare models instead.
    // max_tokens cap keeps responses terse (one bash block per turn).
    const result = await callRouter(messages, env, { stream: false, skipOllama: true, max_tokens: 4096 });
    usedModel = result.model;
    usedCategory = result.category;
    const llmResponse = result.content || "";
    messages.push({ role: "assistant", content: llmResponse });
    const codeBlocks = extractCodeBlocks(llmResponse);
    const saysComplete = isTaskComplete(llmResponse);

    // Execute any code blocks first — they may contain the final verification.
    if (codeBlocks.length > 0) {
      for (const code of codeBlocks) {
        const output = await execInSandbox(env, sandboxId, code);
        executionLog.push({ command: code, output });
        messages.push({ role: "user", content: `Command output:\n\n${output}` });
      }
      if (saysComplete) {
        // Only accept completion when the deliverable was verified in the output.
        const wantsFile = /\b(csv|tsv|json|file|save|write)\b/i.test(userPrompt);
        const lastOut = executionLog.length ? executionLog[executionLog.length - 1].output || "" : "";
        const verified = !wantsFile || /\.(csv|tsv|json)\b|\bcat\b|\bls\b|\bwc\b/i.test(lastOut);
        if (!verified) {
          messages.push({
            role: "user",
            content:
              "You declared TASK_COMPLETE but the requested deliverable file was not verified in the output. Show it now: run `ls -la /workspace` and `cat <the file>` — then declare TASK_COMPLETE.",
          });
          continue;
        }
        break;
      }
      continue;
    }

    if (saysComplete) {
      // Completion with no commands: require evidence of real work.
      if (executionLog.length === 0) {
        messages.push({
          role: "user",
          content:
            "You declared TASK_COMPLETE but ran no commands and produced no deliverable. Continue: execute the actual commands needed (curl/scrape/write the file), verify the output, then declare TASK_COMPLETE.",
        });
        continue;
      }
      break;
    }

    // No code blocks, not complete — nudge toward a bash block.
    messages.push({
      role: "user",
      content:
        llmResponse.trim().length < 100
          ? "Skip the explanation. Output a ```bash code block with your next command now. (python3 is available for HTML parsing; pup/jq may not be installed.)"
          : "You must output shell commands in a ```bash code block. Please continue. (python3 is available; pup/jq may not be installed.)",
    });
    continue;
  }
  } catch (e) {
    if (e instanceof RouterError) {
      return json({ error: "agent failed: all models exhausted", details: e.details }, 502);
    }
    return json({ error: "agent failed: " + (e?.message || String(e)) }, 500);
  }

  return new Response(
    JSON.stringify(
      {
        sessionId,
        sandboxId,
        model: usedModel,
        category: usedCategory,
        uploadedFiles,
        iterations: messages.filter((m) => m.role === "assistant").length,
        finalResponse: messages[messages.length - 1]?.content,
        executionLog,
        messages,
      },
      null,
      2
    ),
    { headers: apiHeaders() }
  );
}

// ─── Main Worker ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: apiHeaders() });
    }

    // Health check
    if (url.pathname === "/health" || url.pathname === "/v1/health") {
      const [coding, general, tool] = await Promise.all([
        getCodingModels(env),
        getGeneralModels(env),
        getToolModels(env),
      ]);
      return json({
        status: "ok",
        router: "smart-llm-router-v17",
        codingModels: coding,
        generalModels: general,
        toolModels: tool,
        complexModels: await getComplexModels(env),
        features: [
          "prompt-classification",
          "research-complex-tier",
          "category-routing",
          "sse-streaming",
          "tool-calls",
          "capacity-fallback",
          "auto-continuation",
          "context-trimming",
          "message-normalization",
          "enforcement-rules",
          "request-logging",
          "sandbox-agent",
          "dynamic-model-refresh",
          "cron-scheduled",
        ],
      });
    }

    // Model list (OpenAI-compatible)
    if (request.method === "GET" && (url.pathname === "/v1/models" || url.pathname === "/models")) {
      const allModels = await getAllModels(env);
      let kvMeta = null;
      try {
        const kvData = await kvGet(env, KV_MODELS_KEY);
        if (kvData) kvMeta = JSON.parse(kvData);
      } catch {}
      return json({
        object: "list",
        data: allModels
          .map((m) => ({ id: m, object: "model", created: 1700000000, owned_by: "cloudflare" }))
          .concat([{ id: "smart-router", object: "model", created: 1700000000, owned_by: "cloudflare" }]),
        updated_at: kvMeta?.updated_at || null,
        model_count: kvMeta?.model_count || allModels.length,
      });
    }

    // Manual model catalog refresh
    if (url.pathname === "/v1/refresh-models" || url.pathname === "/refresh-models") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      const result = await runScheduledUpdate(env);
      return json(result, result.success ? 200 : 500);
    }

    // OpenAI-compatible chat completions (streaming + tools)
    if (url.pathname === "/v1/chat/completions" && request.method === "POST") {
      return await handleChatCompletions(request, env);
    }

    // Dry-run classification: see what tier a prompt would get without calling a model
    if (url.pathname === "/v1/classify" && request.method === "POST") {
      let cBody;
      try {
        cBody = await request.json();
      } catch {
        return json({ error: { message: "invalid JSON body", type: "invalid_request_error" } }, 400);
      }
      const cMessages = cBody.messages || (cBody.text ? [{ role: "user", content: cBody.text }] : []);
      const { isCoding, codingScore, researchScore, baseTier } = classifyPrompt(cMessages);
      const enforced = await applyEnforceRules(env, cMessages, baseTier);
      const effectiveTier = enforced ? enforced.tier : baseTier;
      let models = [];
      if (effectiveTier === "tool") models = await getToolModels(env);
      else if (effectiveTier === "complex") models = await getComplexModels(env);
      else if (effectiveTier === "coding") models = await getCodingModels(env);
      else models = await getGeneralModels(env);
      return json({
        base_tier: baseTier,
        effective_tier: effectiveTier,
        coding_score: codingScore,
        research_score: researchScore,
        is_coding: isCoding,
        enforce_rule: enforced ? enforced.rule : null,
        models,
        message_count: cMessages.length,
      });
    }

    // Enforcement rules (KV-backed, no redeploy)
    if (url.pathname === "/v1/enforce") {
      if (request.method === "GET") {
        return json({ rules: await getEnforceRules(env) });
      }
      if (request.method === "POST") {
        let eBody;
        try {
          eBody = await request.json();
        } catch {
          return json({ error: { message: "invalid JSON body", type: "invalid_request_error" } }, 400);
        }
        const VALID_TIERS = new Set(["coding", "general", "tool", "complex"]);
        const rules = await getEnforceRules(env);
        if (eBody.delete) {
          const remaining = rules.filter((r) => r.pattern !== eBody.pattern);
          await kvPut(env, KV_ENFORCE_KEY, JSON.stringify(remaining));
          return json({ deleted: eBody.pattern, rules: remaining });
        }
        if (!eBody.pattern || !VALID_TIERS.has(eBody.tier)) {
          return json({ error: { message: "pattern + tier required (tier: coding|general|tool|complex)", type: "invalid_request_error" } }, 400);
        }
        const updated = [...rules.filter((r) => r.pattern !== eBody.pattern), { pattern: eBody.pattern, tier: eBody.tier, created: new Date().toISOString() }];
        await kvPut(env, KV_ENFORCE_KEY, JSON.stringify(updated));
        return json({ added: { pattern: eBody.pattern, tier: eBody.tier }, rules: updated });
      }
      return json({ error: "Method not allowed" }, 405);
    }

    // Recent request log (KV ring) + CSV report for Google Sheets
    if (url.pathname === "/v1/logs" && request.method === "GET") {
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, MAX_LOG_ENTRIES);
      let logs = [];
      try {
        const raw = await kvGet(env, KV_LOGS_KEY);
        logs = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(logs)) logs = [];
      } catch {}
      return json({ count: logs.length, logs: logs.slice(0, limit) });
    }

    if (url.pathname === "/v1/report" && request.method === "GET") {
      let logs = [];
      try {
        const raw = await kvGet(env, KV_LOGS_KEY);
        logs = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(logs)) logs = [];
      } catch {}
      const esc = (v) => {
        const s = v === null || v === undefined ? "" : String(v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      const header = ["ts", "request_id", "session_id", "tier", "model", "enforced", "rule", "research_score", "coding_score", "token_limit_hit", "errors", "latency_ms", "streamed"];
      const rows = logs.map((l) =>
        [
          l.ts, l.request_id, l.session_id, l.tier, l.model,
          l.enforced ? "true" : "false", l.enforce_rule || "",
          l.research_score ?? "", l.coding_score ?? "",
          l.tokenLimitHit ? "true" : "false",
          Array.isArray(l.errors) ? l.errors.map((e) => `${e.model}:${e.error}`).join(" | ") : "",
          l.latency_ms ?? "", l.streamed ? "true" : "false",
        ].map(esc).join(",")
      );
      const csv = [header.join(","), ...rows].join("\n");
      return new Response(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="router-log.csv"',
          "access-control-allow-origin": "*",
        },
      });
    }

    // Shell agent (multipart or JSON) — sandboxed execution loop
    if ((url.pathname === "/" || url.pathname === "/agent") && request.method === "POST") {
      return await handleAgent(request, env, url, ctx);
    }

    // Download a file from the sandbox
    if (url.pathname === "/file" && request.method === "GET") {
      const sessionId = url.searchParams.get("session") || "default";
      const filePath = url.searchParams.get("path");
      if (!filePath) {
        return json({ error: "Missing 'path' parameter" }, 400);
      }
      const sandboxId = `${env.SANDBOX_ID_PREFIX || "llm-session"}-${sessionId}`;
      const output = await execInSandbox(env, sandboxId, `cat '${shellQuotePath(filePath)}'`);
      return new Response(output, { headers: { "content-type": "text/plain" } });
    }

    if (request.method === "GET" && url.pathname === "/") {
      return json({
        name: "smart-llm-router",
        version: "17.0",
        endpoints: {
          chat: "POST /v1/chat/completions (streaming + tools)",
          models: "GET /v1/models",
          classify: "POST /v1/classify (dry-run routing)",
          enforce: "GET/POST /v1/enforce (KV routing rules)",
          logs: "GET /v1/logs?limit=N (request log)",
          report: "GET /v1/report (CSV for Google Sheets)",
          refresh: "POST /v1/refresh-models",
          agent: "POST /agent (multipart or JSON, sandboxed shell)",
          file: "GET /file?session=..&path=..",
          health: "GET /health",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledUpdate(env));
  },
};
