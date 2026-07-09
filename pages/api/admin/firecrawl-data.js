import fs from "fs";
import path from "path";

export default function handler(req, res) {
  try {
    const dataPath = path.join(process.cwd(), "data", "firecrawl-features-competitors.json");
    
    // Fallback stub data if the json file doesn't exist yet
    let firecrawlData = {
      summary: "This dashboard displays competitor features and industry intelligence synchronized via Firecrawl. Baseline data is currently being prepared.",
      features: [
        {
          name: "Interactive Cost Calculator",
          description: "Competitor 'CareScout' launched an interactive cost slider detailing Massachusetts senior care pricing by region.",
          recommendation: "Build a simplified version of this slider utilizing our existing Massachusetts town dataset to engage visitors early."
        },
        {
          name: "Direct Facility Chat Widget",
          description: "SeniorCare.com is running an inline AI agent that books tours directly to a selection of top-3 local facilities.",
          recommendation: "Improve our existing homepage wizard by adding a 'Direct Tour Booking Request' option when matches are presented."
        }
      ],
      competitors: [
        {
          name: "CareScout",
          url: "https://www.carescout.com",
          notes: "Owned by Genworth. High focus on regional cost transparency."
        },
        {
          name: "SeniorCare.com",
          url: "https://www.seniorcare.com",
          notes: "Leads with instant wizard tools and aggressive SMS follow-ups."
        }
      ],
      lastUpdate: new Date().toLocaleDateString()
    };

    if (fs.existsSync(dataPath)) {
      const fileContent = fs.readFileSync(dataPath, "utf8");
      firecrawlData = JSON.parse(fileContent);
    } else {
      // Create folder if missing and save stub baseline
      const dataDir = path.dirname(dataPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(dataPath, JSON.stringify(firecrawlData, null, 2), "utf8");
    }

    return res.status(200).json(firecrawlData);
  } catch (error) {
    console.error("API error loading Firecrawl data:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
