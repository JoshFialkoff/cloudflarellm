/**
 * Stdio Transport for local development and direct invocation.
 * No network exposure; stdin/stdout only.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

export async function startStdioServer(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[assistedly-secure-mcp] Stdio transport active");
}
