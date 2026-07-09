/**
 * Sanitize facility names coming from Dify KB retrieval or document titles.
 *
 * Strips patterns that leak internal document metadata into user-facing UI,
 * violating the guardrails defined in commit 9ea1e03:
 *
 *   - "PDF v. 9-18-2024_LR" suffixes (from uploaded knowledge-base PDFs)
 *   - Trailing em-dash remnants after stripping
 *
 * Every place that surfaces a facility name from a KB / SSE / Dify source
 * should run the name through this function before display.
 */

/**
 * Regex that matches document-filename suffixes accidentally included in
 * facility names by Dify's knowledge-retrieval node.
 *
 * Examples it catches:
 *   "Benchmark Senior Living - Waltham Crossings PDF v. 9-18-2024_LR"
 *   "Sunrise of Cohasset PDF v. 12-1-2025_LR_final"
 */
const PDF_FILENAME_RE = /\s*PDF\s+v\.\s*[\d\-]+_LR[^\s]*/gi

export function sanitizeFacilityName(name) {
  return String(name || '')
    .replace(PDF_FILENAME_RE, '')
    .replace(/\s*—\s*$/, '')
    .trim()
}

export { PDF_FILENAME_RE }
