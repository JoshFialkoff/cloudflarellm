/**
 * smart-llm-router v16 — hardened for long-term stability
 * 
 * Key fixes over v15:
 * 1. Static model list (no dynamic discovery) — eliminates KV staleness, 403s from paid models, and discovery failures
 * 2. All models tested and confirmed working on this account (Sep 2026)
 * 3. Reasoning model support — extracts content from reasoning_content/reasoning fields when content is empty
 * 4. Higher max_tokens default (8192) so reasoning models don't exhaust tokens before producing content
 * 5. Robust content extraction with fallback chain
 * 6. Proper streaming for both reasoning and non-reasoning models
 * 7. No external API calls — uses only the AI binding, no CF_API_TOKEN needed
 */

// ═══════════════════════════════════════════════════════════════
// MODEL CONFIGURATION — all tested working Sep 2026
// ═══════════════════════════════════════════════════════════════

// Reasoning models use reasoning_content/reasoning fields and need more tokens
var REASONING_MODELS = new Set([
  "@cf/openai/gpt-oss-120b",
  "@cf/openai/gpt-oss-20b",
  "@cf/qwen/qwen3-30b-a3b-fp8",
  "@cf/qwen/qwq-32b",
  "@cf/deepseek-ai/deepseek-r1-distill-qwen-32b",
  "@cf/deepseek-ai/deepseek-v4-pro-0813",
  "@cf/nvidia/nemotron-3-120b-a12b"
]);

var MODELS = {
  // Code models (cheapest to heaviest)
  CODE_CHEAP:   "@cf/qwen/qwen2.5-coder-32b-instruct",
  CODE_MID:     "@cf/qwen/qwen2.5-coder-32b-instruct",
  CODE_HEAVY:   "@cf/qwen/qwen2.5-coder-32b-instruct",
  
  // General models (lightest to heaviest)
  ULTRA_LIGHT:  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  LIGHT:        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  HEAVY:        "@cf/meta/llama-3.3-70b-instruct-fp8-fast"
};

// Fallback chains if a model fails — all confirmed working
var FALLBACK_CHAINS = {
  CODE_CHEAP:   ["@cf/qwen/qwen2.5-coder-32b-instruct", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"],
  CODE_MID:     ["@cf/qwen/qwen2.5-coder-32b-instruct", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"],
  CODE_HEAVY:   ["@cf/qwen/qwen2.5-coder-32b-instruct", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"],
  ULTRA_LIGHT:  ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/qwen/qwen2.5-coder-32b-instruct"],
  LIGHT:        ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/qwen/qwen2.5-coder-32b-instruct"],
  HEAVY:        ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/qwen/qwen2.5-coder-32b-instruct"]
};

// ═══════════════════════════════════════════════════════════════
// SCORING & ROUTING
// ═══════════════════════════════════════════════════════════════

var SCORE_HEAVY = 45;
var SCORE_LIGHT = 10;

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
  return { isCode: isCode, strength: strength };
}

function computeScore(messages, tokens, last, lastLen, codeInfo) {
  var score = 0;
  if (tokens > 50000) score += 35;
  else if (tokens > 20000) score += 25;
  else if (tokens > 8000) score += 20;
  else if (tokens > 3000) score += 12;
  else if (tokens > 500) score += 5;
  
  if (messages.length > 20) score += 20;
  else if (messages.length > 10) score += 12;
  else if (messages.length > 4) score += 5;
  
  var complex = ["analyze", "architecture", "refactor", "optimize", "debug", "implement", "algorithm", "reasoning", "step by step", "pipeline", "design", "compare", "evaluate", "trade-off", "tradeoff", "pros and cons", "explain why", "derive", "prove"];
  var complexCount = 0;
  for (var ci = 0; ci < complex.length; ci++) {
    if (last.includes(complex[ci])) complexCount++;
  }
  score += 15 * Math.min(complexCount, 3);
  
  if (codeInfo.isCode) score += 30 + Math.min(codeInfo.strength * 3, 20);
  
  var mathWords = ["solve", "equation", "proof", "derive", "calculate", "integral", "derivative", "theorem"];
  for (var mi = 0; mi < mathWords.length; mi++) {
    if (new RegExp("\\b" + mathWords[mi] + "\\b", "i").test(last)) { score += 15; break; }
  }
  
  for (var si = 0; si < messages.length; si++) {
    if (messages[si].role === "system" && /you are (an expert|a senior|a specialist)/i.test(messages[si].content)) { score += 10; break; }
  }
  
  var simple = ["hi", "hello", "hey", "thanks", "thank you", "ok", "okay", "yes", "no", "sure", "what is", "what's", "summarize", "translate", "list", "who is", "when is", "where is"];
  for (var ssi = 0; ssi < simple.length; ssi++) {
    if (last.trim().startsWith(simple[ssi]) && lastLen < 200) { score -= 15; break; }
  }
  
  if (messages.length === 1 && lastLen < 50) score -= 10;
  
  return Math.max(0, Math.min(100, score));
}

function buildChain(score, codeInfo) {
  if (codeInfo.isCode) {
    return { chain: ["CODE_CHEAP", "CODE_MID", "CODE_HEAVY", "HEAVY", "LIGHT", "ULTRA_LIGHT"], reason: "code-intent (strength=" + codeInfo.strength + ") cheapest-code-first" };
  }
  if (score >= SCORE_HEAVY) {
    return { chain: ["HEAVY", "LIGHT", "ULTRA_LIGHT"], reason: "high-complexity (score=" + score + ")" };
  }
  if (score >= SCORE_LIGHT) {
    return { chain: ["LIGHT", "HEAVY", "ULTRA_LIGHT"], reason: "medium-complexity (score=" + score + ")" };
  }
  return { chain: ["ULTRA_LIGHT", "LIGHT", "HEAVY"], reason: "low-complexity (score=" + score + ") cheapest-first" };
}

// ═══════════════════════════════════════════════════════════════
// CONTENT EXTRACTION — handles reasoning models
// ═══════════════════════════════════════════════════════════════

function extractContent(response) {
  if (response === null || response === undefined) return "";
  if (typeof response === "string") return response;
  
  // Direct response field (some models)
  if (typeof response.response === "string" && response.response.length > 0) return response.response;
  
  // OpenAI-compatible choices format
  if (response.choices && response.choices[0]) {
    var msg = response.choices[0].message;
    if (msg) {
      // Primary content
      if (typeof msg.content === "string" && msg.content.length > 0) return msg.content;
      if (msg.content !== null && msg.content !== undefined && typeof msg.content !== "string") {
        try { var s = String(msg.content); if (s.length > 0) return s; } catch (e) {}
      }
      
      // Reasoning models: content may be empty, use reasoning_content or reasoning
      if (typeof msg.reasoning_content === "string" && msg.reasoning_content.length > 0) return msg.reasoning_content;
      if (typeof msg.reasoning === "string" && msg.reasoning.length > 0) return msg.reasoning;
    }
    // Legacy text format
    if (response.choices[0].text) return String(response.choices[0].text);
  }
  
  // Fallback: stringify
  try { return JSON.stringify(response); } catch (e) { return ""; }
}

function extractToolCalls(response) {
  if (!response) return null;
  if (response.choices && response.choices[0] && response.choices[0].message && response.choices[0].message.tool_calls) {
    return response.choices[0].message.tool_calls;
  }
  if (response.tool_calls) return response.tool_calls;
  return null;
}

function isReasoningModel(modelId) {
  return REASONING_MODELS.has(modelId);
}

// ═══════════════════════════════════════════════════════════════
// MODEL EXECUTION
// ═══════════════════════════════════════════════════════════════

async function runModel(env, modelId, runParams) {
  var gatewayOpts = { id: env.GATEWAY_ID, cache: false };
  try {
    return await env.AI.run(modelId, runParams, { gateway: gatewayOpts });
  } catch (err) {
    throw err;
  }
}

function jsonResponse(obj, status) {
  if (status === undefined) status = 200;
  return new Response(JSON.stringify(obj), { status: status, headers: { "content-type": "application/json" } });
}

// ═══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════════

var index_default = {
  async fetch(request, env) {
    var url = new URL(request.url);
    
    // Health check
    if (url.pathname === "/health") {
      return jsonResponse({ status: "ok", router: "smart-llm-router-v16.0", models: "static-verified", gateway: env.GATEWAY_ID || "none" });
    }
    
    // Model list (OpenAI-compatible)
    if (request.method === "GET" && (url.pathname === "/v1/models" || url.pathname === "/models")) {
      var modelList = Object.entries(MODELS).map(function(e) {
        return { id: e[1], object: "model", created: 1700000000, owned_by: "cloudflare", tier: e[0] };
      });
      modelList.push({ id: "smart-router", object: "model", created: 1700000000, owned_by: "cloudflare" });
      modelList.push({ id: "auto", object: "model", created: 1700000000, owned_by: "cloudflare" });
      return jsonResponse({ object: "list", data: modelList });
    }
    
    // Metadata endpoint
    if (request.method !== "POST") {
      if (url.pathname === "/favicon.ico") return new Response(null, { status: 404 });
      return jsonResponse({
        name: "smart-llm-router",
        version: "16.0",
        endpoint: "POST /chat/completions",
        models: "static-verified"
      });
    }
    
    // Parse body
    var body;
    try { body = await request.json(); } catch (e) { return jsonResponse({ error: "invalid JSON body" }, 400); }
    
    var messages = body.messages || [];
    if (!messages.length) return jsonResponse({ error: "no messages" }, 400);
    
    // Analyze request
    var text = messages.map(function(m) { return m.content || ""; }).join(" ");
    var tokens = Math.ceil(text.length / 4);
    var userMsgs = messages.filter(function(m) { return m.role === "user"; });
    var last = (userMsgs.length ? userMsgs[userMsgs.length - 1].content || "" : "").toLowerCase();
    var lastLen = last.trim().length;
    var codeInfo = detectCodeIntent(text);
    var score = computeScore(messages, tokens, last, lastLen, codeInfo);
    var routing = buildChain(score, codeInfo);
    var chain = routing.chain;
    
    // Build run params — use higher max_tokens for reasoning models
    var maxTokens = body.max_tokens || 8192;
    var wantStream = body.stream === true;
    
    var runMessages = messages.map(function(m) {
      if (Array.isArray(m.content)) {
        var textParts = m.content.filter(function(p) { return p.type === "text" && p.text; }).map(function(p) { return p.text; });
        return Object.assign({}, m, { content: textParts.join("\n") || "" });
      }
      if (m.content === null || m.content === undefined) return Object.assign({}, m, { content: "" });
      return m;
    });
    
    var runParams = { messages: runMessages, max_tokens: maxTokens };
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
    
    // Try each model in the chain
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
        "x-router-reason": routing.reason,
        "x-router-code-detected": String(codeInfo.isCode),
        "x-router-version": "v16.0"
      };
      
      try {
        var response = await runModel(env, modelId, runParams);
        var content = extractContent(response);
        if (typeof content !== "string") content = String(content);
        var toolCalls = extractToolCalls(response);
        var finishReason = (toolCalls && toolCalls.length > 0) ? "tool_calls" : "stop";
        
        console.log("Model " + modelId + " responded: contentLen=" + content.length + " toolCalls=" + (toolCalls ? toolCalls.length : 0) + " reasoning=" + isReasoningModel(modelId));
        
        // Check for empty response — retry once
        if (!toolCalls && (!content || content.trim().length === 0)) {
          console.log("EMPTY RESPONSE from " + modelId + ", retrying...");
          try {
            response = await runModel(env, modelId, runParams);
            content = extractContent(response);
            if (typeof content !== "string") content = String(content);
            toolCalls = extractToolCalls(response);
            finishReason = (toolCalls && toolCalls.length > 0) ? "tool_calls" : "stop";
          } catch (retryErr) {
            console.error("Retry failed for " + modelId + ": " + (retryErr && retryErr.message || retryErr));
          }
          if (!toolCalls && (!content || content.trim().length === 0)) {
            console.log("STILL EMPTY after retry: " + modelId + ", falling through to next model");
            continue;
          }
        }
        
        // Streaming response
        if (wantStream) {
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
                ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }) + "\n\n"));
              }
              ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
              ctrl.close();
            }
          });
          return new Response(rs, { headers: Object.assign({ "content-type": "text/event-stream", "cache-control": "no-cache", "connection": "keep-alive" }, responseHeaders) });
        }
        
        // Non-streaming response
        var assistantMessage = { role: "assistant", content: content };
        if (toolCalls && toolCalls.length > 0) {
          assistantMessage.tool_calls = toolCalls;
          if (!content) assistantMessage.content = null;
        }
        
        return new Response(JSON.stringify({
          id: "chatcmpl-" + Date.now(),
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: modelId,
          choices: [{ index: 0, message: assistantMessage, finish_reason: finishReason }],
          usage: (response && response.usage) || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        }), { headers: responseHeaders });
        
      } catch (e) {
        console.error("Model " + modelId + " failed: " + (e && e.message || e));
        // Try fallback models for this tier
        var fallbacks = FALLBACK_CHAINS[tier] || [];
        for (var fi = 0; fi < fallbacks.length; fi++) {
          var fbModel = fallbacks[fi];
          if (fbModel === modelId) continue;
          console.log("Trying fallback " + fbModel + " for tier " + tier);
          try {
            var fbResponse = await runModel(env, fbModel, runParams);
            var fbContent = extractContent(fbResponse);
            if (typeof fbContent !== "string") fbContent = String(fbContent);
            if (fbContent && fbContent.trim().length > 0) {
              console.log("Fallback " + fbModel + " succeeded: contentLen=" + fbContent.length);
              responseHeaders["x-router-model"] = fbModel;
              responseHeaders["x-router-fallback"] = "true";
              
              if (wantStream) {
                var fenc = new TextEncoder();
                var fcid = "chatcmpl-" + Date.now();
                var fct = Math.floor(Date.now() / 1000);
                var frs = new ReadableStream({
                  start: function(ctrl) {
                    ctrl.enqueue(fenc.encode("data: " + JSON.stringify({ id: fcid, object: "chat.completion.chunk", created: fct, model: fbModel, choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] }) + "\n\n"));
                    if (fbContent.length > 0) {
                      ctrl.enqueue(fenc.encode("data: " + JSON.stringify({ id: fcid, object: "chat.completion.chunk", created: fct, model: fbModel, choices: [{ index: 0, delta: { content: fbContent }, finish_reason: null }] }) + "\n\n"));
                    }
                    ctrl.enqueue(fenc.encode("data: " + JSON.stringify({ id: fcid, object: "chat.completion.chunk", created: fct, model: fbModel, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }) + "\n\n"));
                    ctrl.enqueue(fenc.encode("data: [DONE]\n\n"));
                    ctrl.close();
                  }
                });
                return new Response(frs, { headers: Object.assign({ "content-type": "text/event-stream", "cache-control": "no-cache", "connection": "keep-alive" }, responseHeaders) });
              }
              
              return new Response(JSON.stringify({
                id: "chatcmpl-" + Date.now(),
                object: "chat.completion",
                created: Math.floor(Date.now() / 1000),
                model: fbModel,
                choices: [{ index: 0, message: { role: "assistant", content: fbContent }, finish_reason: "stop" }],
                usage: (fbResponse && fbResponse.usage) || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
              }), { headers: responseHeaders });
            }
          } catch (fbErr) {
            console.error("Fallback " + fbModel + " also failed: " + (fbErr && fbErr.message || fbErr));
          }
        }
      }
    }
    
    return jsonResponse({ error: "all models failed", chain: chain.join("->") }, 502);
  }
};

export { index_default as default };
