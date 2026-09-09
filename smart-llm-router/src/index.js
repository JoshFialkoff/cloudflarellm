// smart-llm-router v12.1
// REST-API-based LLM router with capacity retry, context overflow handling,
// model fallthrough, tool/function-calling support, code execution, and streaming.

const MODELS = [
  "@cf/zai-org/glm-4.7-flash",
  "@cf/openai/gpt-oss-20b",
  "@cf/nvidia/nemotron-3-120b-a12b",
  "@cf/moonshotai/kimi-k2.6",
  "@cf/openai/gpt-oss-120b",
  "@cf/qwen/qwen3-30b-a3b-fp8",
];

const TOOL_MODELS = [
  "@cf/moonshotai/kimi-k2.6",
  "@cf/nvidia/nemotron-3-120b-a12b",
  "@cf/openai/gpt-oss-20b",
  "@cf/openai/gpt-oss-120b",
];

const CAPACITY_RETRIES = 2;
const CAPACITY_RETRY_DELAY = 200;
const DEFAULT_MAX_TOKENS = 8192;
const MAX_CONTINUATIONS = 3;

const SYSTEM_PROMPT =
  "CRITICAL RULE: You can ONLY output JavaScript code in fenced code blocks. You CANNOT run shell commands, curl, html2text, uvx, ddgs, firecrawl, or any CLI tools. You do NOT have a filesystem. If asked to search, compute, or perform any task, write JavaScript code in a javascript code block. The system will execute it automatically. Never output bash, shell, or curl commands. Example:\n\n```javascript\nconst result = 2 + 2;\nconsole.log(result);\n```";

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
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
  return m.includes("5021") || m.includes("context window") || m.includes("exceeded");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isEmptyResponse(result) {
  const noContent = !result.content || result.content.trim().length === 0;
  const noToolCalls = !result.toolCalls || result.toolCalls.length === 0;
  return noContent && noToolCalls;
}

function extractCodeBlocks(text) {
  const blocks = [];
  const regex = /```(?:javascript|js|typescript|ts)\n([\s\S]*?)```/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

async function executeCodeSafely(env, code) {
  const loader = env.LOADER || env.Loader;
  if (!loader) {
    return { success: false, error: "No LOADER binding available" };
  }
  try {
    const wrappedCode =
      "let _output = [];\n" +
      "const _origLog = console.log;\n" +
      "console.log = (...args) => { _output.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')); };\n" +
      "try {\n" +
      code +
      "\n} catch(e) { _output.push('Error: ' + e.message); }\n" +
      "export default { async fetch(request) { return new Response(_output.join('\\n') || '(no output)'); } };";

    const worker = loader.load({
      compatibilityDate: "2026-01-01",
      mainModule: "src/index.js",
      modules: { "src/index.js": wrappedCode },
      globalOutbound: null,
    });
    const entrypoint = worker.getEntrypoint();
    const result = await entrypoint.fetch(new Request("https://sandbox.local/"));
    const output = await result.text();
    return { success: true, output, status: result.status };
  } catch (e) {
    return { success: false, error: e?.message || String(e) };
  }
}

async function executeCodeBlocks(env, text) {
  const blocks = extractCodeBlocks(text);
  if (blocks.length === 0) return null;
  const results = [];
  for (let i = 0; i < blocks.length; i++) {
    console.log("Executing code block " + (i + 1) + "/" + blocks.length);
    const result = await executeCodeSafely(env, blocks[i]);
    results.push({ blockIndex: i, ...result });
  }
  return results;
}

async function callModelViaREST(env, modelId, runParams, stream) {
  const url =
    "https://api.cloudflare.com/client/v4/accounts/" +
    env.ACCOUNT_ID +
    "/ai/v1/chat/completions";

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

  const headers = {
    Authorization: "Bearer " + env.CF_API_TOKEN,
    "Content-Type": "application/json",
  };
  if (env.GATEWAY_ID) headers["cf-aig-gateway-id"] = env.GATEWAY_ID;

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

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
  let allContent = "",
    allToolCalls = [],
    responseId = null,
    created = null,
    lastFinishReason = null,
    continuationCount = 0;
  let currentMessages = runParams.messages.slice();

  while (continuationCount <= MAX_CONTINUATIONS) {
    const response = await runModelWithRetry(env, modelId, {
      ...runParams,
      messages: currentMessages,
    });

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

    console.log(
      "Model " +
        modelId +
        ": contentLen=" +
        (allContent?.length || 0) +
        " finish=" +
        finishReason +
        " continuation=" +
        continuationCount
    );

    if (finishReason !== "length") break;
    if (toolCalls) break;
    if (!content) break;

    continuationCount++;
    currentMessages = runParams.messages.slice();
    currentMessages.push({ role: "assistant", content: allContent });
    currentMessages.push({
      role: "user",
      content: "Continue from where you left off. Do not repeat any previous content.",
    });
  }

  return {
    content: allContent || null,
    toolCalls: allToolCalls.length > 0 ? allToolCalls : null,
    finishReason: lastFinishReason,
    responseId,
    created,
  };
}

function fakeStreamResponse(
  content,
  toolCalls,
  finishReason,
  modelId,
  responseId,
  created,
  executionResults
) {
  const enc = new TextEncoder();
  const cid = responseId || "chatcmpl-" + Date.now();
  const ct = created || Math.floor(Date.now() / 1e3);

  const rs = new ReadableStream({
    start(ctrl) {
      ctrl.enqueue(
        enc.encode(
          "data: " +
            JSON.stringify({
              id: cid,
              object: "chat.completion.chunk",
              created: ct,
              model: modelId,
              choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }],
            }) +
            "\n\n"
        )
      );

      if (content && content.length > 0) {
        for (let i = 0; i < content.length; i += 100) {
          ctrl.enqueue(
            enc.encode(
              "data: " +
                JSON.stringify({
                  id: cid,
                  object: "chat.completion.chunk",
                  created: ct,
                  model: modelId,
                  choices: [
                    { index: 0, delta: { content: content.slice(i, i + 100) }, finish_reason: null },
                  ],
                }) +
                "\n\n"
            )
          );
        }
      }

      if (executionResults && executionResults.length > 0) {
        let execText = "\n\n--- Code Execution Results ---\n";
        for (const r of executionResults) {
          execText += "Block " + (r.blockIndex + 1) + ": " + (r.success ? r.output : "Error: " + r.error) + "\n";
        }
        for (let i = 0; i < execText.length; i += 100) {
          ctrl.enqueue(
            enc.encode(
              "data: " +
                JSON.stringify({
                  id: cid,
                  object: "chat.completion.chunk",
                  created: ct,
                  model: modelId,
                  choices: [
                    { index: 0, delta: { content: execText.slice(i, i + 100) }, finish_reason: null },
                  ],
                }) +
                "\n\n"
            )
          );
        }
      }

      if (toolCalls && toolCalls.length > 0) {
        for (let tc of toolCalls) {
          const tcDelta = {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: tc._index || 0,
                  id: tc.id || "call_" + Date.now(),
                  type: "function",
                  function: {
                    name: tc.function?.name || tc.name,
                    arguments: tc.function?.arguments || "{}",
                  },
                },
              ],
            },
            finish_reason: null,
          };
          ctrl.enqueue(
            enc.encode(
              "data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [tcDelta] }) + "\n\n"
            )
          );
        }
        ctrl.enqueue(
          enc.encode(
            "data: " +
              JSON.stringify({
                id: cid,
                object: "chat.completion.chunk",
                created: ct,
                model: modelId,
                choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
              }) +
              "\n\n"
          )
        );
      } else {
        ctrl.enqueue(
          enc.encode(
            "data: " +
              JSON.stringify({
                id: cid,
                object: "chat.completion.chunk",
                created: ct,
                model: modelId,
                choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
              }) +
              "\n\n"
          )
        );
      }

      ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
      ctrl.close();
    },
  });

  return new Response(rs, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-router-model": modelId,
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        status: "ok",
        router: "smart-llm-router-v12.1",
        models: MODELS,
        toolModels: TOOL_MODELS,
      });
    }

    if (request.method === "GET" && (url.pathname === "/v1/models" || url.pathname === "/models")) {
      return json({
        object: "list",
        data: MODELS.map((m) => ({
          id: m,
          object: "model",
          created: 17e8,
          owned_by: "cloudflare",
        })).concat([
          { id: "smart-router", object: "model", created: 17e8, owned_by: "cloudflare" },
        ]),
      });
    }

    if (request.method !== "POST") {
      if (url.pathname === "/favicon.ico") return new Response(null, { status: 404 });
      return json({
        name: "smart-llm-router",
        version: "12.1",
        endpoint: "POST /v1/chat/completions",
      });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid JSON" }, 400);
    }

    const messages = body.messages || [];
    if (!messages.length) return json({ error: "no messages" }, 400);

    const hasTools = body.tools && body.tools.length > 0;
    const systemPrompt = SYSTEM_PROMPT;

    const systemIdx = messages.findIndex((m) => m.role === "system");
    if (systemIdx >= 0) {
      messages[systemIdx].content = systemPrompt + "\n\n" + messages[systemIdx].content;
    } else {
      messages.unshift({ role: "system", content: systemPrompt });
    }

    const runParams = { messages, max_tokens: body.max_tokens || DEFAULT_MAX_TOKENS };
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
    const errors = [];
    const modelList = hasTools ? TOOL_MODELS : MODELS;

    for (const modelId of modelList) {
      try {
        const result = await runModelWithContinuation(env, modelId, runParams);

        if (isEmptyResponse(result)) {
          console.log("Empty response from " + modelId + " — falling through");
          errors.push({ model: modelId, error: "empty response" });
          continue;
        }

        console.log(
          "Model " +
            modelId +
            ": contentLen=" +
            (result.content?.length || 0) +
            " toolCalls=" +
            (result.toolCalls ? result.toolCalls.length : 0) +
            " finish=" +
            result.finishReason
        );

        if (result.toolCalls) {
          console.log(
            "Tool call names: " + result.toolCalls.map((tc) => tc.function?.name || tc.name).join(", ")
          );
        }

        let executionResults = null;
        if (result.content && !hasTools) {
          executionResults = await executeCodeBlocks(env, result.content);
        }

        if (wantsStream) {
          return fakeStreamResponse(
            result.content,
            result.toolCalls,
            result.finishReason,
            modelId,
            result.responseId,
            result.created,
            executionResults
          );
        }

        const responseHeaders = {
          "content-type": "application/json",
          "x-router-model": modelId,
          "x-router-transport": "rest-api",
        };

        const assistantMessage = { role: "assistant", content: result.content };
        if (result.toolCalls && result.toolCalls.length > 0) {
          assistantMessage.tool_calls = result.toolCalls;
          if (!result.content) assistantMessage.content = null;
        }

        const responseBody = {
          id: result.responseId || "chatcmpl-" + Date.now(),
          object: "chat.completion",
          created: result.created || Math.floor(Date.now() / 1e3),
          model: modelId,
          choices: [{ index: 0, message: assistantMessage, finish_reason: result.finishReason }],
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
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

    return json({ error: "all models failed", models: modelList, errors }, 502);
  },
};
