// smart-llm-router v14.0
// v13 features: Prompt classification + category-based routing + auto-continuation + code sandbox
// v14 additions: Nightly cron-triggered model catalog refresh + dynamic model list from KV
// v14.0-secrets: Migrated CF_API_TOKEN to Cloudflare Secrets Store (CLOUDFLARE_API_KEY binding)
// Cron: 6 0 * * * (12:06 AM ET) — fetches live Workers AI catalog, updates KV, refreshes model pools

// ─── Dynamic model pools (fallbacks; overridden by KV when populated) ──────

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

// Preferred code-capable models in priority order — used by the scheduled handler
// to filter the live catalog and pick the best available models.
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

// KV keys
const KV_MODELS_KEY = "router:models";
const KV_CODING_KEY = "router:coding_models";
const KV_GENERAL_KEY = "router:general_models";
const KV_TOOL_KEY = "router:tool_models";

// ─── Config ─────────────────────────────────────────────────────────────────

const CAPACITY_RETRIES = 2;
const CAPACITY_RETRY_DELAY = 200;
const DEFAULT_MAX_TOKENS = 8192;
const MAX_CONTINUATIONS = 3;
const CF_MODEL_MAX_CONTEXT = 24e3;   // max context window for models we route to
const MAX_ALLOWED_PROMPT_TOKENS = 18e3; // trim prompts above this

const SYSTEM_PROMPT = "You are a helpful, expert assistant. When making code changes, use the available file editing tools (write, edit) to directly modify files AND print the full code of each change in your text response so the user can review it. Always show the complete updated code for each file you modify. Follow modern best practices. Be concise but thorough.";

// ─── Prompt classifier ──────────────────────────────────────────────────────

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
  /\b(frontend|backend|fullstack|full-stack|server-side|client-side|SSR|SSG|API route|REST|GraphQL|gRPC|WebSocket)\b/i,
];

function classifyPrompt(messages) {
  const text = messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => typeof m.content === "string" ? m.content : (Array.isArray(m.content) ? m.content.map(p => typeof p === "string" ? p : (p?.text || "")).join("\n") : ""))
    .join("\n");

  let score = 0;
  for (const pattern of CODING_PATTERNS) {
    const matches = text.match(new RegExp(pattern.source, pattern.flags));
    if (matches) score += matches.length;
  }

  const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
  if (lastUserMsg) {
    const lastText = typeof lastUserMsg.content === "string" ? lastUserMsg.content : "";
    if (/```/.test(lastText) && /\b(javascript|js|typescript|ts|python|py|jsx|tsx|bash|shell|go|rust|java)\b/i.test(lastText)) {
      score += 5;
    }
  }

  const finalIsCoding = score >= 3;
  console.log(`[classifier] score=${score} isCoding=${finalIsCoding} textLen=${text.length}`);
  return { isCoding: finalIsCoding, score };
}

// ─── Utilities ──────────────────────────────────────────────────────────────

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── Context-window trimming (merged from deployed hotfix) ─────────────────

function safeTrim(value) {
  if (typeof value === "string") return value.trim();
  if (value === null || value === undefined) return "";
  if (typeof value === "object") {
    try { return JSON.stringify(value).trim(); } catch { return ""; }
  }
  return String(value).trim();
}

function extractMessageContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === "string") return part;
      if (part && part.type === "text") return part.text || "";
      return "";
    }).join(" ");
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
  const systemMessages = messages.filter(m => m.role === "system");
  let otherMessages = messages.filter(m => m.role !== "system");
  while (estimateTokens([...systemMessages, ...otherMessages]) > maxAllowedPromptTokens && otherMessages.length > 2) {
    otherMessages.shift();
  }
  return [...systemMessages, ...otherMessages];
}

function normalizeMessages(messages) {
  return messages.map(m => {
    const normalized = { role: m.role };
    if (m.content !== undefined) normalized.content = extractMessageContent(m.content);
    if (m.tool_calls) normalized.tool_calls = m.tool_calls;
    if (m.tool_call_id) normalized.tool_call_id = m.tool_call_id;
    if (m.name) normalized.name = m.name;
    return normalized;
  });
}

// ─── KV model list helpers ──────────────────────────────────────────────────

async function getCodingModels(env) {
  const kv = await env.ROUTER_KV.get(KV_CODING_KEY);
  if (kv) { try { const arr = JSON.parse(kv); if (Array.isArray(arr) && arr.length) return arr; } catch {} }
  return CODING_MODELS_FALLBACK;
}

async function getGeneralModels(env) {
  const kv = await env.ROUTER_KV.get(KV_GENERAL_KEY);
  if (kv) { try { const arr = JSON.parse(kv); if (Array.isArray(arr) && arr.length) return arr; } catch {} }
  return GENERAL_MODELS_FALLBACK;
}

async function getToolModels(env) {
  const kv = await env.ROUTER_KV.get(KV_TOOL_KEY);
  if (kv) { try { const arr = JSON.parse(kv); if (Array.isArray(arr) && arr.length) return arr; } catch {} }
  return TOOL_MODELS_FALLBACK;
}

async function getAllModels(env) {
  const [coding, general, tool] = await Promise.all([
    getCodingModels(env), getGeneralModels(env), getToolModels(env)
  ]);
  return [...new Set([...coding, ...general, ...tool])];
}

// ─── Model catalog fetcher (for scheduled handler) ──────────────────────────

async function fetchModelCatalog(env) {
  const token = await env.CLOUDFLARE_API_KEY.get();
  if (!token) throw new Error("No API token available for model catalog fetch");

  const allModels = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 10) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.ACCOUNT_ID}/ai/models/search?task=Text%20Generation&per_page=100&page=${page}&hide_experimental=true`;
    const resp = await fetch(url, {
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" }
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
  return preferred.filter(name => catalogNames.has(name));
}

function selectBestModels(catalog) {
  const catalogNames = new Set(catalog.map(m => m.name));
  const modelMap = new Map(catalog.map(m => [m.name, m]));

  let coding = filterToAvailable(PREFERRED_CODING_MODELS, catalogNames);
  let general = filterToAvailable(PREFERRED_GENERAL_MODELS, catalogNames);
  let tool = filterToAvailable(PREFERRED_TOOL_MODELS, catalogNames);

  const known = new Set([...PREFERRED_CODING_MODELS, ...PREFERRED_GENERAL_MODELS, ...PREFERRED_TOOL_MODELS]);
  const newModels = catalog.filter(m => {
    if (known.has(m.name)) return false;
    const props = m.properties || [];
    const hasFC = props.some(p => p.property_id === "function_calling" && p.value === "true");
    const hasReasoning = props.some(p => p.property_id === "reasoning" && p.value === "true");
    const isLora = props.some(p => p.property_id === "lora" && p.value === "true");
    const isGuard = m.tags && m.tags.some(t => ["moderation", "safety", "content-filtering", "guardrails"].includes(t));
    return !isLora && !isGuard && (hasFC || hasReasoning);
  });

  for (const m of newModels) {
    const props = m.properties || [];
    const hasFC = props.some(p => p.property_id === "function_calling" && p.value === "true");
    const desc = (m.description || "").toLowerCase();
    if (desc.includes("code") || desc.includes("coding") || desc.includes("agentic")) {
      coding.push(m.name);
    } else {
      general.push(m.name);
    }
    if (hasFC) tool.push(m.name);
  }

  const allNames = [...new Set([...coding, ...general, ...tool])];
  const detailed = allNames.map(name => {
    const m = modelMap.get(name);
    if (!m) return { name, description: "", context_window: null, function_calling: false, reasoning: false };
    const props = m.properties || [];
    return {
      name: m.name,
      description: m.description || "",
      created_at: m.created_at || "",
      context_window: props.find(p => p.property_id === "context_window")?.value || null,
      function_calling: props.some(p => p.property_id === "function_calling" && p.value === "true"),
      reasoning: props.some(p => p.property_id === "reasoning" && p.value === "true"),
    };
  });

  return { coding, general, tool, detailed };
}

// ─── Scheduled handler (cron) ──────────────────────────────────────────────

async function runScheduledUpdate(env) {
  const startedAt = new Date().toISOString();
  console.log(`[scheduled] Model catalog refresh started at ${startedAt}`);

  try {
    const catalog = await fetchModelCatalog(env);
    console.log(`[scheduled] Fetched ${catalog.length} models from catalog`);

    const { coding, general, tool, detailed } = selectBestModels(catalog);
    console.log(`[scheduled] Selected ${detailed.length} models: coding=${coding.length} general=${general.length} tool=${tool.length}`);

    const kvData = {
      updated_at: startedAt,
      model_count: detailed.length,
      coding_models: coding,
      general_models: general,
      tool_models: tool,
      models: detailed,
    };

    await env.ROUTER_KV.put(KV_MODELS_KEY, JSON.stringify(kvData));
    await env.ROUTER_KV.put(KV_CODING_KEY, JSON.stringify(coding));
    await env.ROUTER_KV.put(KV_GENERAL_KEY, JSON.stringify(general));
    await env.ROUTER_KV.put(KV_TOOL_KEY, JSON.stringify(tool));

    console.log(`[scheduled] Model catalog refresh complete. Stored ${detailed.length} models to KV.`);
    return { success: true, model_count: detailed.length, coding: coding.length, general: general.length, tool: tool.length, updated_at: startedAt };
  } catch (err) {
    console.error(`[scheduled] Model catalog refresh failed: ${err.message}`);
    return { success: false, error: err.message, updated_at: startedAt };
  }
}

// ─── Code block extraction + sandbox execution (optional, needs LOADER) ────

function extractCodeBlocks(text) {
  const blocks = [];
  const regex = /```(?:javascript|js|typescript|ts)\n([\s\S]*?)```/gi;
  let match;
  while ((match = regex.exec(text)) !== null) blocks.push(match[1].trim());
  return blocks;
}

async function executeCodeSafely(env, code) {
  const loader = env.LOADER || env.Loader;
  if (!loader) return { success: false, error: "No LOADER binding available" };
  try {
    const wrappedCode = "let _output = [];\nconst _origLog = console.log;\nconsole.log = (...args) => { _output.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')); };\ntry {\n" + code + "\n} catch(e) { _output.push('Error: ' + e.message); }\nexport default { async fetch(request) { return new Response(_output.join('\\n') || '(no output)'); } };";
    const worker = loader.load({ compatibilityDate: "2026-01-01", mainModule: "src/index.js", modules: { "src/index.js": wrappedCode }, globalOutbound: null });
    const entrypoint = worker.getEntrypoint();
    const result = await entrypoint.fetch(new Request("https://sandbox.local/"));
    const output = await result.text();
    return { success: true, output, status: result.status };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

async function executeCodeBlocks(env, text) {
  if (!env.LOADER && !env.Loader) return null;
  const blocks = extractCodeBlocks(text);
  if (blocks.length === 0) return null;
  const results = [];
  for (let i = 0; i < blocks.length; i++) {
    const result = await executeCodeSafely(env, blocks[i]);
    results.push({ blockIndex: i, ...result });
  }
  return results;
}

// ─── Model calling via REST API ─────────────────────────────────────────────

async function callModelViaREST(env, modelId, runParams, stream) {
  const url = "https://api.cloudflare.com/client/v4/accounts/" + env.ACCOUNT_ID + "/ai/v1/chat/completions";
  const body = {
    model: modelId,
    messages: runParams.messages,
    max_tokens: runParams.max_tokens || DEFAULT_MAX_TOKENS,
    stream: stream,
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

  const _token = await env.CLOUDFLARE_API_KEY.get();
  const headers = { "Authorization": "Bearer " + _token, "Content-Type": "application/json" };
  if (env.GATEWAY_ID) headers["cf-aig-gateway-id"] = env.GATEWAY_ID;

  const resp = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error("REST API error " + resp.status + ": " + t.substring(0, 500));
  }
  if (stream) return resp;
  const data = JSON.parse(await resp.text());
  if (data.choices) return data;
  if (data.result && data.success) return data.result;
  return data;
}

async function runModelWithRetry(env, modelId, runParams, stream) {
  let lastError;
  for (let attempt = 0; attempt <= CAPACITY_RETRIES; attempt++) {
    try {
      return await callModelViaREST(env, modelId, runParams, stream);
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
  let allContent = "", allToolCalls = [], responseId = null, created = null, lastFinishReason = null, continuationCount = 0;
  let currentMessages = runParams.messages.slice();
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
    console.log("Model " + modelId + ": contentLen=" + (allContent?.length || 0) + " finish=" + finishReason + " continuation=" + continuationCount);
    if (finishReason !== "length") break;
    if (toolCalls) break;
    if (!content) break;
    continuationCount++;
    currentMessages = runParams.messages.slice();
    currentMessages.push({ role: "assistant", content: allContent });
    currentMessages.push({ role: "user", content: "Continue from where you left off. Do not repeat any previous content." });
  }
  return { content: allContent || null, toolCalls: allToolCalls.length > 0 ? allToolCalls : null, finishReason: lastFinishReason, responseId, created };
}

// ─── Streaming helpers ─────────────────────────────────────────────────────

function fakeStreamResponse(content, toolCalls, finishReason, modelId, responseId, created, executionResults) {
  const enc = new TextEncoder();
  const cid = responseId || ("chatcmpl-" + Date.now());
  const ct = created || Math.floor(Date.now() / 1000);
  const rs = new ReadableStream({
    start(ctrl) {
      ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: { role: "assistant", content: "Working on it..." }, finish_reason: null }] }) + "\n\n"));
      if (content && content.length > 0) {
        for (let i = 0; i < content.length; i += 100) {
          ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: { content: Array.from(content).slice(i, i + 100).join("") }, finish_reason: null }] }) + "\n\n"));
        }
      }
      if (executionResults && executionResults.length > 0) {
        let execText = "\n\n--- Code Execution Results ---\n";
        for (const r of executionResults) {
          execText += "Block " + (r.blockIndex + 1) + ": " + (r.success ? r.output : "Error: " + r.error) + "\n";
        }
        for (let i = 0; i < execText.length; i += 100) {
          ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: { content: Array.from(execText).slice(i, i + 100).join("") }, finish_reason: null }] }) + "\n\n"));
        }
      }
      if (toolCalls && toolCalls.length > 0) {
        for (let i = 0; i < toolCalls.length; i++) {
          const tc = toolCalls[i];
          const args = typeof tc.function?.arguments === "string" ? tc.function.arguments : JSON.stringify(tc.function?.arguments || tc.arguments || {});
          const tcObj = { index: i, id: tc.id || ("call_" + Date.now() + "_" + i), type: "function", function: { name: tc.function?.name || tc.name, arguments: args } };
          ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: { tool_calls: [tcObj] }, finish_reason: null }] }) + "\n\n"));
        }
        ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] }) + "\n\n"));
      } else {
        ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }) + "\n\n"));
      }
      ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
      ctrl.close();
    }
  });
  return new Response(rs, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", "connection": "keep-alive", "x-router-model": modelId } });
}

// ─── Main handler ───────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      const [coding, general, tool] = await Promise.all([
        getCodingModels(env), getGeneralModels(env), getToolModels(env)
      ]);
      return json({
        status: "ok",
        router: "smart-llm-router-v14.0",
        codingModels: coding,
        generalModels: general,
        toolModels: tool,
        features: ["prompt-classification", "category-routing", "auto-continuation", "code-execution-sandbox", "dynamic-model-refresh", "cron-scheduled"]
      });
    }

    if (request.method === "GET" && (url.pathname === "/v1/models" || url.pathname === "/models")) {
      const allModels = await getAllModels(env);
      let kvMeta = null;
      try {
        const kvData = await env.ROUTER_KV.get(KV_MODELS_KEY);
        if (kvData) kvMeta = JSON.parse(kvData);
      } catch {}
      return json({
        object: "list",
        data: allModels.map(m => ({ id: m, object: "model", created: 1700000000, owned_by: "cloudflare" }))
          .concat([{ id: "smart-router", object: "model", created: 1700000000, owned_by: "cloudflare" }]),
        updated_at: kvMeta?.updated_at || null,
        model_count: kvMeta?.model_count || allModels.length,
      });
    }

    if (url.pathname === "/v1/refresh-models" || url.pathname === "/refresh-models") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      const result = await runScheduledUpdate(env);
      return json(result, result.success ? 200 : 500);
    }

    if (request.method !== "POST") {
      if (url.pathname === "/favicon.ico") return new Response(null, { status: 404 });
      return json({ name: "smart-llm-router", version: "14.0", endpoint: "POST /v1/chat/completions" });
    }

    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid JSON" }, 400); }

    const messages = body.messages || [];
    if (!messages.length) return json({ error: "no messages" }, 400);

    let normalizedMessages = normalizeMessages(messages);

    const systemIdx = normalizedMessages.findIndex(m => m.role === "system");
    if (systemIdx >= 0) {
      normalizedMessages[systemIdx].content = SYSTEM_PROMPT + "\n\n" + normalizedMessages[systemIdx].content;
    } else {
      normalizedMessages.unshift({ role: "system", content: SYSTEM_PROMPT });
    }

    const tools = body.tools;
    const estimatedPromptTokens = estimateTokens(normalizedMessages, tools);
    if (estimatedPromptTokens > MAX_ALLOWED_PROMPT_TOKENS) {
      normalizedMessages = fitToContextWindow(normalizedMessages, MAX_ALLOWED_PROMPT_TOKENS);
    }
    const safeEstimatedTokens = estimateTokens(normalizedMessages, tools);
    const availableOutputTokens = Math.max(512, Math.min(2048, CF_MODEL_MAX_CONTEXT - safeEstimatedTokens - 200));
    const effectiveMaxTokens = body.max_tokens ? Math.min(body.max_tokens, availableOutputTokens) : availableOutputTokens;

    const runParams = { messages: normalizedMessages, max_tokens: effectiveMaxTokens };
    if (body.temperature !== undefined) runParams.temperature = body.temperature;
    if (body.top_p !== undefined) runParams.top_p = body.top_p;
    if (body.tools) {
      runParams.tools = body.tools;
      runParams.tool_choice = body.tool_choice !== undefined ? body.tool_choice : "auto";
    }
    if (body.response_format) runParams.response_format = body.response_format;
    if (body.frequency_penalty !== undefined) runParams.frequency_penalty = body.frequency_penalty;
    if (body.presence_penalty !== undefined) runParams.presence_penalty = body.presence_penalty;
    if (body.stop) runParams.stop = body.stop;
    if (body.seed !== undefined) runParams.seed = body.seed;

    const wantsStream = body.stream === true;

    const { isCoding, score } = classifyPrompt(messages);

    let modelList;
    let category;
    if (body.tools && body.tools.length > 0) {
      modelList = await getToolModels(env);
      category = "tool";
    } else if (isCoding) {
      modelList = await getCodingModels(env);
      category = "coding";
    } else {
      modelList = await getGeneralModels(env);
      category = "general";
    }

    console.log(`[router] category=${category} score=${score} models=${modelList.join(", ")}`);

    const errors = [];

    for (const modelId of modelList) {
      try {
        if (wantsStream) {
          const streamResp = await runModelWithRetry(env, modelId, runParams, true);
          return new Response(streamResp, {
            headers: {
              "content-type": "text/event-stream",
              "cache-control": "no-cache",
              "connection": "keep-alive",
              "x-router-model": modelId,
              "x-router-category": category,
            }
          });
        }

        const result = await runModelWithContinuation(env, modelId, runParams);

        console.log("Model " + modelId + ": contentLen=" + (result.content?.length || 0) + " toolCalls=" + (result.toolCalls ? result.toolCalls.length : 0) + " finish=" + result.finishReason);
        if (result.toolCalls) {
          console.log("Tool call names: " + result.toolCalls.map(tc => tc.function?.name || tc.name).join(", "));
        }

        let executionResults = null;
        if (!result.content && !result.toolCalls) { console.log("Model " + modelId + " returned empty — falling through"); errors.push({ model: modelId, error: "empty response" }); continue; }
        if (result.content) {
          executionResults = await executeCodeBlocks(env, result.content);
        }

        const responseHeaders = {
          "content-type": "application/json",
          "x-router-model": modelId,
          "x-router-category": category,
          "x-router-classification-score": String(score)
        };

        const assistantMessage = { role: "assistant", content: result.content };
        if (result.toolCalls && result.toolCalls.length > 0) {
          assistantMessage.tool_calls = result.toolCalls;
          if (!result.content) assistantMessage.content = null;
        }

        const responseBody = {
          id: result.responseId || ("chatcmpl-" + Date.now()),
          object: "chat.completion",
          created: result.created || Math.floor(Date.now() / 1000),
          model: modelId,
          choices: [{ index: 0, message: assistantMessage, finish_reason: result.finishReason }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
          router: { category, score, model: modelId }
        };

        if (executionResults) {
          responseBody.code_execution = executionResults;
        }

        return new Response(JSON.stringify(responseBody), { headers: responseHeaders });
      } catch (e) {
        const errMsg = e?.message || String(e);
        if (isFallthroughError(e)) {
          console.log("Server error for " + modelId + " — falling through immediately");
        } else if (isRetryableError(e)) {
          console.log("Capacity exhausted for " + modelId + " — falling through");
        } else {
          console.error("Model " + modelId + " failed: " + errMsg);
        }
        errors.push({ model: modelId, error: errMsg });
      }
    }

    if (category === "coding") {
      console.log("[router] All coding models failed — trying general models as fallback");
      const generalModels = await getGeneralModels(env);
      for (const modelId of generalModels) {
        if (modelList.includes(modelId)) continue;
        try {
          if (wantsStream) {
            const streamResp = await runModelWithRetry(env, modelId, runParams, true);
            return new Response(streamResp, {
              headers: {
                "content-type": "text/event-stream",
                "cache-control": "no-cache",
                "connection": "keep-alive",
                "x-router-model": modelId,
                "x-router-category": "coding-fallback",
              }
            });
          }

          const result = await runModelWithContinuation(env, modelId, runParams);
          let executionResults = null;
          if (!result.content && !result.toolCalls) { console.log("Model " + modelId + " returned empty — falling through"); errors.push({ model: modelId, error: "empty response" }); continue; }
          if (result.content) executionResults = await executeCodeBlocks(env, result.content);

          const assistantMessage = { role: "assistant", content: result.content };
          if (result.toolCalls && result.toolCalls.length > 0) {
            assistantMessage.tool_calls = result.toolCalls;
            if (!result.content) assistantMessage.content = null;
          }

          return new Response(JSON.stringify({
            id: result.responseId || ("chatcmpl-" + Date.now()),
            object: "chat.completion",
            created: result.created || Math.floor(Date.now() / 1000),
            model: modelId,
            choices: [{ index: 0, message: assistantMessage, finish_reason: result.finishReason }],
            usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            router: { category: "coding-fallback-to-general", score, model: modelId }
          }), { headers: { "content-type": "application/json", "x-router-model": modelId, "x-router-category": "coding-fallback" } });
        } catch (e) {
          errors.push({ model: modelId, error: e?.message || String(e) });
        }
      }
    }

    return json({ error: "all models failed", category, models: modelList, errors }, 502);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(runScheduledUpdate(env));
  },
};