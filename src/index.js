import { DurableObject } from "cloudflare:workers";

// ─── Sandbox Durable Object (Sandbox SDK 1.0) ────────────────────────────────

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

export class SandboxV2 extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    const container = ctx.container;
    if (!container) {
      throw new Error("The container binding is not configured");
    }
    this.container = container;
    if (container.running) {
      void ctx.blockConcurrencyWhile(() =>
        container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS)
      );
    }
  }

  async ensureRunning() {
    if (!this.container.running) {
      await this.container.start({
        image: this.container.images.sandbox,
        instance: "lite",
        enableInternet: true,
      });
      await this.container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);
    }
  }

  async exec(command) {
    await this.ensureRunning();
    const process = await this.container.exec(["bash", "-lc", command], {
      cwd: "/workspace",
    });
    const output = await process.output();
    const decoder = new TextDecoder();
    return {
      exitCode: output.exitCode,
      stdout: decoder.decode(output.stdout),
      stderr: decoder.decode(output.stderr),
    };
  }
}

// ─── System Prompt: Enforce shell-based code execution ───────────────────────

const SYSTEM_PROMPT = `You are an AI coding assistant that executes tasks by writing shell commands.

RULES (mandatory):
1. You MUST output shell commands inside fenced code blocks tagged \`\`\`bash or \`\`\`sh.
2. You MUST NOT output code in any other language block. All work goes through the shell.
3. You can run any command available in a Linux environment: git, curl, python3, node, npm, pip, cat, ls, mkdir, etc.
4. Write files using heredocs or tee. Run scripts with python3 or node.
5. After each command block, the system will execute it and return stdout/stderr.
6. Read the output, then continue with the next step or declare completion.
7. Keep each command block focused — one logical step per block.
8. If a command fails, read the error, fix it, and retry.
9. When the task is fully complete, respond with exactly: TASK_COMPLETE

CRITICAL: Do NOT explain your reasoning before commands. Start EVERY response with a \`\`\`bash code block immediately. No preamble, no "Let me check...", no "I'll now...". Just the command.
If you need to check what tools are available, run \`which git node python3 npm curl\` once in your first command block, then proceed.

Example interaction:
User: Create a Python script that prints the first 10 Fibonacci numbers and run it.
Assistant:
\`\`\`bash
cat > /workspace/fib.py << 'EOF'
for i in range(10):
    a, b = 0, 1
    for _ in range(i):
        a, b = b, a + b
    print(a)
EOF
\`\`\`
System (stdout): (file created)
Assistant:
\`\`\`bash
python3 /workspace/fib.py
\`\`\`
System (stdout): 0\n1\n1\n2\n3\n5\n8\n13\n21\n34
Assistant: TASK_COMPLETE`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractCodeBlocks(text) {
  const blocks = [];
  const regex = /```(?:bash|sh|shell)?\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

function isTaskComplete(text) {
  return /\bTASK_COMPLETE\b/i.test(text);
}

function simulateOpenAIStream(content, body = {}) {
  const id = "chatcmpl-" + crypto.randomUUID();
  const created = Math.floor(Date.now() / 1000);
  const model = body.model || "smart-llm-router";
  const encoder = new TextEncoder();

  function makeChunk(delta, finishReason = null) {
    return `data: ${JSON.stringify({
      id,
      object: "chat.completion.chunk",
      created,
      model,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    })}\n\n`;
  }

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(makeChunk({ role: "assistant" })));

      const words = typeof content === "string" ? content.match(/\S+\s*/g) || [content] : [content];
      for (const word of words) {
        controller.enqueue(encoder.encode(makeChunk({ content: word })));
      }

      controller.enqueue(encoder.encode(makeChunk({}, "stop")));
      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });
}

// ─── LLM Provider: Workers AI (default) or OpenAI (fallback) ──────────────────

async function callLLM(messages, env, body = {}) {
  const provider = env.LLM_PROVIDER || "workersai";

  if (provider === "openai") {
    return await callOpenAI(messages, env, body);
  }

  const response = await callWorkersAI(messages, env, body);

  // Agent endpoint only needs text content; extract it from the full Workers AI object.
  if (typeof response === "string") return response;
  if (response.response) return response.response;
  if (response.result && response.result.response) return response.result.response;
  if (response.choices && response.choices[0]) return response.choices[0].message.content;
  throw new Error("Unexpected Workers AI response shape: " + JSON.stringify(response).slice(0, 500));
}

async function callLLMStream(messages, env, body = {}) {
  const provider = env.LLM_PROVIDER || "workersai";

  if (provider === "openai") {
    // OpenAI fallback: non-stream call simulated as a stream.
    const content = await callOpenAI(messages, env, body);
    return simulateOpenAIStream(content, body);
  }

  return await callWorkersAIStream(messages, env, body);
}

async function callWorkersAI(messages, env, body = {}) {
  const model = env.WORKERSAI_MODEL || "@cf/qwen/qwen3.8-27b";

  const aiBody = {
    messages,
    max_tokens: body.max_tokens || 4096,
  };

  if (body.tools) aiBody.tools = body.tools;
  if (body.tool_choice) aiBody.tool_choice = body.tool_choice;

  const response = await env.AI.run(model, aiBody);

  // Return the full response object so callers can access both .response and .tool_calls.
  return response;
}

async function callWorkersAIStream(messages, env, body = {}) {
  const model = env.WORKERSAI_MODEL || "@cf/qwen/qwen3.8-27b";

  const aiBody = {
    messages,
    max_tokens: body.max_tokens || 4096,
    stream: true,
  };

  if (body.tools) aiBody.tools = body.tools;
  if (body.tool_choice) aiBody.tool_choice = body.tool_choice;

  const aiResponse = await env.AI.run(model, aiBody);

  const isStream =
    aiResponse != null &&
    typeof aiResponse[Symbol.asyncIterator] === "function";

  const id = "chatcmpl-" + crypto.randomUUID();
  const created = Math.floor(Date.now() / 1000);
  const responseModel = body.model || "smart-llm-router";
  const encoder = new TextEncoder();

  function makeChunk(delta, finishReason = null) {
    return `data: ${JSON.stringify({
      id,
      object: "chat.completion.chunk",
      created,
      model: responseModel,
      choices: [{ index: 0, delta, finish_reason: finishReason }],
    })}\n\n`;
  }

  if (isStream) {
    return new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(makeChunk({ role: "assistant" })));

        let hasContent = false;
        for await (const chunk of aiResponse) {
          const text =
            typeof chunk === "string"
              ? chunk
              : chunk?.response;

          if (text) {
            hasContent = true;
            controller.enqueue(encoder.encode(makeChunk({ content: text })));
          }
        }

        controller.enqueue(encoder.encode(makeChunk({}, hasContent ? "stop" : null)));
        controller.enqueue(encoder.encode(`*
