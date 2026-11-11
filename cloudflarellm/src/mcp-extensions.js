// ─── MCP Extensions: Google Ads, Google Analytics, DataForSEO, Firecrawl ─────
// Imported by src/index.js — adds these tools to the MCP server so Goose
// gets a single MCP connection with all capabilities.

// ─── Google Ads API helpers ───────────────────────────────────────────────────

async function getGoogleAdsAccessToken(env) {
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.GOOGLE_ADS_CLIENT_ID,
    client_secret: env.GOOGLE_ADS_CLIENT_SECRET,
    refresh_token: env.GOOGLE_ADS_REFRESH_TOKEN,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Google OAuth failed (${res.status}): ${err}`); }
  const data = await res.json();
  return data.access_token;
}

async function googleAdsSearch(env, query) {
  const customerId = (env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
  const accessToken = await getGoogleAdsAccessToken(env);
  const res = await fetch(`https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN },
    body: JSON.stringify({ query }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(`Google Ads API failed (${res.status}): ${err.substring(0, 500)}`); }
  const data = await res.json();
  const results = [];
  for (const batch of data) for (const row of batch.results || []) results.push(row);
  return results;
}

function fmtMicros(micros) { return micros ? `$${(Number(micros) / 1_000_000).toFixed(2)}` : "$0.00"; }
function fmtPct(val) { return val ? `${(Number(val) * 100).toFixed(2)}%` : "0%"; }

async function googleAdsCampaigns(env, args) {
  const dateRange = args.date_range || "LAST_30_DAYS";
  const nameFilter = (args.name_filter || "").toLowerCase();
  const query = `SELECT campaign.id, campaign.name, campaign.status, campaign.bidding_strategy_type, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.cost_per_conversion, metrics.click_through_rate, metrics.average_cpc FROM campaign WHERE segments.date DURING ${dateRange} ORDER BY metrics.cost_micros DESC`;
  const rows = await googleAdsSearch(env, query);
  const filtered = nameFilter ? rows.filter((r) => (r.campaign?.name || "").toLowerCase().includes(nameFilter)) : rows;
  if (!filtered.length) return `No campaigns found${nameFilter ? ` matching "${nameFilter}"` : ""} for ${dateRange}.`;
  const lines = [`Google Ads Campaigns (${dateRange}) — ${filtered.length} campaigns:\n`, "Campaign | Status | Impr | Clicks | CTR | Cost | Conversions | CPA | CPC", "─".repeat(120)];
  for (const r of filtered) {
    const c = r.campaign || {}, m = r.metrics || {};
    lines.push(`${c.name || "—"} | ${c.status || "—"} | ${m.impressions || 0} | ${m.clicks || 0} | ${fmtPct(m.click_through_rate)} | ${fmtMicros(m.cost_micros)} | ${m.conversions || 0} | ${m.conversions > 0 ? fmtMicros(m.cost_per_conversion) : "—"} | ${fmtMicros(m.average_cpc)}`);
  }
  return lines.join("\n");
}

async function googleAdsKeywords(env, args) {
  const dateRange = args.date_range || "LAST_30_DAYS";
  const nameFilter = (args.name_filter || "").toLowerCase();
  const limit = args.limit || 100;
  const query = `SELECT campaign.name, ad_group.name, segments.search_term, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.cost_per_conversion, metrics.click_through_rate FROM search_term_view WHERE segments.date DURING ${dateRange} ORDER BY metrics.cost_micros DESC LIMIT ${limit}`;
  const rows = await googleAdsSearch(env, query);
  const filtered = nameFilter ? rows.filter((r) => (r.campaign?.name || "").toLowerCase().includes(nameFilter)) : rows;
  if (!filtered.length) return `No search terms found${nameFilter ? ` matching "${nameFilter}"` : ""} for ${dateRange}.`;
  const lines = [`Google Ads Search Terms (${dateRange}) — ${filtered.length} terms:\n`, "Search Term | Campaign | Ad Group | Impr | Clicks | Cost | Conv | CPA | CTR", "─".repeat(140)];
  for (const r of filtered) {
    const m = r.metrics || {};
    lines.push(`${r.segments?.search_term || "—"} | ${r.campaign?.name || "—"} | ${r.ad_group?.name || "—"} | ${m.impressions || 0} | ${m.clicks || 0} | ${fmtMicros(m.cost_micros)} | ${m.conversions || 0} | ${m.conversions > 0 ? fmtMicros(m.cost_per_conversion) : "—"} | ${fmtPct(m.click_through_rate)}`);
  }
  return lines.join("\n");
}

async function googleAdsUpdateCpcBid(env, campaignId, cpcBidMicros) {
  const customerId = (env.GOOGLE_ADS_CUSTOMER_ID || "").replace(/-/g, "");
  const accessToken = await getGoogleAdsAccessToken(env);
  const res = await fetch(`https://googleads.googleapis.com/v17/customers/${customerId}/campaigns:mutate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}`, "developer-token": env.GOOGLE_ADS_DEVELOPER_TOKEN },
    body: JSON.stringify({ operations: [{ update: { resourceName: `customers/${customerId}/campaigns/${campaignId}`, manualCpc: { enhancedCpcEnabled: false } }, updateMask: "manual_cpc.enhanced_cpc_enabled" }] }),
  });
  if (!res.ok) { const err = await res.text(); return `Failed (${res.status}): ${err.substring(0, 500)}`; }
  return `CPC bid updated for campaign ${campaignId}. New bid: ${fmtMicros(cpcBidMicros)}.`;
}

// ─── Google Analytics 4 ───────────────────────────────────────────────────────

async function gaMetrics(env, args) {
  const propertyId = env.GA_PROPERTY_ID;
  if (!propertyId) return "GA_PROPERTY_ID not set. Run: wrangler vars put GA_PROPERTY_ID=<id>";
  const accessToken = await getGoogleAdsAccessToken(env);
  const endDate = args.end_date || new Date().toISOString().slice(0, 10);
  const startDate = args.start_date || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const metrics = (args.metrics || "sessions,totalConversions,bounceRate").split(",");
  const res = await fetch(`https://analyticsdata.googleapis.com/v1/properties/${propertyId}:runReport`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ dateRanges: [{ startDate, endDate }], metrics: metrics.map((m) => ({ name: m.trim() })) }),
  });
  if (!res.ok) { const err = await res.text(); return `GA API failed (${res.status}): ${err.substring(0, 500)}`; }
  const data = await res.json();
  const lines = [`Google Analytics 4 (${startDate} to ${endDate}):\n`];
  if (data.rows?.length) {
    lines.push((data.dimensionHeaders || []).concat(data.metricHeaders?.map((h) => h.name) || []).join(" | "));
    lines.push("─".repeat(80));
    for (const row of data.rows) lines.push((row.dimensionValues || []).map((v) => v.value).concat((row.metricValues || []).map((v) => v.value)).join(" | "));
  } else { lines.push("No data returned."); }
  return lines.join("\n");
}

// ─── DataForSEO ───────────────────────────────────────────────────────────────

async function dataforseoRequest(env, endpoint, payload) {
  const login = env.DATAFORSEO_LOGIN, password = env.DATAFORSEO_PASSWORD;
  if (!login || !password) return "DataForSEO credentials not set. Run: wrangler secret put DATAFORSEO_LOGIN && wrangler secret put DATAFORSEO_PASSWORD";
  const res = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${btoa(`${login}:${password}`)}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) { const err = await res.text(); return `DataForSEO API failed (${res.status}): ${err.substring(0, 500)}`; }
  return await res.json();
}

async function dataforseoKeywordResearch(env, args) {
  const keywords = args.keywords.split(",").map((k) => k.trim());
  const result = await dataforseoRequest(env, "keywords_data/keywords_for_keywords/live", { keywords, location_code: parseInt(args.location || "2840", 10), language_code: "en" });
  if (typeof result === "string") return result;
  const lines = [`DataForSEO Keyword Research (${keywords.join(", ")}):\n`, "Keyword | Volume | CPC | Competition", "─".repeat(100)];
  for (const task of result.tasks || []) for (const item of (task.result?.[0]?.items || []).slice(0, 50)) lines.push(`${item.keyword || "—"} | ${item.search_volume || "—"} | $${(item.cpc || 0).toFixed(2)} | ${item.competition || "—"}`);
  return lines.join("\n") || "No keyword data returned.";
}

async function dataforseoCompetitors(env, args) {
  const result = await dataforseoRequest(env, "serp/google/organic/live/advanced", { keyword: args.keyword, location_code: parseInt(args.location || "2840", 10), language_code: "en", device: "desktop", depth: 20 });
  if (typeof result === "string") return result;
  const lines = [`DataForSEO SERP Competitors for "${args.keyword}":\n`, "Rank | Domain | Title", "─".repeat(120)];
  for (const task of result.tasks || []) for (const item of (task.result?.[0]?.items || []).filter((i) => i.type === "organic")) lines.push(`${item.rank_group || "—"} | ${item.domain || "—"} | ${(item.title || "").slice(0, 60)}`);
  return lines.join("\n") || "No SERP data returned.";
}

// ─── Firecrawl ────────────────────────────────────────────────────────────────

async function firecrawlScrape(env, args) {
  const apiKey = env.FIRECRAWL_API_KEY;
  if (!apiKey) return "FIRECRAWL_API_KEY not set. Run: wrangler secret put FIRECRAWL_API_KEY";
  const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ url: args.url, formats: ["markdown"], onlyMainContent: true }),
  });
  if (!res.ok) { const err = await res.text(); return `Firecrawl scrape failed (${res.status}): ${err.substring(0, 500)}`; }
  const data = await res.json();
  return data.data?.markdown || data.data?.content || JSON.stringify(data).substring(0, 2000);
}

async function firecrawlSearch(env, args) {
  const apiKey = env.FIRECRAWL_API_KEY;
  if (!apiKey) return "FIRECRAWL_API_KEY not set. Run: wrangler secret put FIRECRAWL_API_KEY";
  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query: args.query, limit: args.limit || 10, scrapeOptions: { formats: ["markdown"] } }),
  });
  if (!res.ok) { const err = await res.text(); return `Firecrawl search failed (${res.status}): ${err.substring(0, 500)}`; }
  const data = await res.json();
  const lines = [`Firecrawl Search: "${args.query}"\n`];
  for (const r of (data.data || []).slice(0, args.limit || 10)) lines.push(`\n## ${r.metadata?.title || r.url}\nURL: ${r.url}\n${(r.markdown || "").substring(0, 500)}...`);
  return lines.join("\n") || "No results.";
}

// ─── Tool definitions + dispatcher ────────────────────────────────────────────

const EXTENSION_TOOLS = [
  { name: "google_ads_campaigns", description: "List Google Ads campaigns with performance metrics. Filter by name.", inputSchema: { type: "object", properties: { date_range: { type: "string", description: "LAST_30_DAYS, LAST_7_DAYS, LAST_90_DAYS (default: LAST_30_DAYS)" }, name_filter: { type: "string", description: "Case-insensitive campaign name filter (e.g. 'handyman')" } } } },
  { name: "google_ads_keywords", description: "Get search term performance — clicks, conversions, CPA per keyword.", inputSchema: { type: "object", properties: { date_range: { type: "string" }, name_filter: { type: "string" }, limit: { type: "number" } } } },
  { name: "google_ads_search", description: "Run a custom GAQL query against Google Ads.", inputSchema: { type: "object", properties: { query: { type: "string", description: "GAQL query" } }, required: ["query"] } },
  { name: "google_ads_update_cpc_bid", description: "Update CPC bid for a campaign.", inputSchema: { type: "object", properties: { campaign_id: { type: "string" }, cpc_bid_micros: { type: "number", description: "Bid in micros (500000 = $0.50)" } }, required: ["campaign_id", "cpc_bid_micros"] } },
  { name: "ga_metrics", description: "Get Google Analytics 4 metrics. Requires GA_PROPERTY_ID.", inputSchema: { type: "object", properties: { start_date: { type: "string" }, end_date: { type: "string" }, metrics: { type: "string", description: "Comma-separated GA4 metrics" } } } },
  { name: "dataforseo_keyword_research", description: "Search keyword volumes, CPC, competition via DataForSEO.", inputSchema: { type: "object", properties: { keywords: { type: "string", description: "Comma-separated keywords" }, location: { type: "string" } }, required: ["keywords"] } },
  { name: "dataforseo_competitors", description: "Find SERP competitors for a keyword via DataForSEO.", inputSchema: { type: "object", properties: { keyword: { type: "string" }, location: { type: "string" } }, required: ["keyword"] } },
  { name: "firecrawl_scrape", description: "Scrape a URL and return markdown content.", inputSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] } },
  { name: "firecrawl_search", description: "Web search via Firecrawl — returns results with content.", inputSchema: { type: "object", properties: { query: { type: "string" }, limit: { type: "number" } }, required: ["query"] } },
];

async function callExtensionTool(name, args, env) {
  switch (name) {
    case "google_ads_campaigns": return await googleAdsCampaigns(env, args);
    case "google_ads_keywords": return await googleAdsKeywords(env, args);
    case "google_ads_search": return await googleAdsSearch(env, args.query);
    case "google_ads_update_cpc_bid": return await googleAdsUpdateCpcBid(env, args.campaign_id, args.cpc_bid_micros);
    case "ga_metrics": return await gaMetrics(env, args);
    case "dataforseo_keyword_research": return await dataforseoKeywordResearch(env, args);
    case "dataforseo_competitors": return await dataforseoCompetitors(env, args);
    case "firecrawl_scrape": return await firecrawlScrape(env, args);
    case "firecrawl_search": return await firecrawlSearch(env, args);
    default: return null; // not an extension tool
  }
}

export { EXTENSION_TOOLS, callExtensionTool };
