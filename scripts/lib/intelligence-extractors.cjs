/**
 * Intelligence Extractors — Phase A/B shared extraction functions
 * Version: 2026-08-23-v1
 *
 * Extraction targets:
 *   - Listing health (photos, pricing, amenities, care types, response rates)
 *   - Deep review cards (individual review text + metadata)
 *   - Price normalization
 *   - Amenity normalization to controlled vocabulary
 */

const crypto = require("crypto");

// ── Controlled Vocabulary ─────────────────────────────────────────────────
const AMENITY_VOCABULARY = [
  "24-hour staff", "transportation", "medication management", "memory care",
  "dementia care", "private rooms", "pet friendly", "fitness center",
  "dining services", "housekeeping", "laundry", "social activities",
  "physical therapy", "respite care", "hospice care", "wi-fi",
  "barber/salon", "library", "garden/patio", "parking",
];

const AMENITY_ALIASES = {
  "24-hour staff": [/24[-\s]hour\s+(?:staff|care|nursing|security)/i, /around[-\s]the[-\s]clock\s+(?:staff|care)/i],
  "transportation": [/transportation/i, /shuttle/i, /van\s+service/i],
  "medication management": [/medication\s+management/i, /medication\s+administration/i],
  "memory care": [/memory\s+care/i, /memory\s+support/i],
  "dementia care": [/dementia\s+care/i, /alzheimer'?s\s+care/i],
  "private rooms": [/private\s+(?:room|suite|apartment)/i, /private\s+bath/i],
  "pet friendly": [/pet\s+friendly/i, /pets?\s+allowed/i, /pets?\s+welcome/i],
  "fitness center": [/fitness\s+(?:center|room|studio)/i, /exercise\s+room/i, /gym/i],
  "dining services": [/dining\s+services?/i, /restaurant/i, /chef/i, /meals?\s+(?:included|provided)/i],
  "housekeeping": [/housekeeping/i, /maid\s+service/i],
  "laundry": [/laundry/i, /linen\s+service/i],
  "social activities": [/social\s+activities/i, /activities\s+program/i, /events?\s+calendar/i, /recreation/i],
  "physical therapy": [/physical\s+therapy/i, /rehabilitation/i, /rehab/i],
  "respite care": [/respite\s+care/i, /respite\s+stay/i, /short[-\s]term\s+stay/i],
  "hospice care": [/hospice/i],
  "wi-fi": [/wi[-\s]?fi/i, /internet/i, /wireless/i],
  "barber/salon": [/barber/i, /salon/i, /hair\s+salon/i, /beauty\s+salon/i],
  "library": [/library/i, /books/i],
  "garden/patio": [/garden/i, /patio/i, /courtyard/i, /outdoor/i],
  "parking": [/parking/i, /garage/i],
};

const CARE_TYPE_ALIASES = {
  "assisted living": [/assisted\s+living/i, /assisted\s+living\s+residence/i],
  "memory care": [/memory\s+care/i, /memory\s+support/i],
  "independent living": [/independent\s+living/i, /senior\s+apartment/i],
  "nursing home": [/nursing\s+home/i, /skilled\s+nursing/i, /snf/i],
  "hospice": [/hospice\s+care/i],
  "respite care": [/respite\s+care/i],
};

// ── Platform Config ─────────────────────────────────────────────────────────
const PLATFORM_QUERIES = [
  {
    name: "APlaceForMom",
    searchQuery: (fac) => `"${fac.name}" ${fac.cityClean} Massachusetts site:aplaceformom.com`,
    listingIndicators: ["aplaceformom.com/community"],
    blacklistPatterns: ["/assisted-living-facilities/", "/best-", "/top-"],
  },
  {
    name: "Caring",
    searchQuery: (fac) => `"${fac.name}" ${fac.cityClean} Massachusetts site:caring.com/senior-living`,
    listingIndicators: ["caring.com/senior-living/massachusetts/"],
    blacklistPatterns: ["/best-", "/top-"],
  },
  {
    name: "SeniorAdvisor",
    searchQuery: (fac) => `"${fac.name}" ${fac.cityClean} Massachusetts site:senioradvisor.com`,
    listingIndicators: ["senioradvisor.com/assisted-living/"],
    blacklistPatterns: [],
  },
  {
    name: "Google",
    searchQuery: (fac) => `"${fac.name}" ${fac.cityClean} Massachusetts assisted living`,
    listingIndicators: ["google.com/maps", "google.com/search"],
    blacklistPatterns: [],
  },
];

// ── Extraction: Listing Intelligence ────────────────────────────────────────
function extractListingIntelligence(rawHtml, meta, platform) {
  const plainText = stripHtmlTags(rawHtml);
  const fullText = `${meta.title || ""} ${meta.description || ""} ${plainText}`;

  const facilityFound = isFacilityListingPage(rawHtml, meta, platform);
  const pageType = classifyPageType(rawHtml, meta, platform);

  // Photos
  const photoData = extractPhotoCount(rawHtml);

  // Pricing (also search meta title/description for hints)
  const metaText = `${meta.title || ""} ${meta.description || ""}`;
  const priceData = extractPriceFromText(fullText) || extractPriceFromText(metaText);

  // Amenities
  const amenities = normalizeAmenities(fullText);

  // Care types
  const careTypes = extractCareTypes(fullText);

  // Response rate
  const responseData = extractResponseSignals(rawHtml, plainText);

  // Total reviews on page (search rawHtml, plainText, and meta)
  const totalReviewsOnPage = extractTotalReviewsOnPage(rawHtml, plainText)
    ?? extractTotalReviewsOnPage(metaText, metaText);

  // Confidence
  const confidence = deriveListingConfidence({
    facilityFound, photoData, priceData, amenities, careTypes, responseData, rawHtml,
  });

  return {
    platform,
    url: meta?.sourceURL || meta?.url || null,
    facility_found: facilityFound,
    page_type: pageType,

    photos_present: photoData.count > 0,
    photo_count_estimate: photoData.count,

    pricing_disclosed: priceData.low !== null || priceData.high !== null,
    price_text: priceData.raw,
    price_parsed_low: priceData.low,
    price_parsed_high: priceData.high,

    amenities_list: amenities,
    care_types_listed: careTypes,

    response_rate_visible: responseData.visible,
    response_rate_text: responseData.text,
    owner_response_count: responseData.ownerResponseCount,
    total_reviews_on_page: totalReviewsOnPage,

    page_title: meta?.title || null,
    page_description: meta?.description || null,
    last_scraped_at: new Date().toISOString(),
    extraction_confidence: confidence,
    _extractor_version: "2026-08-23-v1",
  };
}

function isFacilityListingPage(rawHtml, meta, platform) {
  const url = (meta?.sourceURL || meta?.url || "").toLowerCase();
  const title = (meta?.title || "").toLowerCase();
  const html = rawHtml.toLowerCase();

  const platformConfig = PLATFORM_QUERIES.find((p) => p.name === platform);
  if (!platformConfig) return false;

  // URL-based indicators
  for (const ind of platformConfig.listingIndicators) {
    if (url.includes(ind.toLowerCase())) return true;
  }

  // Title-based clues
  const facilityPageTitlePatterns = [
    /assisted living/i,
    /senior living/i,
    /memory care/i,
    /nursing home/i,
  ];
  const hasFacilityTitle = facilityPageTitlePatterns.some((p) => p.test(title));

  // Check for review section presence
  const hasReviewSection =
    /class="[^"]*review[^"]*"|<div[^>]*data-testid="review/i.test(rawHtml) ||
    /\d+\s+reviews?/i.test(title + " " + meta?.description || "");

  // Check for photo gallery presence
  const hasPhotoGallery =
    /gallery|photo|image|slideshow/i.test(rawHtml) &&
    (html.includes('class="gallery') || html.includes("data-testid=\"gallery"));

  return hasFacilityTitle && (hasReviewSection || hasPhotoGallery || title.includes(platform.toLowerCase()));
}

function classifyPageType(rawHtml, meta, platform) {
  const url = (meta?.sourceURL || meta?.url || "").toLowerCase();
  const title = (meta?.title || "").toLowerCase();

  const platformConfig = PLATFORM_QUERIES.find((p) => p.name === platform);
  if (platformConfig) {
    for (const bp of platformConfig.blacklistPatterns) {
      if (url.includes(bp.toLowerCase()) || title.includes(bp.replace(/\//g, "").toLowerCase())) {
        return "directory_search";
      }
    }
  }

  if (/best\s+assisted\s+living|top\s+\d+|assisted\s+living\s+facilities\s+in/i.test(title)) {
    return "directory_search";
  }

  if (/\d+\s+assisted\s+living\s+communit|compare\s+facilit/i.test(title)) {
    return "aggregate";
  }

  if (isFacilityListingPage(rawHtml, meta, platform)) {
    return "facility_listing";
  }

  return "unknown";
}

function extractPhotoCount(rawHtml) {
  const patterns = [
    /(\d+)\s*photos?/i,
    /photo\s*gallery\s*\((\d+)\)/i,
    /gallery\s*\((\d+)\)/i,
    /(\d+)\s*images?/i,
  ];

  for (const p of patterns) {
    const m = rawHtml.match(p);
    if (m) {
      return { count: parseInt(m[1], 10), source: "regex" };
    }
  }

  // Count <img> tags in likely gallery sections
  const gallerySection = rawHtml.match(/<div[^>]*class="[^"]*(gallery|photos|slideshow|media)[^"]*"[^>]*>[\s\S]*?<\/div>/i);
  if (gallerySection) {
    const imgs = gallerySection[0].match(/<img/gi);
    if (imgs) return { count: imgs.length, source: "img_count" };
  }

  // Count all <img> in page (cap at reasonable number)
  const allImgs = rawHtml.match(/<img/gi);
  if (allImgs && allImgs.length >= 3) {
    // Conservative: if there are many images, facility likely has photos
    return { count: allImgs.length, source: "page_img_count" };
  }

  return { count: 0, source: "none" };
}

function extractPriceFromText(text) {
  if (!text) return { low: null, high: null, raw: null };

  const patterns = [
    { regex: /\$([\d,]+)\s*[-–—]\s*\$([\d,]+)/, type: "range" },
    { regex: /starting\s*at\s*\$([\d,]+)/i, type: "start" },
    { regex: /from\s*\$([\d,]+)/i, type: "start" },
    { regex: /\$([\d,]+)\s*\/?\s*(?:per\s+)?month/i, type: "monthly" },
    { regex: /\$([\d,]+)\s*\/?\s*(?:per\s+)?day/i, type: "daily" },
    { regex: /\$([\d,]+)\s*\/?\s*(?:per\s+)?week/i, type: "weekly" },
  ];

  for (const p of patterns) {
    const m = text.match(p.regex);
    if (m) {
      if (p.type === "range") {
        const low = parseInt(m[1].replace(/,/g, ""), 10);
        const high = parseInt(m[2].replace(/,/g, ""), 10);
        return { low, high, raw: m[0] };
      }
      if (p.type === "start" || p.type === "monthly" || p.type === "weekly" || p.type === "daily") {
        const val = parseInt(m[1].replace(/,/g, ""), 10);
        return { low: val, high: null, raw: m[0] };
      }
    }
  }

  return { low: null, high: null, raw: null };
}

function normalizeAmenities(text) {
  if (!text) return [];
  const found = new Set();
  for (const [canonical, patterns] of Object.entries(AMENITY_ALIASES)) {
    for (const p of patterns) {
      if (p.test(text)) {
        found.add(canonical);
        break;
      }
    }
  }
  return Array.from(found);
}

function extractCareTypes(text) {
  if (!text) return [];
  const found = new Set();
  for (const [canonical, patterns] of Object.entries(CARE_TYPE_ALIASES)) {
    for (const p of patterns) {
      if (p.test(text)) {
        found.add(canonical);
        break;
      }
    }
  }
  return Array.from(found);
}

function extractResponseSignals(rawHtml, plainText) {
  const fullText = `${rawHtml} ${plainText}`;

  const visible =
    /responded to/i.test(fullText) ||
    /owner response/i.test(fullText) ||
    /business owner/i.test(fullText);

  const textMatch = fullText.match(/responded to ([\d]+%)/i);
  const text = textMatch ? textMatch[0] : null;

  const ownerResponseCount = (plainText.match(/owner response/gi) || []).length;

  return { visible, text, ownerResponseCount };
}

function extractTotalReviewsOnPage(rawHtml, plainText) {
  const patterns = [
    /(\d+)\s+reviews?\b/i,
    /Read\s+(\d+)\s+reviews?/i,
    /Ratings?\s*\(\s*(\d+)\s*\)/i,
    /Reviews?\s*\(\s*(\d+)\s*\)/i,
    /\((\d+)\)\s*reviews?/i,
    /reviewCount["']?\s*[:=]\s*["']?(\d+)/i,
    /"review_count":\s*(\d+)/i,
    // Markdown variants with no space: "(1review)", "12reviews"
    /\((\d+)reviews?\)/i,
    />(\d+)reviews?</i,
    // JSON-LD / data attributes
    /"reviewCount"\s*:\s*(\d+)/i,
    /"aggregateRating"[^}]*"reviewCount"\s*:\s*(\d+)/is,
  ];

  for (const p of patterns) {
    const m = (plainText + " " + rawHtml).match(p);
    if (m) return parseInt(m[1], 10);
  }

  return null;
}

function deriveListingConfidence({ facilityFound, photoData, priceData, amenities, careTypes, responseData, rawHtml }) {
  let score = 0;
  if (facilityFound) score += 3;
  if (photoData.count > 0) score += 1;
  if (priceData.low || priceData.high) score += 1;
  if (amenities.length > 0) score += 1;
  if (careTypes.length > 0) score += 1;
  if (responseData.visible) score += 1;
  if (rawHtml.length > 1000) score += 1;

  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}

// ── Extraction: Deep Reviews ───────────────────────────────────────────────
function extractDeepReviews(rawHtml, platform, markdown = null) {
  const reviews = [];

  // Platform-specific start-tag patterns for review blocks
  const startPatterns = {
    APlaceForMom: /<div[^>]*(?:data-testid="[^"]*review[^"]*"|class="[^"]*review-card[^"]*")[^>]*>/gi,
    Caring: /<div[^>]*(?:data-testid="[^"]*review[^"]*"|class="[^"]*(?:review-card|review-item)[^"]*")[^>]*>/gi,
    SeniorAdvisor: /<div[^>]*(?:data-testid="[^"]*review[^"]*"|class="[^"]*review[^"]*")[^>]*>/gi,
    Google: /<div[^>]*(?:data-testid="[^"]*review[^"]*"|class="[^"]*(?:review|jftiEf|wiI7pd)[^"]*")[^>]*>/gi,
  };

  const startPattern = startPatterns[platform];
  if (startPattern) {
    let match;
    let count = 0;
    while ((match = startPattern.exec(rawHtml)) !== null && count < 50) {
      count++;
      const startIndex = match.index;
      const startTagEnd = startIndex + match[0].length;

      // Walk forward to find the matching </div> by counting <div vs </div>
      let depth = 1;
      let idx = startTagEnd;
      let endIndex = -1;

      while (depth > 0 && idx < rawHtml.length) {
        const nextOpen = rawHtml.indexOf('<div', idx);
        const nextClose = rawHtml.indexOf('</div>', idx);

        if (nextClose === -1) break;
        if (nextOpen !== -1 && nextOpen < nextClose) {
          depth++;
          idx = nextOpen + 4;
        } else {
          depth--;
          idx = nextClose + 6;
          if (depth === 0) {
            endIndex = idx;
          }
        }
      }

      if (endIndex === -1) continue;
      const block = rawHtml.slice(startIndex, endIndex);
      if (block.length > 8000) continue; // Sanity cap

      const review = parseReviewBlock(block, platform);
      if (review && review.review_text && review.review_text.length > 10) {
        reviews.push(review);
      }
    }
  }

  // Fallback: markdown-based extraction when HTML yields nothing
  if (reviews.length === 0 && markdown && markdown.length > 100) {
    const mdReviews = extractDeepReviewsFromMarkdown(markdown, platform);
    if (mdReviews && mdReviews.length > 0) {
      reviews.push(...mdReviews);
    }
  }

  return reviews.length > 0 ? reviews : null;
}

/**
 * Extract reviews from Firecrawl markdown output.
 * Most platforms render reviews via JS, so rawHtml is empty but markdown
 * contains the rendered text. We look for review-like blocks.
 */
function extractDeepReviewsFromMarkdown(mdText, platform) {
  const reviews = [];
  if (!mdText || mdText.length < 100) return null;

  // Clean up markdown: normalize line endings, strip image links but keep alt text,
  // and convert heading markers to plain text so they remain as structural signals.
  const clean = mdText
    .replace(/\r\n/g, '\n')
    .replace(/\*{2,}/g, '')
    .replace(/_{2,}/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')   // strip links -> keep text
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')   // strip images -> keep alt text
    .replace(/^#{1,6}\s+/gm, '');               // remove heading markers

  // ── Platform-specific section extraction ──
  const sectionRegex = /(?:##\s*(?:Featured Review|Reviews?|What Families Are Saying|Family Reviews|Testimonials)[\s\S]*?)(?=\n##\s|\n#{1,6}\s|$)/gi;
  let m;
  const sections = [];
  while ((m = sectionRegex.exec(clean)) !== null) {
    sections.push(m[0]);
  }
  // If no sections found, treat whole text as one section
  if (sections.length === 0) sections.push(clean);

  for (const section of sections) {
    const parsed = tryPlatformMarkdownParser(section, platform);
    if (parsed) reviews.push(...parsed);
  }

  // ── Fallback: generic chunk scoring if platform parsers yield nothing ──
  if (reviews.length === 0) {
    const generic = genericMarkdownExtraction(clean, platform);
    if (generic) reviews.push(...generic);
  }

  // Deduplicate by text_hash
  const seen = new Set();
  const deduped = [];
  for (const r of reviews) {
    if (!seen.has(r.text_hash)) {
      seen.add(r.text_hash);
      deduped.push(r);
    }
  }

  return deduped.length > 0 ? deduped : null;
}

function tryPlatformMarkdownParser(section, platform) {
  const reviews = [];
  const lines = section.split('\n').map(l => l.trim()).filter(Boolean);

  if (platform === 'Caring') {
    // Caring.com pattern per review:
    // [name/alt-text]
    // [rating 1-5]
    // |
    // [date]
    // [relationship]
    // [paragraphs...]
    // READ MORE
    for (let i = 0; i < lines.length - 4; i++) {
      const ratingLine = lines[i];
      const rating = /^(\d)(?:\.0)?$/.test(ratingLine) ? parseInt(ratingLine, 10) : null;
      if (!rating || rating < 1 || rating > 5) continue;
      if (lines[i + 1] !== '|') continue;

      const dateLine = lines[i + 2];
      const dateMatch = dateLine.match(/\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i)
        || dateLine.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/)
        || dateLine.match(/\b\d{4}-\d{2}-\d{2}\b/);
      if (!dateMatch) continue;

      // Reviewer name is the line before rating, unless it's a generic word
      let reviewerName = null;
      if (i > 0) {
        const candidate = lines[i - 1];
        if (candidate.length > 1 && !/^(reviews?|rating|verified|assisted|memory|senior|independent|nursing|home)$/i.test(candidate)) {
          reviewerName = candidate;
        }
      }

      // Body starts at i+3, ends at READ MORE or next rating pattern
      let bodyLines = [];
      let j = i + 3;
      while (j < lines.length) {
        const line = lines[j];
        if (/^READ\s+MORE$/i.test(line) || /^(\d)(?:\.0)?$/.test(line)) break;
        bodyLines.push(line);
        j++;
      }

      const body = bodyLines.join(' ').replace(/I am a friend or relative of a resident/i, '').replace(/Family member of resident\/client/i, '').trim();
      if (body.length > 15 && body.length < 2000) {
        const textHash = crypto.createHash("sha256").update(body).digest("hex").slice(0, 16);
        reviews.push({
          review_text: body,
          reviewer_name: reviewerName,
          review_date: dateMatch[0],
          rating,
          platform,
          is_owner_response: /business response|owner response|official response/i.test(body),
          reviewer_total_reviews: null,
          reviewer_location: null,
          text_hash: textHash,
          _extraction_source: 'markdown-caring',
        });
      }
    }
  }

  if (platform === 'APlaceForMom') {
    // APlaceForMom pattern per review:
    // [name/Anonymous]
    // -
    // [relationship]
    // [rating e.g. 5.0]
    // [title]
    // [body paragraphs...]
    // Read more
    for (let i = 0; i < lines.length - 4; i++) {
      if (lines[i + 1] !== '-') continue;

      const relationship = lines[i + 2];
      const ratingLine = lines[i + 3];
      const rating = /^\d+(?:\.\d+)?$/.test(ratingLine) ? parseFloat(ratingLine) : null;
      if (!rating || rating < 1 || rating > 5) continue;

      // Skip if next line looks like a heading/nav word instead of title
      const titleLine = lines[i + 4];
      if (!titleLine || /^(assisted|memory|senior|read|write|verified|reviews?)$/i.test(titleLine)) continue;

      const reviewerName = lines[i];

      let bodyLines = [];
      let j = i + 5;
      while (j < lines.length) {
        const line = lines[j];
        if (/^Read\s+more$/i.test(line) || /^(Read\s+less|Anonymous\s*\n)/i.test(line)) break;
        bodyLines.push(line);
        j++;
      }

      const body = bodyLines.join(' ').trim();
      if (body.length > 15 && body.length < 2000) {
        const textHash = crypto.createHash("sha256").update(body).digest("hex").slice(0, 16);
        reviews.push({
          review_text: body,
          reviewer_name: reviewerName,
          review_date: null, // APlaceForMom markdown rarely shows dates
          rating,
          platform,
          is_owner_response: false,
          reviewer_total_reviews: null,
          reviewer_location: null,
          text_hash: textHash,
          _extraction_source: 'markdown-apfm',
        });
      }
    }
  }

  if (platform === 'SeniorAdvisor') {
    // SeniorAdvisor is less structured; use generic scoring enhanced with date patterns
    return null;
  }

  return reviews.length > 0 ? reviews : null;
}

function genericMarkdownExtraction(clean, platform) {
  const reviews = [];
  const chunks = clean.split(/\n{2,}|\n(?=- )|\n(?=\d+\.)|(?=\d+ (?:days?|weeks?|months?) ago)/g);

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (trimmed.length < 30) continue;

    // ── Rating signals ──
    let rating = null;
    const starPatterns = [
      /([★☆]{1,5})/u,
      /(\d(?:\.\d)?)\s*(?:out of|\/|of)\s*5/i,
      /(\d(?:\.\d)?)\s*stars?/i,
      /Rated:?\s*(\d(?:\.\d)?)/i,
      /([\d.]+)\s*\/\s*5/i,
    ];
    for (const p of starPatterns) {
      const m = trimmed.match(p);
      if (m) {
        if (m[1] && /[★☆]/.test(m[1])) {
          rating = m[1].replace(/☆/g, '').length;
        } else {
          rating = parseFloat(m[1]);
        }
        if (rating && rating >= 1 && rating <= 5) break;
        rating = null;
      }
    }

    // ── Date signals ──
    let reviewDate = null;
    const datePatterns = [
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/i,
      /\b\d{1,2}\/\d{1,2}\/\d{4}\b/,
      /\b\d{4}-\d{2}-\d{2}\b/,
      /\b\d+\s+(?:days?|weeks?|months?|years?)\s+ago\b/i,
    ];
    for (const p of datePatterns) {
      const m = trimmed.match(p);
      if (m) { reviewDate = m[0]; break; }
    }

    // ── Reviewer name ──
    let reviewerName = null;
    const namePatterns = [
      /^(?!Review)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z.]+){0,2})\b/m,
      /(?:by|from|author[:\s]+)([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z.]+){0,2})/i,
      /^(?!Verified|Review|Rating)([A-Z][a-z]+\s+[A-Z][a-z]+)/m,
    ];
    for (const p of namePatterns) {
      const m = trimmed.match(p);
      if (m) {
        reviewerName = m[1].trim();
        if (reviewerName.length > 2 && !/^(Reviews?|Rating|Verified|Senior)/i.test(reviewerName)) break;
        reviewerName = null;
      }
    }

    // ── Review text ──
    let body = trimmed;
    if (reviewerName) body = body.replace(new RegExp(reviewerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
    if (reviewDate) body = body.replace(new RegExp(reviewDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '');
    body = body
      .replace(/Rated?:?\s*[\d.]+\s*(?:out of|\/|of)?\s*5?\s*stars?/gi, '')
      .replace(/[★☆]+/gu, '')
      .replace(/\b\d+\s*(?:days?|weeks?|months?|years?)\s+ago\b/gi, '')
      .replace(/^(?:Verified|Review|Rating)\b.*/gim, '')
      .replace(/\n+/g, ' ')
      .trim();

    const signals = [rating, reviewDate, reviewerName].filter(Boolean).length;
    if (signals >= 2 && body.length >= 15 && body.length <= 2000) {
      const textHash = crypto.createHash("sha256").update(body).digest("hex").slice(0, 16);
      reviews.push({
        review_text: body,
        reviewer_name: reviewerName,
        review_date: reviewDate,
        rating,
        platform,
        is_owner_response: /business response|owner response|official response/i.test(trimmed),
        reviewer_total_reviews: null,
        reviewer_location: null,
        text_hash: textHash,
        _extraction_source: 'markdown-generic',
      });
    }
  }

  return reviews.length > 0 ? reviews : null;
}

function parseReviewBlock(html, platform) {
  const plain = stripHtmlTags(html);

  // Reviewer name
  const namePatterns = [
    /class="[^"]*reviewer-name[^"]*"[^>]*>([^<]+)/i,
    /class="[^"]*user-name[^"]*"[^>]*>([^<]+)/i,
    /class="[^"]*author[^"]*"[^>]*>([^<]+)/i,
    /<a[^>]*class="[^"]*user[^"]*"[^>]*>([^<]+)/i,
    />([A-Z][a-z]+\s[A-Z][a-z.]+)(?:\s+verified|\s+reviewer)?/i,
  ];
  let reviewerName = null;
  for (const p of namePatterns) {
    const m = html.match(p);
    if (m) {
      reviewerName = m[1].trim();
      break;
    }
  }

  // Date
  const datePatterns = [
    /(\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b)/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{4}-\d{2}-\d{2})/,
  ];
  let reviewDate = null;
  for (const p of datePatterns) {
    const m = plain.match(p);
    if (m) {
      reviewDate = m[1];
      break;
    }
  }

  // Rating
  const ratingPatterns = [
    /(\d\.\d)\s*out of\s*5/i,
    /(\d\.\d)\s*\/\s*5/i,
    /aria-label="(\d)\s*stars?"/i,
    /"ratingValue"\s*:\s*"?(\d+\.?\d*)"?/i,
    /class="[^"]*star[^"]*"[^>]*>([\d.]+)/i,
  ];
  let rating = null;
  for (const p of ratingPatterns) {
    const m = html.match(p) || plain.match(p);
    if (m) {
      rating = parseFloat(m[1]);
      if (rating >= 1 && rating <= 5) break;
      rating = null;
    }
  }

  // Review text
  const textPatterns = [
    /class="[^"]*review-text[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /class="[^"]*comment[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    /<p>([\s\S]{20,2000})<\/p>/i,
  ];
  let reviewText = null;
  for (const p of textPatterns) {
    const m = html.match(p);
    if (m) {
      reviewText = stripHtmlTags(m[1]).trim();
      if (reviewText.length > 10) break;
    }
  }
  if (!reviewText || reviewText.length < 10) {
    // Fallback: use the plain text if it looks like a review
    const cleaned = plain.replace(reviewerName || "", "").replace(reviewDate || "", "").trim();
    if (cleaned.length > 20) reviewText = cleaned;
  }

  // Is owner response
  const isOwnerResponse = /owner response|business response|official response/i.test(plain);

  // Reviewer total reviews (if visible)
    const totalReviewsMatch = plain.match(/(?:\d+)\s*(?:reviews?|contributions?)/i) || plain.match(/\((\d+)\)/);
  const reviewerTotalReviews = totalReviewsMatch ? parseInt(totalReviewsMatch[1] || totalReviewsMatch[0], 10) || null : null;

  // Reviewer location
  const locationMatch = plain.match(/from\s+([A-Z][a-z]+(?:,\s*[A-Z]{2})?)/i) || plain.match(/([A-Z][a-z]+,\s*Massachusetts)/i);
  const reviewerLocation = locationMatch ? locationMatch[1] : null;

  if (!reviewText || reviewText.length < 10) return null;

  const textHash = crypto.createHash("sha256").update(reviewText).digest("hex").slice(0, 16);

  return {
    reviewer_name: reviewerName,
    review_date: reviewDate,
    rating,
    review_text: reviewText.slice(0, 2000),
    _full_text_hash: textHash,
    is_owner_response: isOwnerResponse,
    reviewer_total_reviews: reviewerTotalReviews,
    reviewer_location: reviewerLocation,
    extraction_confidence: rating && reviewerName && reviewDate ? "high" : (rating || reviewerName) ? "medium" : "low",
    platform,
  };
}

// ── Utility ─────────────────────────────────────────────────────────────────
function stripHtmlTags(html) {
  if (!html) return "";
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Exports ─────────────────────────────────────────────────────────────────
module.exports = {
  PLATFORM_QUERIES,
  AMENITY_VOCABULARY,
  extractListingIntelligence,
  extractDeepReviews,
  extractPhotoCount,
  extractPriceFromText,
  normalizeAmenities,
  extractCareTypes,
  extractResponseSignals,
  extractTotalReviewsOnPage,
  stripHtmlTags,
};
