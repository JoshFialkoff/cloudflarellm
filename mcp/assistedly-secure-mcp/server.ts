/**
 * Assistedly Secure MCP Server
 * Main entry point with dual transport support.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { loadVerificationKey } from "./policy-gateway/auth.js";
import { authenticate, requireRole } from "./policy-gateway/auth.js";
import { checkRateLimit, acquireConcurrent, releaseConcurrent } from "./policy-gateway/rate-limiter.js";
import { logAudit } from "./policy-gateway/audit-logger.js";
import { startStdioServer } from "./transports/stdio.js";
import { startHttpServer } from "./transports/http.js";
import {
  FindMatchingOptionsSchema,
  GetOptionSummarySchema,
  CreateFollowUpDraftSchema,
  GetBusinessContextSchema,
} from "./tools/schemas.js";
import {
  handleFindMatchingOptions,
  handleGetOptionSummary,
  handleCreateFollowUpDraft,
  handleGetBusinessContext,
} from "./tools/handlers.js";

async function main() {
  const args = process.argv.slice(2);
  const transportArg = args.find((a) => a.startsWith("--transport="))?.split("=")[1] || "stdio";
  const port = parseInt(args.find((a) => a.startsWith("--port="))?.split("=")[1] || "8082", 10);

  await loadVerificationKey();

  const server = new Server(
    { name: "assistedly-secure-mcp", version: "1.0.0" },
    { capabilities: { tools: {}, prompts: {} } }
  );

  // ── Prompts ──
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      { name: "business_plan_summary", description: "Generate business plan summary per Now/Next/Later framing." },
      { name: "investor_pitch", description: "60-second pitch with exact metrics and moats." },
    ],
  }));

  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    if (req.params.name === "business_plan_summary") {
      return {
        messages: [{
          role: "user",
          content: { type: "text", text: `Write Assistedly's business plan using the exact framing: "Assistedly is a vertical care-intelligence platform. It combines recurring software revenue with proprietary data licensing and API revenue." Order: NOW (MA SaaS), NEXT (Data licensing/APIs), LATER (Evidence layer for AI agents).` },
        }],
      };
    }
    if (req.params.name === "investor_pitch") {
      return {
        messages: [{
          role: "user",
          content: { type: "text", text: `Generate a 60-second investor pitch. Problem: families can't find verified senior-living data. Solution: intelligence layer above directories and CRMs. Traction: 273 MA facilities, 99.6% geocoded, weekly updates, 1 pilot partner. Model: SaaS + data/API licensing. Moats: FOIA pipelines, cross-directory aggregation, first-party intent data, independent brand, Chrome Extension. Vision: evidence layer AI agents query.` },
        }],
      };
    }
    throw new Error(`Unknown prompt: ${req.params.name}`);
  });

  // ── Tools List ──
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "find_matching_options",
        description: "Find care facility matches for a consented case using narrow criteria. Max 25 results.",
        inputSchema: {
          type: "object",
          properties: {
            consentedCaseId: { type: "string", pattern: "^[a-zA-Z0-9_-]+$", maxLength: 64 },
            criteria: {
              type: "object",
              properties: {
                careNeeds: { type: "string", enum: ["assisted", "memory", "skilled", "independent"] },
                budget: { type: "string", enum: ["under_4000", "4000_6000", "6000_8000", "8000_10000", "over_10000"] },
                location: { type: "string", enum: ["boston", "worcester", "springfield", "anywhere"] },
                timing: { type: "string", enum: ["immediate", "soon", "planning", "exploring"] },
                priorities: { type: "array", items: { type: "string" }, maxItems: 5 },
              },
              additionalProperties: false,
            },
            maxResults: { type: "number", minimum: 1, maximum: 25, default: 10 },
          },
          required: ["consentedCaseId", "criteria"],
          additionalProperties: false,
        },
      },
      {
        name: "get_option_summary",
        description: "Get a minimal summary for a single facility option ID.",
        inputSchema: {
          type: "object",
          properties: {
            optionId: { type: "number", minimum: 1 },
          },
          required: ["optionId"],
          additionalProperties: false,
        },
      },
      {
        name: "create_follow_up_draft",
        description: "Generate a follow-up draft email/note for consented case and selected option IDs. Requires professional/admin role.",
        inputSchema: {
          type: "object",
          properties: {
            consentedCaseId: { type: "string", pattern: "^[a-zA-Z0-9_-]+$", maxLength: 64 },
            optionIds: { type: "array", items: { type: "number", minimum: 1 }, minItems: 1, maxItems: 10 },
            followUpType: { type: "string", enum: ["email_family", "email_facility", "internal_note"], default: "email_family" },
          },
          required: ["consentedCaseId", "optionIds"],
          additionalProperties: false,
        },
      },
      {
        name: "get_business_context",
        description: "Retrieve Assistedly business model context (NOW/NEXT/LATER/ALL).",
        inputSchema: {
          type: "object",
          properties: {
            phase: { type: "string", enum: ["NOW", "NEXT", "LATER", "ALL"], default: "ALL" },
          },
          additionalProperties: false,
        },
      },
    ],
  }));

  // ── Tool Dispatch ──
  server.setRequestHandler(CallToolRequestSchema, async (request, _extra?) => {
    const start = performance.now();
    // Extract token from meta or args (HTTP transport puts it in headers; stdio may lack it in dev)
    const meta = (request as any).meta || {};
    const token = meta.token || process.env.MCP_DEV_TOKEN || "";
    const authResult = await authenticate(token || undefined);

    if (authResult.decision !== "allow") {
      logAudit(
        { identity: { sub: "anonymous", tenant: "anonymous", roles: [], aud: "", exp: 0, iat: 0, jti: "" }, toolName: request.params.name, requestId: crypto.randomUUID(), timestamp: new Date() },
        "deny", 0, 0, { signals: ["auth_failed"], severity: "medium", action: "block" }, Math.round(performance.now() - start)
      );
      return { content: [{ type: "text", text: JSON.stringify({ error: "unauthorized", reason: (authResult as any).reason }) }] };
    }

    const identity = authResult.context.identity;
    const toolName = request.params.name;
    const args = request.params.arguments || {};

    // Rate limit
    const rateCheck = checkRateLimit(identity, toolName);
    if (rateCheck.decision !== "allow") {
      const reason = rateCheck.decision === "throttle" ? `throttle: retry after ${(rateCheck as any).retryAfter}s` : (rateCheck as any).reason;
      logAudit({ ...authResult.context, toolName }, rateCheck.decision, 0, 0, { signals: [reason], severity: "low", action: (rateCheck.decision === "deny" ? "block" : rateCheck.decision) as any }, Math.round(performance.now() - start));
      return { content: [{ type: "text", text: JSON.stringify({ error: rateCheck.decision, reason }) }] };
    }

    acquireConcurrent(identity);

    try {
      const ctx = { ...authResult.context, toolName, purpose: String(args.purpose || toolName) };

      switch (toolName) {
        case "find_matching_options": {
          const parsed = FindMatchingOptionsSchema.safeParse(args);
          if (!parsed.success) {
            logAudit(ctx, "deny", 0, 0, { signals: ["schema_validation_failed"], severity: "low", action: "allow" }, Math.round(performance.now() - start));
            return { content: [{ type: "text", text: JSON.stringify({ error: "invalid_input", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }) }] };
          }
          return await handleFindMatchingOptions(parsed.data, ctx);
        }

        case "get_option_summary": {
          const parsed = GetOptionSummarySchema.safeParse(args);
          if (!parsed.success) {
            logAudit(ctx, "deny", 0, 0, { signals: ["schema_validation_failed"], severity: "low", action: "allow" }, Math.round(performance.now() - start));
            return { content: [{ type: "text", text: JSON.stringify({ error: "invalid_input", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }) }] };
          }
          return await handleGetOptionSummary(parsed.data, ctx);
        }

        case "create_follow_up_draft": {
          // Role gate
          if (!requireRole(identity, "professional")) {
            logAudit(ctx, "deny", 0, 0, { signals: ["role_insufficient"], severity: "medium", action: "block" }, Math.round(performance.now() - start));
            return { content: [{ type: "text", text: JSON.stringify({ error: "forbidden", detail: "Requires professional or admin role" }) }] };
          }
          const parsed = CreateFollowUpDraftSchema.safeParse(args);
          if (!parsed.success) {
            logAudit(ctx, "deny", 0, 0, { signals: ["schema_validation_failed"], severity: "low", action: "allow" }, Math.round(performance.now() - start));
            return { content: [{ type: "text", text: JSON.stringify({ error: "invalid_input", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }) }] };
          }
          return await handleCreateFollowUpDraft(parsed.data, ctx);
        }

        case "get_business_context": {
          const parsed = GetBusinessContextSchema.safeParse(args);
          if (!parsed.success) {
            logAudit(ctx, "deny", 0, 0, { signals: ["schema_validation_failed"], severity: "low", action: "allow" }, Math.round(performance.now() - start));
            return { content: [{ type: "text", text: JSON.stringify({ error: "invalid_input", details: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }) }] };
          }
          return await handleGetBusinessContext(parsed.data, ctx);
        }

        default:
          logAudit(ctx, "deny", 0, 0, { signals: ["unknown_tool"], severity: "low", action: "allow" }, Math.round(performance.now() - start));
          return { content: [{ type: "text", text: JSON.stringify({ error: "unknown_tool", name: toolName }) }] };
      }
    } finally {
      releaseConcurrent(identity);
    }
  });

  if (transportArg === "stdio") {
    await startStdioServer(server);
  } else {
    await startHttpServer(server, port);
  }
}

main().catch((err) => {
  console.error("[assistedly-secure-mcp] Fatal error:", err);
  process.exit(1);
});
