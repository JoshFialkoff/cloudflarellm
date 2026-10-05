import { DurableObject } from "cloudflare:workers";

// ─── Sandbox Durable Object (Sandbox SDK 1.0) ────────────────────────────────

const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;

export class Sandbox extends DurableObject {
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

// ─── LLM Provider: Workers AI (default) or OpenAI (fallback) ──────────────────

async function callLLM(messages, env) {
  const provider = env.LLM_PROVIDER || "workersai";

  if (provider === "openai") {
    return await callOpenAI(messages, env);
  }
  return await callWorkersAI(messages, env);
}

async function callWorkersAI(messages, env) {
  const model = env.WORKERSAI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

  const response = await env.AI.run(model, {
    messages,
    max_tokens: 4096,
  });

  return response.response;
}

async function callOpenAI(messages, env) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY secret not set but LLM_PROVIDER=openai");

  const model = env.LLM_MODEL || "gpt-4o";
  const endpoint = env.LLM_ENDPOINT || "https://api.openai.com/v1/chat/completions";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 4096,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

// ─── Sandbox execution ───────────────────────────────────────────────────────

async function execInSandbox(env, sandboxId, command) {
  const id = env.SANDBOX.idFromName(sandboxId);
  const sandbox = env.SANDBOX.get(id);
  const result = await sandbox.exec(command);

  let output = "";
  if (result.stdout) output += result.stdout;
  if (result.stderr) output += (output ? "\n" : "") + `[stderr] ${result.stderr}`;
  if (result.exitCode !== 0) output += (output ? "\n" : "") + `[exit code: ${result.exitCode}]`;

  return output || "(no output)";
}

// ─── File upload helper ───────────────────────────────────────────────────────

async function parseMultipart(request, env, sandboxId) {
  const formData = await request.formData();
  const prompt = formData.get("prompt") || "";
  const sessionId = formData.get("sessionId") || "default";

  const files = [];

  for (const [key, value] of formData.entries()) {
    if (key === "prompt" || key === "sessionId") continue;

    if (value && typeof value === "object" && "name" in value && "size" in value) {
      const fileContent = await value.arrayBuffer();
      const filePath = `/workspace/${value.name}`;

      const base64Content = btoa(
        String.fromCharCode(...new Uint8Array(fileContent))
      );

      await execInSandbox(
        env,
        sandboxId,
        `echo '${base64Content}' | base64 -d > '${filePath}'`
      );

      files.push({ name: value.name, path: filePath });
    }
  }

  return { prompt, sessionId, files };
}

// ─── Main Worker ──────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // ─── OpenAI-compatible /v1/chat/completions endpoint ──────────────────
    // Pass-through (no sandbox). Useful for LLM providers that expect a clean LLM.
    if (url.pathname === "/v1/chat/completions" && request.method === "POST") {
      try {
        const body = await request.json();
        let messages = body.messages;
        if (!messages || !Array.isArray(messages)) {
          return new Response(JSON.stringify({ error: { message: "messages required", type: "invalid_request_error" } }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (body.stream) {
          return new Response(JSON.stringify({ error: { message: "streaming not supported", type: "invalid_request_error" } }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        // Call LLM directly — no SYSTEM_PROMPT override so the caller controls the behavior
        const content = await callLLM(messages, env);
        return new Response(JSON.stringify({
          id: "chatcmpl-" + crypto.randomUUID(),
          object: "chat.completion",
          created: Math.floor(Date.now() / 1000),
          model: body.model || "smart-llm-router",
          choices: [{
            index: 0,
            message: { role: "assistant", content },
            finish_reason: "stop"
          }],
          usage: { prompt_tokens: -1, completion_tokens: -1, total_tokens: -1 }
        }), { headers: { "Content-Type": "application/json" } });
      } catch (e) {
        return new Response(JSON.stringify({ error: { message: e.message || "internal error", type: "server_error" } }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // Main endpoint: POST / with multipart/form-data (files + prompt) or JSON
    // ─── Sandbox agent endpoint: POST /agent (full shell-execution loop) ──
    if ((url.pathname === "/" || url.pathname === "/agent") && request.method === "POST") {
      const contentType = request.headers.get("Content-Type") || "";
      const maxIterations = parseInt(env.MAX_ITERATIONS || "25", 10);

      let userPrompt, sessionId, uploadedFiles;

      if (contentType.includes("multipart/form-data")) {
        sessionId = (url.searchParams.get("sessionId") || "default");
        const sandboxId = `${env.SANDBOX_ID_PREFIX || "llm-session"}-${sessionId}`;
        const parsed = await parseMultipart(request, env, sandboxId);
        userPrompt = parsed.prompt;
        sessionId = parsed.sessionId;
        uploadedFiles = parsed.files;

        if (uploadedFiles.length > 0) {
          const fileList = uploadedFiles.map((f) => `- ${f.path}`).join("\n");
          userPrompt = `Environment: Linux container. Available tools: git, python3, node, npm, curl, pip, cat, ls, mkdir, tee.\n\nUploaded files:\n${fileList}\n\nTask: ${userPrompt}`;
        } else {
          userPrompt = `Environment: Linux container. Available tools: git, python3, node, npm, curl, pip, cat, ls, mkdir, tee.\n\nTask: ${userPrompt}`;
        }
      } else {
        const body = await request.json();
        userPrompt = `Environment: Linux container. Available tools: git, python3, node, npm, curl, pip, cat, ls, mkdir, tee.\n\nTask: ${body.prompt}`;
        sessionId = body.sessionId || "default";
        uploadedFiles = [];
      }

      if (!userPrompt) {
        return new Response(JSON.stringify({ error: "Missing 'prompt' field" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const sandboxId = `${env.SANDBOX_ID_PREFIX || "llm-session"}-${sessionId}`;

      const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ];

      const executionLog = [];

      for (let i = 0; i < maxIterations; i++) {
        const llmResponse = await callLLM(messages, env);
        messages.push({ role: "assistant", content: llmResponse });

        if (isTaskComplete(llmResponse)) {
          break;
        }

        const codeBlocks = extractCodeBlocks(llmResponse);

        if (codeBlocks.length === 0) {
          messages.push({
            role: "user",
            content: llmResponse.trim().length < 100
              ? "Skip the explanation. Output a ```bash code block with your next command now."
              : "You must output shell commands in a ```bash code block. Please continue.",
          });
          continue;
        }

        for (const code of codeBlocks) {
          const output = await execInSandbox(env, sandboxId, code);
          executionLog.push({ command: code, output });
          messages.push({
            role: "user",
            content: `Command output:\n\n${output}`,
          });
        }
      }

      return new Response(
        JSON.stringify(
          {
            sessionId,
            sandboxId,
            provider: env.LLM_PROVIDER || "workersai",
            model: env.WORKERSAI_MODEL || "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
            uploadedFiles,
            iterations: messages.filter((m) => m.role === "assistant").length,
            finalResponse: messages[messages.length - 1]?.content,
            executionLog,
            messages,
          },
          null,
          2
        ),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // Download a file from the sandbox
    if (url.pathname === "/file" && request.method === "GET") {
      const sessionId = url.searchParams.get("session") || "default";
      const filePath = url.searchParams.get("path");
      if (!filePath) {
        return new Response(JSON.stringify({ error: "Missing 'path' parameter" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const sandboxId = `${env.SANDBOX_ID_PREFIX || "llm-session"}-${sessionId}`;
      const output = await execInSandbox(env, sandboxId, `cat '${filePath}'`);

      return new Response(output, {
        headers: { "Content-Type": "text/plain" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
