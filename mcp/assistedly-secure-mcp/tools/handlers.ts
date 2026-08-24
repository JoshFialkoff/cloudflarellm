/**
 * Tool Handlers
 * Each handler enforces narrow decisions, applies output filtering,
 * and returns only minimum fields needed.
 */

import type { ToolContext } from "../types/index.js";
import {
  findById,
  findMatching,
} from "../data-store/facilities.js";
import {
  limitResults,
  toFacilitySummary,
  estimateBytes,
} from "../policy-gateway/output-filter.js";
import { recordRequest, checkRecordQuota } from "../policy-gateway/rate-limiter.js";
import { detectAnomalies } from "../policy-gateway/anomaly-detector.js";
import { logAudit, logSecurityIncident } from "../policy-gateway/audit-logger.js";
import type {
  FindMatchingOptionsInput,
  GetOptionSummaryInput,
  CreateFollowUpDraftInput,
  GetBusinessContextInput,
} from "./schemas.js";

export async function handleFindMatchingOptions(
  input: FindMatchingOptionsInput,
  ctx: ToolContext
): Promise<any> {
  const start = performance.now();
  const results = findMatching(input.criteria, input.maxResults);
  const limited = limitResults(results);
  const recordIds = limited.map((r) => String(r.optionId));
  const output = { caseId: input.consentedCaseId, count: limited.length, matches: limited };
  const bytes = estimateBytes(output);

  // Anomaly check
  const anomaly = detectAnomalies(ctx.identity, "find_matching_options", input, limited.length, recordIds);
  if (anomaly.action === "block") {
    logSecurityIncident(ctx, anomaly, "block");
    return { content: [{ type: "text", text: JSON.stringify({ error: "request_blocked", reason: anomaly.signals }) }] };
  }

  // Quota check
  const quotaCheck = checkRecordQuota(ctx.identity, "find_matching_options", recordIds, bytes);
  if (quotaCheck.decision !== "allow") {
    logAudit(ctx, quotaCheck.decision, 0, 0, anomaly, Math.round(performance.now() - start));
    return { content: [{ type: "text", text: JSON.stringify({ error: quotaCheck.decision, reason: (quotaCheck as any).reason || "quota_exceeded" }) }] };
  }

  recordRequest(ctx.identity, "find_matching_options", recordIds, bytes);
  logAudit(ctx, "allow", limited.length, bytes, anomaly, Math.round(performance.now() - start));

  return { content: [{ type: "text", text: JSON.stringify(output) }] };
}

export async function handleGetOptionSummary(
  input: GetOptionSummaryInput,
  ctx: ToolContext
): Promise<any> {
  const start = performance.now();
  const facility = findById(input.optionId);
  if (!facility) {
    logAudit(ctx, "allow", 0, 0, { signals: [], severity: "none", action: "allow" }, Math.round(performance.now() - start));
    return { content: [{ type: "text", text: JSON.stringify({ error: "not_found", optionId: input.optionId }) }] };
  }

  const summary = toFacilitySummary(facility, ctx.identity.tenant);
  const recordIds = [String(facility.id)];
  const bytes = estimateBytes(summary);

  const anomaly = detectAnomalies(ctx.identity, "get_option_summary", input, 1, recordIds);
  if (anomaly.action === "block") {
    logSecurityIncident(ctx, anomaly, "block");
    return { content: [{ type: "text", text: JSON.stringify({ error: "request_blocked", reason: anomaly.signals }) }] };
  }

  const quotaCheck = checkRecordQuota(ctx.identity, "get_option_summary", recordIds, bytes);
  if (quotaCheck.decision !== "allow") {
    logAudit(ctx, quotaCheck.decision, 0, 0, anomaly, Math.round(performance.now() - start));
    return { content: [{ type: "text", text: JSON.stringify({ error: quotaCheck.decision, reason: (quotaCheck as any).reason || "quota_exceeded" }) }] };
  }

  recordRequest(ctx.identity, "get_option_summary", recordIds, bytes);
  logAudit(ctx, "allow", 1, bytes, anomaly, Math.round(performance.now() - start));

  return { content: [{ type: "text", text: JSON.stringify(summary) }] };
}

export async function handleCreateFollowUpDraft(
  input: CreateFollowUpDraftInput,
  ctx: ToolContext
): Promise<any> {
  const start = performance.now();

  // This tool is write-like; always require explicit approval logic
  // For MVP, we require admin role or professional role
  if (!ctx.identity.roles.includes("admin") && !ctx.identity.roles.includes("professional")) {
    logAudit(ctx, "deny", 0, 0, { signals: ["insufficient_privilege"], severity: "medium", action: "block" }, Math.round(performance.now() - start));
    return { content: [{ type: "text", text: JSON.stringify({ error: "insufficient_privilege", detail: "create_follow_up_draft requires professional or admin role" }) }] };
  }

  const facilities = input.optionIds.map((id) => findById(id)).filter((f): f is NonNullable<typeof f> => f !== null);
  const recordIds = facilities.map((f) => String(f.id));

  const draft = {
    caseId: input.consentedCaseId,
    followUpType: input.followUpType,
    draftSubject: generateSubject(input.followUpType, facilities),
    draftBody: generateBody(input.followUpType, facilities),
    optionsReferenced: facilities.map((f) => ({ id: f.id, name: f.name, city: f.city })),
  };

  const bytes = estimateBytes(draft);
  const anomaly = detectAnomalies(ctx.identity, "create_follow_up_draft", input, facilities.length, recordIds);
  if (anomaly.action === "block") {
    logSecurityIncident(ctx, anomaly, "block");
    return { content: [{ type: "text", text: JSON.stringify({ error: "request_blocked", reason: anomaly.signals }) }] };
  }

  recordRequest(ctx.identity, "create_follow_up_draft", recordIds, bytes);
  logAudit(ctx, "allow", facilities.length, bytes, anomaly, Math.round(performance.now() - start));
  return { content: [{ type: "text", text: JSON.stringify(draft) }] };
}

export async function handleGetBusinessContext(
  input: GetBusinessContextInput,
  ctx: ToolContext
): Promise<any> {
  const start = performance.now();
  const model = {
    elevatorPitch: "Assistedly is a vertical care-intelligence platform. It combines recurring software revenue with proprietary data licensing and API revenue.",
    phases: [
      {
        phase: "NOW",
        label: "Massachusetts care-intelligence SaaS",
        revenueModel: "Recurring software subscriptions + pilot workflows",
        buyers: ["Assisted Living Facilities", "Hospitals", "Care Professionals"],
        actionsCustomersPayFor: [
          "Keeping bed availability current in real time",
          "Reducing family placement time via verified intake matching",
          "Review-reliability signals and reputation forensics",
          "Competitive benchmarking vs. local comp-set",
          "FOIA compliance alerts (license expiration, inspection updates)",
        ],
        pricingTiers: [
          { tier: "Consumer", price: "Free", features: ["Search + compare", "Intake wizard", "Cost calculator"] },
          { tier: "Community Intelligence", price: "$99/mo per community", features: ["Review aggregation", "Comp-set builder", "Basic alerts"] },
          { tier: "Professional Intelligence", price: "$299/mo per community", features: ["Reputation forensics", "Consumer search intel", "Priority support"] },
          { tier: "Portfolio / Enterprise", price: "$1,500+/mo", features: ["White-label reports", "API access", "Custom reporting", "Agency reseller rights"] },
        ],
      },
      {
        phase: "NEXT",
        label: "Data licensing and APIs",
        revenueModel: "Data licensing fees + API usage charges",
        buyers: ["Hospitals", "Senior-care organizations", "Governments", "Nonprofits", "AI products / LLM builders"],
        dataProducts: [
          { name: "Facility Intelligence API", description: "Structured, source-linked facility intelligence with safety scores, occupancy, pricing.", differentiation: "Source-linked to FOIA public records." },
          { name: "Comp-Set Benchmarking Dataset", description: "Anonymized competitive positioning data.", differentiation: "Built from FOIA + cross-directory scrapes." },
          { name: "Consumer Intent Signals", description: "Anonymized, aggregated search patterns and intake wizard outcomes.", differentiation: "Own-site first-party data." },
          { name: "Regulatory Compliance Feed", description: "Real-time FOIA-derived alerts.", differentiation: "No other senior-living SaaS has FOIA pipelines per state." },
        ],
      },
      {
        phase: "LATER",
        label: "Assistedly as evidence layer for AI agents",
        revenueModel: "Usage-based or enterprise licensing for AI agent queries",
        buyers: ["AI agent platforms", "Healthcare LLMs", "Insurance underwriters", "Government auditors"],
        vision: "AI agents query Assistedly as an authoritative evidence layer for senior-living decisions. Not just a database; an action-enabling intelligence layer.",
      },
    ],
    moats: [
      "FOIA pipeline infrastructure (months to replicate per state)",
      "Cross-platform review aggregation at scale",
      "Consumer intent signal data (own-site first-party)",
      "Independent brand positioning (no commission conflict)",
      "Chrome Extension installed base (switching costs)",
    ],
  };

  const output = input.phase === "ALL" ? model : model.phases.find((p) => p.phase === input.phase) || { error: "phase_not_found" };
  const bytes = estimateBytes(output);
  const anomaly = detectAnomalies(ctx.identity, "get_business_context", input, 0, []);
  recordRequest(ctx.identity, "get_business_context", [], bytes);
  logAudit(ctx, "allow", 0, bytes, anomaly, Math.round(performance.now() - start));

  return { content: [{ type: "text", text: JSON.stringify(output) }] };
}

function generateSubject(type: string, facilities: Array<{ name: string; city: string }>): string {
  const names = facilities.map((f) => f.name).join(", ");
  switch (type) {
    case "email_family": return `Follow-up: ${facilities.length} care options in ${facilities[0]?.city || "MA"}`;
    case "email_facility": return `Intro: Family seeking placement — ${names}`;
    case "internal_note": return `Case note: follow-up on ${names}`;
    default: return `Follow-up draft`;
  }
}

function generateBody(type: string, facilities: Array<{ name: string; city: string; feeLow?: number; feeHigh?: number }>): string {
  const list = facilities.map((f) => `- ${f.name} (${f.city})${f.feeLow ? ` ~ $${f.feeLow}/mo` : ""}`).join("\n");
  switch (type) {
    case "email_family": return `Hi,\n\nHere are the communities we discussed:\n${list}\n\nPlease let me know if you'd like to schedule visits.\n\nBest,\nAssistedly Care Navigator`;
    case "email_facility": return `Hello,\n\nWe have a prospective resident interested in your community. Current criteria align with your profile.\n\nReferred communities:\n${list}\n\nPlease confirm availability and next steps.\n\nAssistedly Professional Network`;
    case "internal_note": return `Follow-up draft generated. Communities referenced:\n${list}`;
    default: return `Draft generated for ${facilities.length} options.`;
  }
}
