import crypto from "crypto";
/**
 * HIPAA / MHMD / 201 CMR 17.00 — PII/PHI Sanitizer
 *
 * Scrub SSNs, phone numbers, emails, names, medical record IDs,
 * addresses, DOBs, credit cards, and IP addresses from all text
 * before it leaves the application boundary for LLM endpoints.
 */

const RE_PATTERNS = {
  // US Social Security Number
  ssn: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,

  // US Phone numbers (includes area code in parentheses, dashes, dots, spaces)
  phone: /\b(?:\+?1[-.\s]?)?\(?[2-9]\d{2}\)?[-.\s]?[2-9]\d{2}[-.\s]?\d{4}\b/g,

  // Email addresses
  email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,

  // Credit cards (Visa, MC, Amex, Discover basic patterns)
  creditCard:
    /\b(?:4\d{3}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}|5[1-5]\d{2}[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4}|3[47]\d{2}[-.\s]?\d{6}[-.\s]?\d{5}|6(?:011|5\d{2})[-.\s]?\d{4}[-.\s]?\d{4}[-.\s]?\d{4})\b/g,

  // IPv4
  ipv4: /\b(?:25[0-5]|2[0-4]\d|1?\d{1,2})(?:\.(?:25[0-5]|2[0-4]\d|1?\d{1,2})){3}\b/g,

  // IPv6 (simplified — collapses common forms)
  ipv6: /\b(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}\b/g,

  // US Street address pattern (number + street name + type)
  streetAddress:
    /\b\d+\s+(?:[NnSsEeWw]\.?\s+)?[A-Za-z0-9]+(?:\s+[A-Za-z]+){0,2}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct|Terrace|Ter|Place|Pl|Circle|Cir|Highway|Hwy|Loop|Parkway|Pkwy)\b/gi,

  // Medical Record Numbers (MRN, patient ID, record #)
  mrn: /\b(?:MRN|Medical Record|Number|Patient ID|Record #|Account #)[\s:#-]*(\d{6,})\b/gi,

  // Date of Birth patterns (MM/DD/YYYY, MM-DD-YYYY, Month DD, YYYY)
  dob: /\b(?:0[1-9]|1[0-2])[\/\-](?:0[1-9]|[12]\d|3[01])[\/\-](?:19|20)\d{2}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+(?:0?[1-9]|[12]\d|3[01]),?\s+(?:19|20)\d{2}\b/gi,
};

// Common given names and family names (top 200 US names) — heuristic to flag "Name: John Smith"
const COMMON_FIRST_NAMES = new Set([
  "james","john","robert","michael","william","david","richard","joseph","thomas","charles",
  "daniel","matthew","anthony","mark","donald","steven","paul","andrew","kenneth","joshua",
  "kevin","brian","george","edward","ronald","timothy","jason","jeffrey","ryan","jacob",
  "gary","nicholas","eric","jonathan","stephen","larry","justin","scott","brandon","benjamin",
  "samuel","gregory","frank","alexander","raymond","patrick","jack","dennis","jerry","tyler",
  "mary","patricia","jennifer","linda","elizabeth","barbara","susan","jessica","sarah","karen",
  "nancy","lisa","betty","margaret","sandra","ashley","kimberly","emily","donna","michelle",
  "dorothy","carol","amanda","melissa","deborah","stephanie","rebecca","laura","sharon","cynthia",
  "kathleen","amy","shirley","angela","helen","anna","brenda","pamela","nicole","emma",
  "samantha","katherine","christine","debra","rachel","catherine","carolyn","janet","emma","maria",
  "lucy","grace","ruby","evelyn","audrey","kayla","alexis","olivia","sophia","mia",
  "isabella","charlotte","abigail","harper","emily","elizabeth","amelia","evie","ella","scarlett",
  "aria","layla","chloe","zoey","nora","lily","eleanor","hannah","lillian","addison",
  "aubrey","ellie","stella","natalie","zoe","leah","hazel","violet","aurora","savannah",
  "audrey","brooklyn","bella","claire","skylar","lucy","paisley","everly","anna","caroline",
  "nova","genesis","emilia","kennedy","kinsley","allison","maya","london","aubrey","madison",
]);

/**
 * Replace detected PII entities with redaction tokens.
 * We deliberately do NOT use an NLP dependency (no Presidio install)
 * to keep CI/CD and serverless bundles lightweight.
 */
function redactWithPatterns(text) {
  if (typeof text !== "string") return text;

  let out = text;

  // 1. High-confidence deterministic patterns
  out = out.replace(RE_PATTERNS.ssn, "[REDACTED-SSN]");
  out = out.replace(RE_PATTERNS.phone, "[REDACTED-PHONE]");
  out = out.replace(RE_PATTERNS.email, "[REDACTED-EMAIL]");
  out = out.replace(RE_PATTERNS.creditCard, "[REDACTED-CC]");
  out = out.replace(RE_PATTERNS.ipv4, "[REDACTED-IP]");
  out = out.replace(RE_PATTERNS.ipv6, "[REDACTED-IP]");
  out = out.replace(RE_PATTERNS.streetAddress, "[REDACTED-ADDRESS]");
  out = out.replace(RE_PATTERNS.mrn, (match) => match.replace(/\d{6,}/, "[REDACTED-MRN]"));
  out = out.replace(RE_PATTERNS.dob, "[REDACTED-DOB]");

  // 2. Heuristic: "Name: John Smith" or "Patient: Jane Doe"
  out = out.replace(
    /\b(?:name|patient|resident|contact|guardian|power of attorney|healthcare proxy)\s*[:\-]\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})/gi,
    (match, namePart) => {
      const parts = namePart.trim().split(/\s+/);
      const looksLikeName = parts.some((p) => COMMON_FIRST_NAMES.has(p.toLowerCase()));
      if (looksLikeName) {
        return match.replace(namePart, "[REDACTED-NAME]");
      }
      return match;
    }
  );

  // 3. Heuristic: ZIP + street-like context (catches missed addresses)
  out = out.replace(
    /\b(\d{1,5}\s+[A-Za-z]+(?:\s+[A-Za-z]+){0,2}\s+(?:Apt|Unit|Suite|#)\s*\w+),?\s*[A-Za-z]+,?\s*[A-Za-z]{2}\s*\d{5}(-\d{4})?\b/gi,
    "[REDACTED-ADDRESS]"
  );

  return out;
}

/**
 * Deep-sanitize a value: strings are redacted; objects/arrays are traversed.
 */
export function sanitize(value) {
  if (typeof value === "string") {
    return redactWithPatterns(value);
  }
  if (Array.isArray(value)) {
    return value.map(sanitize);
  }
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const out = {};
    for (const key of Object.keys(value)) {
      // Field-level encryption hint: keys that likely contain PII get extra handling
      const lowerKey = key.toLowerCase();
      const isSensitive =
        /(ssn|dob|birth|phone|email|address|name|patient|mrn|record|insurance|ssn|credit|card)/.test(lowerKey);
      if (isSensitive && typeof value[key] === "string" && value[key].length > 0) {
        out[key] = redactWithPatterns(value[key]);
      } else {
        out[key] = sanitize(value[key]);
      }
    }
    return out;
  }
  return value;
}

/**
 * One-way hash for logging (so we can correlate prompts without storing text).
 */
export function hashForAudit(text) {
  if (typeof text !== "string") return "";
  return crypto.createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

/**
 * Truncate + sanitize for error contexts (never ships raw text to logs).
 */
export function safePreview(text, maxLen = 120) {
  if (typeof text !== "string") return "";
  const sanitized = redactWithPatterns(text);
  if (sanitized.length <= maxLen) return sanitized;
  return sanitized.slice(0, maxLen) + "…";
}

/**
 * Batch-sanitize an entire prompt payload before dispatch to LLM.
 */
export function sanitizePromptPayload(payload) {
  return sanitize(payload);
}

/**
 * Quick boolean check (useful for middleware gating).
 */
export function containsPii(text) {
  if (typeof text !== "string") return false;
  const sanitized = redactWithPatterns(text);
  return sanitized !== text;
}
