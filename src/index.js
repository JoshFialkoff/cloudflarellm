// smart-llm-router v9.7
// Uses REST API + better function-calling models + tool_choice: "required"

const MODELS = [
  "@cf/nvidia/nemotron-3-120b-a12b",
  "@cf/moonshotai/kimi-k2.6",
  "@cf/openai/gpt-oss-120b",
  "@cf/qwen/qwen3-30b-a3b-fp8",
  "@cf/openai/gpt-oss-20b"
];
const CAPACITY_RETRIES = 2;
const CAPACITY_RETRY_DELAY = 500;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

function isCapacityError(e) {
  const m = (e?.message || String(e)).toLowerCase();
  return m.includes("3040") || m.includes("capacity") || m.includes("temporarily");
}

function isContextOverflowError(e) {
  const m = (e?.message || String(e)).toLowerCase();
  return m.includes("5021") || m.includes("context window") || m.includes("exceeded");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function callModelViaREST(env, modelId, runParams) {
  const accountId = env.ACCOUNT_ID;
  const token = env.CF_API_TOKEN;
  const gatewayId = env.GATEWAY_ID;

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;

  const body = {
    model: modelId,
    messages: runParams.messages,
    max_tokens: runParams.max_tokens || 4096,
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
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
  if (gatewayId) headers["cf-aig-gateway-id"] = gatewayId;

  console.log("REST call: model=" + modelId + " tools=" + (runParams.tools ? runParams.tools.length : 0) + " tool_choice=" + JSON.stringify(runParams.tool_choice));

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const respText = await resp.text();

  if (!resp.ok) {
    console.error("REST API error " + resp.status + ": " + respText.substring(0, 500));
    throw new Error(`REST API error ${resp.status}: ${respText.substring(0, 500)}`);
  }

  const data = JSON.parse(respText);

  if (data.choices) {
    return data;
  }
  if (data.result && data.success) {
    return data.result;
  }
  return data;
}

async function runModelWithRetry(env, modelId, runParams) {
  let lastError;
  for (let attempt = 0; attempt <= CAPACITY_RETRIES; attempt++) {
    try {
      return await callModelViaREST(env, modelId, runParams);
    } catch (e) {
      lastError = e;
      console.error("Model " + modelId + " failed (attempt " + attempt + "): " + (e?.message || e));
      if (isContextOverflowError(e)) throw e;
      if (isCapacityError(e) && attempt < CAPACITY_RETRIES) {
        await sleep(CAPACITY_RETRY_DELAY);
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({ status: "ok", router: "smart-llm-router-v9.7" });
    }

    if (request.method === "GET" && (url.pathname === "/v1/models" || url.pathname === "/models")) {
      return json({
        object: "list",
        data: MODELS.map((m) => ({ id: m, object: "model", created: 1700000000, owned_by: "cloudflare" }))
          .concat([{ id: "smart-router", object: "model", created: 1700000000, owned_by: "cloudflare" }])
      });
    }

    if (request.method !== "POST") {
      if (url.pathname === "/favicon.ico") return new Response(null, { status: 404 });
      return json({ name: "smart-llm-router", version: "9.7", endpoint: "POST /v1/chat/completions" });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: "invalid JSON" }, 400);
    }

    const messages = body.messages || [];
    if (!messages.length) return json({ error: "no messages" }, 400);

    const runParams = { messages, max_tokens: body.max_tokens || 4096 };
    if (body.temperature !== undefined) runParams.temperature = body.temperature;
    if (body.top_p !== undefined) runParams.top_p = body.top_p;
    if (body.tools) {
      runParams.tools = body.tools;
      // Force tool_choice to "required" — model MUST use a tool
      if (body.tool_choice !== undefined) {
        runParams.tool_choice = body.tool_choice;
      } else {
        runParams.tool_choice = "required";
      }
    }
    if (body.response_format) runParams.response_format = body.response_format;
    if (body.frequency_penalty !== undefined) runParams.frequency_penalty = body.frequency_penalty;
    if (body.presence_penalty !== undefined) runParams.presence_penalty = body.presence_penalty;
    if (body.stop) runParams.stop = body.stop;
    if (body.seed !== undefined) runParams.seed = body.seed;

    const errors = [];

    for (const modelId of MODELS) {
      try {
        const response = await runModelWithRetry(env, modelId, runParams);

        const choice = response?.choices?.[0];
        if (!choice) {
          throw new Error("No choices in response: " + JSON.stringify(response).substring(0, 500));
        }

        const content = choice.message?.content ?? null;
        const toolCalls = choice.message?.tool_calls ?? null;
        const finishReason = choice.finish_reason || (toolCalls ? "tool_calls" : "stop");

        console.log("Model " + modelId + ": contentLen=" + (content?.length || 0) + " toolCalls=" + (toolCalls ? toolCalls.length : 0) + " finish=" + finishReason);
        if (toolCalls) {
          console.log("Tool call names: " + toolCalls.map(tc => tc.function?.name || tc.name).join(", "));
        }
        if (!toolCalls && content) {
          console.log("WARNING: text instead of tool_calls: " + content.substring(0, 200));
        }

        const responseHeaders = {
          "content-type": "application/json",
          "x-router-model": modelId,
          "x-router-transport": "rest-api"
        };

        if (body.stream === true) {
          const enc = new TextEncoder();
          const cid = response?.id || ("chatcmpl-" + Date.now());
          const ct = response?.created || Math.floor(Date.now() / 1000);
          const rs = new ReadableStream({
            start(ctrl) {
              if (toolCalls && toolCalls.length > 0) {
                ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: { role: "assistant", content: null }, finish_reason: null }] }) + "\n\n"));
                for (const tc of toolCalls) {
                  ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: { tool_calls: [tc] }, finish_reason: null }] }) + "\n\n"));
                }
                ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }] }) + "\n\n"));
              } else {
                ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: { role: "assistant", content: "" }, finish_reason: null }] }) + "\n\n"));
                if (content && content.length > 0) {
                  ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: { content }, finish_reason: null }] }) + "\n\n"));
                }
                ctrl.enqueue(enc.encode("data: " + JSON.stringify({ id: cid, object: "chat.completion.chunk", created: ct, model: modelId, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] }) + "\n\n"));
              }
              ctrl.enqueue(enc.encode("data: [DONE]\n\n"));
              ctrl.close();
            }
          });
          return new Response(rs, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache", "connection": "keep-alive", ...responseHeaders } });
        }

        const assistantMessage = { role: "assistant", content };
        if (toolCalls && toolCalls.length > 0) {
          assistantMessage.tool_calls = toolCalls;
          if (!content) assistantMessage.content = null;
        }

        return new Response(JSON.stringify({
          id: response?.id || ("chatcmpl-" + Date.now()),
          object: "chat.completion",
          created: response?.created || Math.floor(Date.now() / 1000),
          model: modelId,
          choices: [{ index: 0, message: assistantMessage, finish_reason: finishReason }],
          usage: response?.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
        }), { headers: responseHeaders });
      } catch (e) {
        const errMsg = e?.message || String(e);
        console.error("Model " + modelId + " failed: " + errMsg);
        errors.push({ model: modelId, error: errMsg });
      }
    }

    return json({ error: "all models failed", models: MODELS, errors }, 502);
  }
};
