#!/usr/bin/env node
/**
 * Debug script: scrape a single review page via Firecrawl and dump
 * rawHtml + markdown so we can see what structure review text has.
 */
const https = require("https");

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;
if (!FIRECRAWL_API_KEY) {
  console.error("Missing FIRECRAWL_API_KEY");
  process.exit(1);
}

const url = process.argv[2] || "https://www.caring.com/senior-living/massachusetts/winchester/winchester-mount-vernon-house-01890";

function postJSON(path, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = https.request(
      {
        hostname: "api.firecrawl.dev",
        path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        },
      },
      (res) => {
        let d = "";
        res.on("data", (c) => (d += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(d));
          } catch {
            resolve({ raw: d, status: res.statusCode });
          }
        });
      }
    );
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log(`Scraping: ${url}\n`);
  const res = await postJSON("/v1/scrape", {
    url,
    formats: ["rawHtml", "markdown", "links"],
    onlyMainContent: false,
    waitFor: 5000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!res.success) {
    console.error("Scrape failed:", res.message || res.error);
    process.exit(1);
  }

  const data = res.data;
  console.log("=== METADATA ===");
  console.log("Title:", data.metadata?.title || "N/A");
  console.log("Description:", data.metadata?.description?.slice(0, 300) || "N/A");
  console.log("\n=== RAW HTML LENGTH ===", (data.rawHtml || "").length);
  console.log("=== MARKDOWN LENGTH ===", (data.markdown || "").length);

  console.log("\n=== MARKDOWN (first 4000 chars) ===");
  console.log((data.markdown || "").slice(0, 4000));

  console.log("\n=== RAW HTML (first 4000 chars) ===");
  console.log((data.rawHtml || "").slice(0, 4000));

  // Look for review text patterns in markdown
  const md = data.markdown || "";
  const reviewLike = md.match(/review.{0,200}/gi) || [];
  console.log(`\n=== Review-like snippets in markdown (${reviewLike.length}) ===`);
  reviewLike.slice(0, 20).forEach((s, i) => console.log(`  [${i}] ${s.slice(0, 200)}`));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
