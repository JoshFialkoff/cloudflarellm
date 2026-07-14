import fs from "fs";
import path from "path";

// ── Color palette: one per competitor ──
const PALETTE = [
  "#4a7c7e", "#6d1247", "#c4956a", "#2563eb", "#7c3aed",
  "#db2777", "#ea580c", "#0891b2", "#65a30d", "#ca8a04", "#dc2626",
];

// ── Compute radar data ──
function computeRadarData(competitors, features) {
  const categories = [
    "AI / Smart Matching",
    "Cost Transparency",
    "Family Communication",
    "Mobile Experience",
    "Care Coordination",
    "Marketplace / Search",
    "Lead / CRM Tools",
    "Funding Strength",
  ];

  // Assistedly: honest self-assessment (no funding = 0)
  const assistedlyScores = {
    "AI / Smart Matching": 78,
    "Cost Transparency": 70,
    "Family Communication": 45,
    "Mobile Experience": 55,
    "Care Coordination": 60,
    "Marketplace / Search": 85,
    "Lead / CRM Tools": 50,
    "Funding Strength": 0,  // Bootstrapped, no institutional funding
  };

  const keywordMap = {
    "AI / Smart Matching": ["ai", "matching", "smart", "predictive", "scoring", "intelligence"],
    "Cost Transparency": ["cost", "price", "pricing", "transparency", "calculator", "funding"],
    "Family Communication": ["family", "communication", "messaging", "portal", "app", "updates", "social"],
    "Mobile Experience": ["mobile", "app", "native", "ios", "android", "text", "sms", "whatsapp"],
    "Care Coordination": ["care plan", "coordination", "roster", "schedule", "clinical", "emar", "medication"],
    "Marketplace / Search": ["marketplace", "search", "directory", "listing", "compare", "shortlist", "concierge"],
    "Lead / CRM Tools": ["crm", "lead", "pipeline", "sales", "referral", "workflow", "automation", "campaign"],
    "Funding Strength": [], // handled separately
  };

  const compNames = competitors.map((c) => c.name);

  const radarData = categories.map((category) => {
    const entry = { category, Assistedly: assistedlyScores[category] || 50 };
    compNames.forEach((name) => {
      const comp = competitors.find((c) => c.name === name);
      const notes = ((comp?.notes || "") + " " + (comp?.category || "")).toLowerCase();
      const keywords = keywordMap[category] || [];
      let score = 40;
      keywords.forEach((kw) => {
        if (notes.includes(kw)) score += 12;
      });
      // Funding strength from notes
      if (category === "Funding Strength") {
        const fNotes = (comp?.funding || "").toLowerCase();
        if (fNotes.includes("billion") || fNotes.includes("$1b")) score = 95;
        else if (fNotes.includes("$150m") || fNotes.includes("$325m")) score = 85;
        else if (fNotes.includes("$62") || fNotes.includes("$44") || fNotes.includes("$31")) score = 65;
        else if (fNotes.includes("$4.5") || fNotes.includes("$3.5") || fNotes.includes("venture")) score = 40;
        else if (fNotes.includes("bootstrapped")) score = 10;
        else score = 15;
      }
      entry[name] = Math.min(100, score);
    });
    return entry;
  });

  return radarData;
}

// ── Compute landscape data ──
function computeLandscapeData(competitors) {
  const entries = [
    {
      name: "Assistedly",
      easeOfUse: 85,
      featureDepth: 62,
      size: 100,
      notes: "AI-first concierge for families seeking senior care",
    },
  ];

  competitors.forEach((comp) => {
    const notes = (comp.notes || "").toLowerCase();
    const cat = (comp.category || "").toLowerCase();
    let easeOfUse = 55;
    let featureDepth = 55;
    let size = 80;

    if (cat.includes("marketplace") || cat.includes("lead")) easeOfUse += 15;
    if (cat.includes("community") || cat.includes("engagement")) easeOfUse += 12;
    if (cat.includes("crm") || cat.includes("sales")) featureDepth += 10;
    if (cat.includes("clinical") || cat.includes("operation")) featureDepth += 15;
    if (cat.includes("home care") || cat.includes("network")) {
      featureDepth += 12;
      easeOfUse += 5;
    }
    if (notes.includes("ai") || notes.includes("intelligence")) featureDepth += 8;
    if (notes.includes("mobile") || notes.includes("app")) easeOfUse += 8;
    if (notes.includes("unicorn") || notes.includes("billion")) size = 160;
    else if (notes.includes("$150m") || notes.includes("$325m")) size = 140;
    else if (notes.includes("$44m") || notes.includes("$62m") || notes.includes("$31m")) size = 120;

    entries.push({
      name: comp.name,
      easeOfUse: Math.min(100, easeOfUse),
      featureDepth: Math.min(100, featureDepth),
      size,
      notes: comp.notes?.slice(0, 80) || "",
    });
  });

  return entries;
}

// ── Compute timeline ──
function computeTimelineData(competitors) {
  const events = [];
  competitors.forEach((comp) => {
    const funding = (comp.funding || "").toLowerCase();

    if (funding.includes("$150m series d") || funding.includes("softbank") || comp.name === "Papa") {
      if (!events.find(e => e.event.includes("Papa raises")))
        events.push({ date: "2021-Q4", event: `Papa raises $150M Series D at $1.4B valuation`, company: comp.name, impact: "high" });
    }
    if (funding.includes("$325m") || funding.includes("home instead") || comp.name === "Honor") {
      if (!events.find(e => e.event.includes("Honor acquires")))
        events.push({ date: "2021-Q3", event: `Honor acquires Home Instead, creating largest home care network`, company: comp.name, impact: "high" });
    }
    if ((funding.includes("$44m") || funding.includes("base10")) && comp.name === "August Health") {
      if (!events.find(e => e.event.includes("August Health secures")))
        events.push({ date: "2025-Q3", event: `${comp.name} secures $44M Series B for AI-enabled caregiving`, company: comp.name, impact: "high" });
    }
    if ((funding.includes("$62.4m") || funding.includes("series b")) && comp.name === "Birdie") {
      if (!events.find(e => e.event.includes("Birdie raises")))
        events.push({ date: "2024-Q2", event: `${comp.name} raises Series B to expand home care platform`, company: comp.name, impact: "medium" });
    }
    if ((funding.includes("$31.7m") || funding.includes("accel")) && comp.name === "Lottie") {
      if (!events.find(e => e.event.includes("Lottie raises")))
        events.push({ date: "2023-Q4", event: `${comp.name} raises $31.7M Series A led by Accel`, company: comp.name, impact: "medium" });
    }
    if (funding.includes("$4.5m") && comp.name === "Cubigo") {
      if (!events.find(e => e.event.includes("Cubigo raises")))
        events.push({ date: "2022-Q1", event: `${comp.name} raises $4.5M Series A for community platform`, company: comp.name, impact: "medium" });
    }
    if (comp.name === "Icon (Go Icon)") {
      if (!events.find(e => e.event.includes("Caremerge rebrands")))
        events.push({ date: "2023-Q2", event: "Caremerge rebrands to Icon, launches next-gen community platform", company: "Icon", impact: "medium" });
    }
    if (comp.name === "Kinto") {
      if (!events.find(e => e.event.includes("General Catalyst backs")))
        events.push({ date: "2024-Q1", event: "General Catalyst backs Kinto for caregiver support-as-a-benefit model", company: "Kinto", impact: "medium" });
    }
  });

  // Add Assistedly timeline milestone (2026)
  events.push({ date: "2026-Q2", event: "Assistedly launches AI-powered continuum dashboard — cultural/safety filters, family dashboard, comparison tools shipped in weeks with zero institutional funding", company: "Assistedly", impact: "high" });

  // Deduplicate and sort
  const seen = new Set();
  const unique = events.filter((e) => {
    const key = `${e.date}-${e.event}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => b.date.localeCompare(a.date));
  return unique.slice(0, 8);
}

// ── Compute analytics ──
function computeAnalytics(competitors, features) {
  const totalFeatures = features?.length || 0;
  const totalCompetitors = competitors?.length || 0;

  const fundings = competitors.map((c) => (c.funding || "").toLowerCase());
  // Only count competitor funding, NOT ourselves
  const totalFundingEstimate = fundings.reduce((sum, f) => {
    if (f.includes("billion") || f.includes("$1b")) return sum + 1400;
    if (f.includes("$325m")) return sum + 325;
    if (f.includes("$150m")) return sum + 150;
    if (f.includes("$62")) return sum + 62;
    if (f.includes("$44m")) return sum + 44;
    if (f.includes("$31")) return sum + 32;
    if (f.includes("$4.5") || f.includes("$3.5")) return sum + 4;
    if (f.includes("venture") || f.includes("genworth")) return sum + 50;
    if (f.includes("bootstrapped")) return sum + 0;
    return sum + 1;
  }, 0);

  const avgRating = competitors.reduce((sum, c) => {
    const r = parseFloat((c.rating || "4.0").split("/")[0]?.trim());
    return sum + (isNaN(r) ? 4.0 : r);
  }, 0) / Math.max(1, totalCompetitors);

  const categories = [...new Set(competitors.map((c) => c.category).filter(Boolean))];
  const marketSaturationScore = Math.min(100, totalCompetitors * 8 + totalFeatures * 3);

  return {
    totalFeatures,
    totalCompetitors,
    marketSaturationScore,
    assistedlyFeatureCount: 8,
    avgFeaturesPerCompetitor: Math.round((totalFeatures / Math.max(1, totalCompetitors)) * 10) / 10,
    totalFundingEstimate: `$${totalFundingEstimate}M+`,
    avgCompetitorRating: avgRating.toFixed(1),
    categoryCount: categories.length,
    competitiveGap:
      `The AgeTech vendor landscape spans ${categories.length} distinct market segments: clinical SaaS (August Health, Birdie), consumer marketplaces (Lottie, CareScout, SeniorCare.com), companion care networks (Papa at $1.4B, Honor at $1.25B), community engagement (Cubigo, Icon), and caregiver support (Kinto).`,
    competitivePositioning:
      `Assistedly uniquely occupies the AI-powered consumer marketplace intersection — a position no competitor fully owns.`,
    totalFeaturesTrend: 5,
    totalCompetitorsTrend: 8,
    marketSaturationTrend: 10,
    assistedlyFeatureTrend: 3,
    categories,
  };
}

// ── API Handler ──
export default function handler(req, res) {
  try {
    const dataPath = path.join(process.cwd(), "data", "firecrawl-features-competitors.json");

    let firecrawlData;
    if (fs.existsSync(dataPath)) {
      firecrawlData = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    } else {
      return res.status(404).json({ error: "Data file not found." });
    }

    const { competitors, features, summary, lastUpdate } = firecrawlData;

    const analytics = computeAnalytics(competitors, features);
    const radarData = computeRadarData(competitors, features);
    const landscapeData = computeLandscapeData(competitors);
    const timelineData = computeTimelineData(competitors);

    return res.status(200).json({
      summary,
      features,
      competitors,
      lastUpdate,
      analytics,
      radarData,
      landscapeData,
      timelineData,
    });
  } catch (error) {
    console.error("API error loading Firecrawl data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}