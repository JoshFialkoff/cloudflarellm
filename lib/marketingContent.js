
const DOC_URL =
  "https://docs.google.com/document/d/1m6By90jce3E6a3CsJI9KVEBsMu-TCOo9nrmpXtJ2Vqk/export?format=txt";

let contentCache = null;
let lastFetch = 0;

async function fetchMarketingContent() {
  if (contentCache && Date.now() - lastFetch < 1000 * 60 * 5) {
    // Cache for 5 minutes
    return contentCache;
  }

  try {
    const response = await fetch(DOC_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch marketing content: ${response.statusText}`);
    }
    const text = await response.text();
    contentCache = parseMarketingContent(text);
    lastFetch = Date.now();
    return contentCache;
  } catch (error) {
    console.error("Error fetching marketing content:", error);
    if (contentCache) {
      return contentCache; // Serve stale content if available
    }
    throw error;
  }
}

function parseMarketingContent(text) {
  const campaigns = {};
  const sections = text.split(/---\s*/);

  for (const section of sections) {
    const lines = section.split("\n");
    const titleLine = lines.shift();
    const titleMatch = titleLine.match(/## (.*)/);
    if (!titleMatch) continue;

    const campaignName = titleMatch[1].trim();
    const subjectLine = lines.find((line) => line.startsWith("**Subject:**"));
    const subject = subjectLine ? subjectLine.replace("**Subject:**", "").trim() : "";
    const body = lines
      .filter((line) => !line.startsWith("**Subject:**"))
      .join("\n")
      .trim();

    campaigns[campaignName] = { subject, body };
  }

  return campaigns;
}

async function getCampaign(campaignName) {
  const campaigns = await fetchMarketingContent();
  return campaigns[campaignName] || { subject: "", body: "" };
}

module.exports = {
  getCampaign,
};