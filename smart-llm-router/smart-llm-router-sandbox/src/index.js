export { Sandbox } from "@cloudflare/sandbox";

import { getSandbox } from "@cloudflare/sandbox";

// --- System Prompt: Enforce shell-based code execution ---

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

// --- Helpers ---

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

async function callLLM(messages, env) {
  // Option A: Cloudflare Workers AI (uncomment if using Workers AI binding)
  // const response = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
  //   messages,
  //   max_tokens: 2048,
  // });
  // return response.response;

  // Option B: OpenAI-compatible API
  const apiKey = env.OPENAI_API_KEY;
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
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`LLM API error ${response.status}: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function execInSandbox(env, sandboxId, command) {
  const sandbox = getSandbox(env.SANDBOX, sandboxId);
  const handle = await sandbox.exec(["bash", "-c", command]);

  let output = "";
  for await (const chunk of handle.stdout) {
    output += new TextDecoder().decode(chunk);
  }
  let stderr = "";
  for await (const chunk of handle.stderr) {
    stderr += new TextDecoder().decode(chunk);
  }

  const exitStatus = await handle.exited;

  let result = "";
  if (output) result += output;
  if (stderr) result += (result ? "\n" : "") + `[stderr] ${stderr}`;
  if (exitStatus.code !== 0) result += (result ? "\n" : "") + `[exit code: ${exitStatus.code}]`;

  return result || "(no output)";
}

// --- Main Worker ---

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/" && request.method === "POST") {
      const body = await request.json();
      const userPrompt = body.prompt;
      const sessionId = body.sessionId || "default";
      const maxIterations = parseInt(env.MAX_ITERATIONS || "10", 10);

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
            content: "You must output shell commands in a ```bash code block. Please continue.",
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

    if (url.pathname === "/terminal" && request.headers.get("Upgrade") === "websocket") {
      const sessionId = url.searchParams.get("session") || "default";
      const sandboxId = `${env.SANDBOX_ID_PREFIX || "llm-session"}-${sessionId}`;
      const sandbox = getSandbox(env.SANDBOX, sandboxId);

      const terminal = await sandbox.terminal();
      const [client, server] = new WebSocketPair();

      (async () => {
        const reader = terminal.readable.getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          client.send(new TextDecoder().decode(value));
        }
      })();

      server.accept();
      server.addEventListener("message", async (event) => {
        const writer = terminal.writable.getWriter();
        await writer.write(new TextEncoder().encode(event.data));
        writer.releaseLock();
      });

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("Not found", { status: 404 });
  },
};
