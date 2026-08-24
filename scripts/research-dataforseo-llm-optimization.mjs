#!/usr/bin/env node
/**
 * Research: DataForSEO LLM Optimization for assistedly.ai
 * Queries DataForSEO APIs to understand:
 * 1. Current LLM mentions of assistedly.ai
 * 2. Keywords/topics where assisted living in MA is discussed
 * 3. SERP features and AI Overviews for target queries
 * 4. Optimization recommendations for GPT/ChatGPT presence
 */

import { writeFileSync } from "fs";

const LOGIN = process.env.DATAFORSEO_LOGIN;
const PASSWORD = process.env.DATAFORSEO_API_PASSWORD;
const AUTH = "Basic " + Buffer.from(`${LOGIN}:${PASSWORD}`).toString("base64");

async function dfsPost(path, body) {
  const res = await fetch(`https://api.dataforseo.com/v3${path}`, {
    method: "POST",
    headers: { Authorization: AUTH, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, status: res.status, error: t.slice(0, 500) };
  }
  return { ok: true, data: await res.json() };
}

async function main() {
  const results = { generatedAt: new Date().toISOString() };

  // 1. LLM Mentions of assistedly.ai
  console.log("[1/4] Querying LLM mentions...");
  const llmMentions = await dfsPost("/ai_optimization/llm_mentions/organic/live", [
    { target: "assistedly.ai", language_code: "en", location_code: 2840 },
  ]);
  results.llmMentions = llmMentions;

  // 2. LLM Responses for assisted living queries
  console.log("[2/4] Querying LLM responses for 'assisted living Massachusetts'...");
  const llmResponses = await dfsPost("/ai_optimization/llm_responses/organic/live", [
    { keyword: "assisted living Massachusetts", language_code: "en", location_code: 2840, depth: 10 },
  ]);
  results.llmResponses = llmResponses;

  // 3. SERP analysis for top assisted living queries in MA
  console.log("[3/4] Querying SERP for 'assisted living Massachusetts'...");
  const serp = await dfsPost("/serp/google/organic/live/regular", [
    { keyword: "assisted living Massachusetts", language_code: "en", location_code: 2840, depth: 20 },
  ]);
  results.serp = serp;

  // 4. Ranked keywords for assistedly.ai domain
  console.log("[4/4] Querying ranked keywords for assistedly.ai...");
  const ranked = await dfsPost("/dataforseo_labs/google/ranked_keywords/live", [
    { target: "assistedly.ai", language_code: "en", location_code: 2840, limit: 50 },
  ]);
  results.rankedKeywords = ranked;

  writeFileSync("/tmp/dataforseo-llm-research.json", JSON.stringify(results, null, 2));
  console.log("\nResults written to /tmp/dataforseo-llm-research.json");
  console.log(JSON.stringify(results, null, 2));
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
