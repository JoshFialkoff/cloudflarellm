var __defProp = Object.defineProperty;
var __name = function(target, value) { return __defProp(target, "name", { value: value, configurable: true }); };

var CACHE_KEY = "llm-router:models";
var CACHE_TTL = 86400;
var SCORE_HEAVY = 45;
var SCORE_LIGHT = 10;

var FALLBACK_MODELS = {
  ULTRA_LIGHT: "@cf/meta/llama-3.2-3b-instruct",
  LIGHT: "@cf/zai-org/glm-4.7-flash",
  HEAVY: "@cf/openai/gpt-oss-120b",
  CODE_CHEAP: "@cf/qwen/qwen2.5-coder-32b-instruct",
  CODE_MID: "@cf/zai-org/glm-5.3-flash",
  CODE_HEAVY: "@cf/zai-org/glm-5.3"
};

var MODEL_COST_RANK = {
  "@cf/meta/llama-3.2-1b-instruct": 1,
  "@cf/meta/llama-3.2-3b-instruct": 2,
  "@cf/meta/llama-3.1-8b-instruct-fp8": 3,
  "@cf/ibm-granite/granite-4.0-h-micro": 4,
  "@cf/openai/gpt-oss-20b": 5,
  "@cf/qwen/qwen3-30b-a3b-fp8": 6,
  "@cf/qwen/qwen2.5-coder-32b-instruct": 7,
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b": 8,
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast": 9,
  "@cf/zai-org/glm-4.7-flash": 10,
  "@cf/mistralai/mistral-small-3.1-24b-instruct": 11,
  "@cf/google/gemma-4-26b-a4b-it": 12,
  "@cf/qwen/qwen3.8-27b": 13,
  "@cf/openai/gpt-oss-120b": 14,
  "@cf/nvidia/nemotron-3-120b-a12b": 15,
  "@cf/zai-org/glm-5.3-flash": 16,
  "@cf/zai-org/glm-5.2": 17,
  "@cf/zai-org/glm-5.3": 18,
  "@cf/moonshotai/kimi-k2.6": 19,
  "@cf/moonshotai/kimi-k2.7-code": 20,
  "@cf/deepseek-ai/deepseek-v4-flash-0731": 21,
  "@cf/deepseek-ai/deepseek-v4-pro-0813": 22
};

var CODE_INTENT_PHRASES = [
  "write ", "generate ", "create ", "build ", "make ", "implement ",
  "develop ", "produce ", "draft ", "scaffold ", "code ", "script",
  "function", "snippet", "program", "routine", "macro", "component",
  "handler", "endpoint", "api ", "command", "one-liner", "bash",
  "shell", "sh script", "python", "javascript", "typescript", "node",
  "golang", " rust ", "java ", "c++", "c#", "ruby", "php", "sql",
  "html", "css", "react", "vue", "svelte", "next.js", "express",
  "worker", "cloudflare worker", "wrangler", "docker", "dockerfile",
  "terraform", "ansible", "powershell", "batch file", "makefile",
  "give me code", "show me code", "code for", "code to", "code that",
  "how do i code", "how to code", "example code", "sample code",
  "regex", "regular expression", "cron", "crontab", "debug",
  "fix this code", "fix the code", "refactor", "optimize this",
  "why doesn", "error in", "bug in", "stack trace", "exception in",
  "compile error", "syntax error", "runtime error", "yaml",
  "json schema", "json config", "toml", "ini file", "env file",
  ".env", "config file", "configuration file", "curl ", "wget ",
  "ssh ", "scp ", "rsync ", "kubectl ", "git ", "npm ", "yarn ",
  "pnpm ", "pip install", "apt install", "brew install",
  "infisical", "aws cli", "gcloud "
];
var CODE_EXISTING_PATTERNS = [
  "codeblock", "function", "class ", "def ", "import ", "require(",
  "const ", "let ", "var ", "=>", "===", "!==", "printf",
  "console.log", "echo ", "system.out", "#!/", "#!/bin",
  "package main", "public class", "if (", "for (", "while (",
  "return ", "throw ", "async ", "await "
];

function detectCodeIntent(text) {
  var lower = text.toLowerCase();
  var intentMatches = 0;
  for (var i = 0; i < CODE_INTENT_PHRASES.length; i++) {
    if (lower.includes(CODE_INTENT_PHRASES[i])) intentMatches++;
  }
  var existingMatches = 0;
  for (var j = 0; j < CODE_EXISTING_PATTERNS.length; j++) {
    if (lower.includes(CODE_EXISTING_PATTERNS[j])) existingMatches++;
  }
  var hasFence = lower.includes("```");
  var hasIndentedBlock = /\n    \S/.test(text);
  var isCode = intentMatches >= 1 || existingMatches >= 2 || hasFence || hasIndentedBlock;
  var strength = intentMatches + (existingMatches >= 2 ? 2 : 0) + (hasFence ? 3 : 0) + (hasIndentedBlock ? 1 : 0);
  return { intentMatches: intentMatches, existingMatches: existingMatches, hasFence: hasFence, hasIndentedBlock: hasIndentedBlock, isCode: isCode, strength: strength };
}

function validateCodeOutput(content) {
  if (!content || typeof content !== "string" || content.trim().length === 0) return false;
  var lower = content.toLowerCase();
  if (lower.includes("```")) return true;
  if (lower.includes("#!/bin/") || lower.includes("#!/usr/bin/")) return true;
  var codeIndicators = ["function ", "const ", "let ", "var ", "def ", "import ", "require(", "class ", "if (", "for (", "while (", "return ", "=>", "console.log", "echo ", "print(", "printf", "package main", "public class", "SELECT ", "INSERT ", "CREATE TABLE", "FROM ", "WHERE ", "curl ", "wget ", "ssh ", "export ", "apt install", "pip install", "npm ", "yarn ", "kubectl ", "docker ", "git ", "infisical "];
  var matches = 0;
  for (var i = 0; i < codeIndicators.length; i++) {
    if (lower.includes(codeIndicators[i].toLowerCase())) matches++;
  }
  return matches >= 2;
}

function extractContent(response) {
  if (typeof response === "string") return response;
  if (response && response.response) return response.response;
  if (response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.content) return response.choices[0].message.content;
  if (response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.reasoning_content) return response.choices[0].message.reasoning_content;
  if (response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.reasoning) return response.choices[0].message.reasoning;
  if (response && response.choices && response.choices[0] && response.choices[0].text) return response.choices[0].text;
  return JSON.stringify(response);
}

function extractToolCalls(response) {
  if (response && response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.tool_calls) return response.choices[0].message.tool_calls;
  if (response && response.tool_calls) return response.tool_calls;
  return null;
}

function jsonResponse(obj, status) {
  if (status === undefined) status = 200;
  return new Response(JSON.stringify(obj), { status: status, headers: { "content-type": "application/json" } });
}


function formatResponse(content, isCode) {
  if (!content || typeof content !== "string") return content;
  var t = content.trim();
  var blocks = [];
  var re = /```[\s\S]*?```/g;
  var m;
  while ((m = re.exec(t)) !== null) blocks.push(m[0]);
  if (blocks.length > 0) return blocks.join("\n\n");
  t = t.replace(/^(certainly|sure|of course|absolutely|no problem|you got it|sure thing|here's|here is|here are|i'd be happy|i would be happy|i'd love to|i can help|let me|great question|good question)[^.!?]*[.!?]\s*/i, "");
  return t;
}

async function discoverModels(env) {
  // Hardcoded free models only — confirmed working on this account
  var models = {
    CODE_CHEAP: "@cf/qwen/qwen2.5-coder-32b-instruct",
    CODE_MID: "@cf/qwen/qwen2.5-coder-32b-instruct",
    CODE_HEAVY: "@cf/qwen/qwen2.5-coder-32b-instruct",
    ULTRA_LIGHT: "@cf/meta/llama-3.2-3b-instruct",
    LIGHT: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    HEAVY: "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b"
  };
  console.log("Using hardcoded free models: " + JSON.stringify(models));
  return models;
}

async function runModel(env, modelId, runParams, attempt) {
  try {
    return await env.AI.run(modelId, runParams, { cache: false });
  } catch (err) {
    console.error("AI.run error for " + modelId + " attempt " + attempt + ": " + (err && err.message || err));
    throw err;
  }
}

var index_default = {
  async fetch(request, env) {
    var url = new URL(request.url);
    if (url.pathname === "/health") return jsonResponse({ status: "ok", router: "smart-llm-router-v15.0", dynamicDiscovery: true, costAware: true, codeFirst: true, freePreferred: true });
    if (request.method === "GET" && (url.pathname === "/v1/models" || url.pathname === "/models")) {
      var models = await discoverModels(env);
      return jsonResponse({ object: "list", data: Object.entries(models).map(function(e) { return { id: e[1], object: "model", created: 1700000000, owned_by: "cloudflare", tier: e[0] }; }).concat([{ id: "smart-router", object: "model", created: 1700000000, owned_by: "cloudflare" }, { id: "auto", object: "model", created: 1700000000, owned_by: "cloudflare" }]) });
    }
    if (request.method !== "POST") {
      if (url.pathname === "/favicon.ico") return new Response(null, { status: 404 });
      return jsonResponse({ name: "smart-llm-router", version: "15.0", dynamicDiscovery: true, costAware: true, endpoint: "POST /chat/completions" });
    }
    var body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: "invalid JSON" }, 400); }
    var messages = body.messages || [];
    if (!messages.length) return jsonResponse({ error: "no messages" }, 400);
    var text = messages.map(function(m) { return m.content || ""; }).join(" ");
    var tokens = Math.ceil(text.length / 4);
    var lastMsg = messages.filter(function(m) { return m.role === "user"; });
    var last = (lastMsg.length ? lastMsg[lastMsg.length - 1].content || "" : "").toLowerCase();
    var lastLen = last.trim().length;
    var codeInfo = detectCodeIntent(text);

    var score = 0;
    if (tokens > 50000) score += 35; else if (tokens > 20000) score += 25; else if (tokens > 8000) score += 20; else if (tokens > 3000) score += 12; else if (tokens > 500) score += 5;
    if (messages.length > 20) score += 20; else if (messages.length > 10) score += 12; else if (messages.length > 4) score += 5;
    var complex = ["analyze", "architecture", "refactor", "optimize", "debug", "implement", "algorithm", "reasoning", "step by step", "pipeline", "design", "compare", "evaluate", "trade-off", "tradeoff", "pros and cons", "explain why", "derive", "prove"];
    var complexCount = 0;
    for (var ci = 0; ci < complex.length; ci++) { if (last.includes(complex[ci])) complexCount++; }
    score += 15 * Math.min(complexCount, 3);
    if (codeInfo.isCode) score += 30 + Math.min(codeInfo.strength * 3, 20);
    var mathWords = ["solve", "equation", "proof", "derive", "calculate", "integral", "derivative", "theorem"];
    for (var mi = 0; mi < mathWords.length; mi++) { if (new RegExp("\\b" + mathWords[mi] + "\\b", "i").test(last)) { score += 15; break; } }
    for (var si = 0; si < messages.length; si++) { if (messages[si].role === "system" && /you are (an expert|a senior|a specialist)/i.test(messages[si].content)) { score += 10; break; } }
    var simple = ["hi", "hello", "hey", "thanks", "thank you", "ok", "okay", "yes", "no", "sure", "what is", "what's", "summarize", "translate", "list", "who is", "when is", "where is"];
    for (var ssi = 0; ssi < simple.length; ssi++) { if (last.trim().startsWith(simple[ssi]) && lastLen < 200) { score -= 15; break; } }
    if (messages.length === 1 && lastLen < 50) score -= 10;
    score = Math.max(0, Math.min(100, score));

    var chain, routingReason;
    if (codeInfo.isCode) {
      chain = ["CODE_CHEAP", "CODE_MID", "CODE_HEAVY", "HEAVY", "LIGHT", "ULTRA_LIGHT"];
      routingReason = "code-intent (strength=" + codeInfo.strength + ") CHEAPEST-CODE-FIRST";
    } else if (score >= SCORE_HEAVY) {
      chain = ["LIGHT", "HEAVY", "ULTRA_LIGHT"];
      routingReason = "high-complexity (score=" + score + ") cost-aware";
    } else if (score >= SCORE_LIGHT) {
      chain = ["ULTRA_LIGHT", "LIGHT", "HEAVY"];
      routingReason = "medium-complexity (score=" + score + ") cheapest-first";
    } else {
      chain = ["ULTRA_LIGHT", "LIGHT", "HEAVY"];
      routingReason = "low-complexity (score=" + score + ") cheapest-first";
    }

    var MODELS = await discoverModels(env);
    var maxTokens = body.max_tokens || 4096;
    var isCodeRequest = codeInfo.isCode;

    var concisenessPrompt = { role: "system", content: "You are a terse assistant. Respond with ONLY the direct answer. Never use greetings, preambles, or phrases like 'Certainly!', 'Sure', 'Here is', 'I would be happy to'. Never add explanations, step-by-step breakdowns, or closing remarks unless the user explicitly asks. If the user asks for code, output ONLY the fenced code block with no surrounding text. If they ask a question, answer in the fewest words possible." };

    var runMessages = messages.map(function(m) {
      if (Array.isArray(m.content)) {
        var textParts = m.content.filter(function(p) { return p.type === "text" && p.text; }).map(function(p) { return p.text; });
        return Object.assign({}, m, { content: textParts.join("\n") || "" });
      }
      if (m.content === null || m.content === undefined) return Object.assign({}, m, { content: "" });
      return m;
    });

    var runParams = { messages: [concisenessPrompt].concat(runMessages), max_tokens: maxTokens };
    if (body.temperature !== undefined) runParams.temperature = body.temperature;
    if (body.top_p !== undefined) runParams.top_p = body.top_p;
    if (body.tools) runParams.tools = body.tools;
    if (body.tool_choice !== undefined) runParams.tool_choice = body.tool_choice;
    if (body.response_format) runParams.response_format = body.response_format;
    if (body.frequency_penalty !== undefined) runParams.frequency_penalty = body.frequency_penalty;
    if (body.presence_penalty !== undefined) runParams.presence_penalty = body.presence_penalty;
    if (body.stop) runParams.stop = body.stop;
    if (body.seed !== undefined) runParams.seed = body.seed;

    console.log("Request: messages=" + runMessages.length + " tokens=" + tokens + " chain=" + chain.join("->") + " score=" + score + " codeIntent=" + codeInfo.isCode);

    for (var ti = 0; ti < chain.length; ti++) {
      var tier = chain[ti];
      var modelId = MODELS[tier];
      if (!modelId) continue;
      var responseHeaders = {
        "content-type": "application/json",
        "x-router-tier": tier,
        "x-router-model": modelId,
        "x-router-score": String(score),
        "x-router-chain": chain.join("->"),
        "x-router-reason": routingReason,
        "x-router-code-detected": String(codeInfo.isCode),
        "x-router-discovery": "dynamic-cost-aware"
      };
      try {
        var response = await runModel(env, modelId, runParams, 0);
        var content = extractContent(response);
        if (typeof content !== "string") content = String(content);
        var toolCalls = extractToolCalls(response);
        var finishReason = toolCalls && toolCalls.length > 0 ? "tool_calls" : "stop";
        console.log("Model " + modelId + " responded: contentLen=" + content.length + " toolCalls=" + (toolCalls ? toolCalls.length : 0));

        if (!toolCalls && (!content || content.trim().length === 0)) {
          console.log("EMPTY RESPONSE: " + modelId + ", retrying with cache-bypass...");
          try {
            response = await runModel(env, modelId, runParams, 1);
            content = extractContent(response);
            if (typeof content !== "string") content = String(content);
            toolCalls = extractToolCalls(response);
            finishReason = toolCalls && toolCalls.length > 0 ? "tool_calls" : "stop";
          } catch (retryErr) {
            console.error("Retry failed for " + modelId);
          }
          if (!toolCalls && (!content || content.trim().length === 0)) {
            console.log("STILL EMPTY after retry: " + modelId + ", falling through");
            continue;
          }
        }

        if (isCodeRequest && !toolCalls && !validateCodeOutput(content) && tier.startsWith("CODE_")) {
          console.log("Code validation FAILED for " + modelId + " (tier=" + tier + "), escalating");
          continue;
        }

        content = formatResponse(content, isCodeRequest);
        responseHeaders["x-router-transport"] = "binding";
        responseHeaders["x-router-code-validated"] = String(isCodeRequest ? validateCodeOutput(content) : "n/a");

        if (body.stream === true) {
          var enc = new TextEncoder();
          var cid = "chatcmpl-" + Date.now();
          var ct = Math.floor(Date.now() / 1000);
          var rs = new ReadableStream({
            start: function(ctrl) {
              if (toolCalls && toolCalls.length > 0) {
                ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: { role: "assistant", content: null }, finish_reason: null }] }) + "\n\n"));
                for (var tci = 0; tci < toolCalls.length; tci++) {
                  ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: { tool_calls: [toolCalls[tci]] }, finish_reason: null }] }) + "\n\n"));
                }
                ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] }) + "\n\n"));
              } else {
                ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] }) + "\n\n"));
                if (content && content.length > 0) {
                  ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: { content: content }, finish_reason: null }] }) + "\n\n"));
                }
                ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: response && response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }) + "\n\n"));
              }
              ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
              ctrl.close();
            }
          });
          return new Response(rs, { headers: Object.assign({ "content-type": "text/event-stream", "cache-control": "no-cache", "connection": "keep-alive" }, responseHeaders) });
        }

        var assistantMessage = { role: "assistant", content: content };
        if (toolCalls && toolCalls.length > 0) {
          assistantMessage.tool_calls = toolCalls;
          if (!content) assistantMessage.content = null;
        }
        return new Response(JSON.stringify({ id: "chatcmpl-" + Date.now(), object: "chat.completion", created: Math.floor(Date.now() / 1000), model: modelId, choices: [{ index: 0, message: assistantMessage, finish_reason: finishReason }], usage: response && response.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }), { headers: responseHeaders });
      } catch (e) {
        console.error("Model " + modelId + " failed: " + (e && e.message || e));
      }
    }
    return jsonResponse({ error: "all models failed", chain: chain.join("->"), models: MODELS }, 502);
  }
};

export { index_default as default };
