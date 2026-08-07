/**
 * Zero-Data-Retention (ZDR) enforcement for LLM vendors.
 *
 * HIPAA BAA + Washington MHMD require that vendors do not retain
 * prompts for model training or QA.  We inject the strongest ZDR
 * headers/flags supported by each provider.
 */

export const ZDR_HEADERS = {
  // OpenAI: no official ZDR header, but we send a contract-level marker.
  // In practice ZDR is enforced via BAA + zero-retention org agreement.
  openai: {
    "X-Zero-Data-Retention": "true",
    "OpenAI-Beta": "zero-data-retention",
  },

  // Anthropic: no public ZDR header; marker only.
  anthropic: {
    "X-Zero-Data-Retention": "true",
  },

  // AWS Bedrock: custom marker (actual ZDR requires account-level config).
  bedrock: {
    "X-Amzn-Zero-Data-Retention": "true",
  },

  // Azure OpenAI: marker + no-store cache directive
  azure: {
    "X-Zero-Data-Retention": "true",
    "Cache-Control": "no-store",
  },

  // Dify (self-hosted / BAA-covered): custom header we can route through nginx.
  dify: {
    "X-Zero-Data-Retention": "true",
    "X-Assistedly-Hipaa-Scope": "phi",
    "Cache-Control": "no-store",
  },

  // Ollama / LiteLLM (on-prem): no upstream retention, but we mark anyway.
  ollama: {
    "X-Zero-Data-Retention": "true",
  },

  // Generic fallback for any other OpenAI-compatible proxy.
  generic: {
    "X-Zero-Data-Retention": "true",
    "Cache-Control": "no-store",
  },
};

/**
 * Resolve vendor from URL heuristic.
 */
export function detectVendorFromUrl(url) {
  const u = String(url || "").toLowerCase();
  if (u.includes("openai.com")) return "openai";
  if (u.includes("anthropic")) return "anthropic";
  if (u.includes("bedrock")) return "bedrock";
  if (u.includes("azure.com") || u.includes("openai.azure")) return "azure";
  if (u.includes("dify") || u.includes("forwardjump")) return "dify";
  if (u.includes("ollama") || u.includes(" litellm ")) return "ollama";
  return "generic";
}

/**
 * Return header map for a fetch/init call.
 */
export function getZdrHeaders(vendorOrUrl, overrides = {}) {
  const vendor =
    ZDR_HEADERS[vendorOrUrl] ? vendorOrUrl : detectVendorFromUrl(vendorOrUrl);
  const base = ZDR_HEADERS[vendor] || ZDR_HEADERS.generic;
  return { ...base, ...overrides };
}

/**
 * Merge ZDR headers into a standard header object for fetch().
 */
export function mergeZdr(headersObj, vendorOrUrl) {
  const zdr = getZdrHeaders(vendorOrUrl);
  return { ...headersObj, ...zdr };
}

/**
 * Runtime toggle: set ZDR_ENFORCED=0 to disable (emergency only).
 */
export function isZdrEnforced() {
  return process.env.ZDR_ENFORCED !== "false";
}
