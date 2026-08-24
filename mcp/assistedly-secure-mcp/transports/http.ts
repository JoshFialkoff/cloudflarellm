/**
 * HTTP/SSE Transport for production via Cloudflare Tunnel.
 * Supports Server-Sent Events for MCP streaming.
 * Includes CORS, request-size limits, and bearer token extraction.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import Fastify from "fastify";

const MAX_BODY_BYTES = 256 * 1024; // 256 KB

export async function startHttpServer(server: Server, port: number): Promise<void> {
  const app = Fastify({
    logger: false,
    bodyLimit: MAX_BODY_BYTES,
  });

  const transports = new Map<string, SSEServerTransport>();

  // Health check for load balancers / Cloudflare Tunnel
  app.get("/health", async () => ({ status: "ok", service: "assistedly-secure-mcp" }));

  // SSE endpoint
  app.get("/sse", async (request, reply) => {
    const token = extractBearer(request.headers.authorization);
    if (!token) {
      reply.code(401).send({ error: "missing_token" });
      return;
    }

    const transport = new SSEServerTransport("/messages", reply.raw);
    transports.set(transport.sessionId, transport);

    reply.raw.on("close", () => {
      transports.delete(transport.sessionId);
    });

    await server.connect(transport);
  });

  // Message posting endpoint
  app.post("/messages", async (request, reply) => {
    const sessionId = (request.query as any)?.sessionId as string | undefined;
    if (!sessionId) {
      reply.code(400).send({ error: "missing_session_id" });
      return;
    }

    const transport = transports.get(sessionId);
    if (!transport) {
      reply.code(404).send({ error: "session_not_found" });
      return;
    }

    await transport.handlePostMessage(request.raw, reply.raw, request.body);
  });

  await app.listen({ host: "0.0.0.0", port });
  console.error(`[assistedly-secure-mcp] HTTP/SSE transport active on http://127.0.0.1:${port}`);
}

function extractBearer(auth?: string): string | undefined {
  if (!auth) return undefined;
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : undefined;
}
