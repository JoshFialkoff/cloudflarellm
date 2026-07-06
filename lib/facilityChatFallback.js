/**
 * Facility fallback utilities for the Dify chat response pipeline.
 *
 * These functions provide a native fallback in case the Dify response doesn't
 * include a structured Top 3 facility match list.
 */

import { searchLocalFacilities, titleCaseTown } from './instantTop3Sse'

function formatCurrency(amount) {
  return `$${Math.round(amount || 0).toLocaleString('en-US')}`
}

function normalizeCareTypeLabel(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'memory') return 'Memory Care'
  if (normalized === 'skilled') return 'Skilled Nursing'
  if (normalized === 'assisted') return 'Assisted Living'
  return normalized ? normalized.replace(/\b\w/g, (letter) => letter.toUpperCase()) : ''
}

function facilityMatchesCareType(facility, careTypeLabel) {
  if (!careTypeLabel) return false
  return (facility.careTypes || []).some((entry) => String(entry).toLowerCase().includes(careTypeLabel.toLowerCase()))
}

function buildWhyLine(facility, inputs) {
  const reasons = []
  const careTypeLabel = normalizeCareTypeLabel(inputs?.care_type || inputs?.careType)
  const budget = Number(inputs?.monthly_budget) || 0

  if (careTypeLabel && facilityMatchesCareType(facility, careTypeLabel)) {
    reasons.push(`offers ${careTypeLabel.toLowerCase()}`)
  }

  if (budget > 0) {
    if ((facility.monthlyMax || 0) <= budget) {
      reasons.push('fits within the stated budget')
    } else if ((facility.monthlyMin || 0) <= budget) {
      reasons.push('starts near the stated budget')
    }
  }

  if (facility.complianceRating) {
    reasons.push(`${facility.complianceRating.toLowerCase()} compliance history`)
  }

  if (facility.rating) {
    reasons.push(`${facility.rating}/5 rating`)
  }

  return reasons.slice(0, 3).join(', ')
}

/**
 * Check whether text already contains a Top-3 facility match list
 * (numbered items with Memory care and Why sections).
 */
export function replyIncludesTop3Matches(text) {
  if (!text || typeof text !== 'string') return false
  const normalized = text.replace(/\r\n/g, '\n').trim()
  if (!normalized) return false
  if (/cannot provide a third option|need additional information|not enough information/i.test(normalized)) {
    return false
  }
  const items = [...normalized.matchAll(/(?:^|\n)\s*(\d+)[\).]\s+/g)]
  return items.length >= 3
}

/**
 * Build a complete native Top 3 facility reply from the query and inputs.
 * Returns null if not enough data is available (falls through to LLM/Dify).
 */
export function buildCompleteNativeTop3Reply(query, inputs) {
  const facilities = searchLocalFacilities(query, inputs)
  if (!facilities.length) return null

  const location = String(inputs?.Location || '').trim() || 'Massachusetts'
  const careTypeLabel = normalizeCareTypeLabel(inputs?.care_type || inputs?.careType) || 'senior living'
  const budget = Number(inputs?.monthly_budget) || 0
  const intro = [
    [
      "Here are instant results from my proprietary database. I'm updating this now to make sure I give you the best options",
      `for ${careTypeLabel.toLowerCase()} options near ${location}`,
      budget > 0 ? `with a target budget of ${formatCurrency(budget)} per month.` : '.',
    ].join(' '),
  ]
    .filter(Boolean)
    .join(' ')

  const body = facilities.slice(0, 3).map((facility, index) => {
    const townLabel = titleCaseTown(facility.town)
    const town = townLabel ? ` — ${townLabel}` : ''
    const why = buildWhyLine(facility, inputs)
    const amenities = (facility.amenities || [])
      .slice(0, 3)
      .map((item) => item.name)
      .join(', ')

    return [
      `${index + 1}) ${facility.name}${town}`,
      `Care types: ${(facility.careTypes || []).join(', ')}`,
      `Monthly cost: ${formatCurrency(facility.monthlyMin)}–${formatCurrency(facility.monthlyMax)}`,
      `Why it may fit: ${why || 'strong local match based on care needs, budget, and location'}.`,
      amenities ? `Notable amenities: ${amenities}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  })

  return [intro, ...body].join('\n\n').trim()
}

/**
 * Build a minimal local fallback when the Dify/LLM response is empty.
 * Returns null by default (the caller uses a generic fallback string).
 */
export function buildLocalFacilityChatFallback(query, inputs) {
  return buildCompleteNativeTop3Reply(query, inputs)
}

/**
 * Build facility retrieval context from the query and inputs.
 * Used by nativeFastTop3Chat.js for retrieval-augmented generation.
 */
export function buildFacilityRetrievalContext(query, inputs, topK = 5) {
  const facilities = searchLocalFacilities(query, inputs).slice(0, topK)
  if (!facilities.length) return ''
  return facilities
    .map(
      (facility, index) =>
        `${index + 1}. ${facility.name} (${titleCaseTown(facility.town)}) — ${facility.rating}/5, ${
          facility.complianceRating || 'N/A'
        } compliance, ${(facility.careTypes || []).join(', ')}, ${formatCurrency(
          facility.monthlyMin
        )}-${formatCurrency(facility.monthlyMax)}/month.`,
    )
    .join('\n')
}
<<<<<<< HEAD

/** Top-k facility chunks for native Fast Top-3 RAG (replaces Dify knowledge retrieval). */
export function buildFacilityRetrievalContext(query, inputs, topK = 3) {
  const requestedTown = inferRequestedTown(query, inputs)
  const requestedCareType = inferRequestedCareType(query, inputs)
  const budget = parseBudget(inputs)

  const ranked = MASSACHUSETTS_FACILITIES.map((facility) => ({
    facility,
    score: scoreFacility(facility, requestedTown, requestedCareType, budget),
  }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(1, topK))
    .map(({ facility }) => formatFacilityContextChunk(facility))

  return ranked.join('\n\n')
}

function rankTopFacilities(query, inputs, limit = 3) {
  const requestedTown = inferRequestedTown(query, inputs)
  const requestedCareType = inferRequestedCareType(query, inputs)
  const budget = parseBudget(inputs)

  const ranked = MASSACHUSETTS_FACILITIES.map((facility) => ({
    facility,
    score: scoreFacility(facility, requestedTown, requestedCareType, budget),
  })).sort((a, b) => b.score - a.score)

  const filtered = ranked.filter(({ facility }) => {
    if (!requestedTown) return facility.careTypes.includes(requestedCareType)
    return facility.town === requestedTown.town || facility.careTypes.includes(requestedCareType)
  })

  const base = (filtered.length > 0 ? filtered : ranked); const seen = new Set(base.map(({ facility }) => facility.name)); const fill = ranked.filter(({ facility }) => !seen.has(facility.name)).slice(0, Math.max(0, limit - base.length)); const picks = base.concat(fill).slice(0, limit)
  return { picks: picks.map(({ facility }) => facility), requestedTown, requestedCareType, budget }
}

function formatTop3MatchLine(facility, index, requestedTown, requestedCareType, budget) {
  const townLabel = formatTownLabel(facility.town)
  const memoryCare = facility.careTypes.includes('Memory Care') ? 'Yes' : 'No'
  const reason = buildReason(facility, requestedTown, requestedCareType, budget) || 'strong overall fit'
  const whyWords = reason.split(/\s+/).slice(0, 12).join(' ')
  return `${index + 1}) ${facility.name} — ${townLabel}\n   - Memory care: ${memoryCare}\n   - Why: ${whyWords}`
}

/** True when the assistant body includes at least one numbered facility row (1) …). */
export function replyIncludesTop3Matches(text) {
  return /(?:^|\n)\s*\d+\)\s+\S/m.test(String(text || ''))
}

/** Client/server-safe full native top-3 reply (prefix + instant retrieval lines). */
export function buildCompleteNativeTop3Reply(query, inputs) {
  const location = String(inputs?.Location || inputs?.location || '').trim()
  const prefix = buildFastTop3AnswerPrefix({
    location,
    monthlyBudget: inputs?.monthly_budget,
    howUrgent: inputs?.how_urgent,
  })
  const lines = buildInstantTop3MatchLines(query, inputs)
  if (lines.length === 0) {
    return buildLocalFacilityChatFallback(query, inputs)
  }
  return `${prefix}${lines.join('\n\n')}`
}

/** One SSE chunk per facility — stream immediately without waiting on OpenAI. */
export function buildInstantTop3MatchLines(query, inputs) {
  const { picks, requestedTown, requestedCareType, budget } = rankTopFacilities(query, inputs, 3)
  if (picks.length === 0) return []
  return picks.map((facility, index) =>
    formatTop3MatchLine(facility, index, requestedTown, requestedCareType, budget)
  )
}
function scoreFacility(facility, requestedTown, requestedCareType, budget) {
  let score = facility.rating * 10

  if (requestedTown && facility.town === requestedTown.town) score += 40
  if (facility.careTypes.includes(requestedCareType)) score += 25
  if (budget != null && budget >= facility.monthlyMin && budget <= facility.monthlyMax) score += 15
  if (budget != null) {
    const midpoint = (facility.monthlyMin + facility.monthlyMax) / 2
    score -= Math.min(Math.abs(midpoint - budget) / 250, 15)
  }
  if (facility.complianceRating === 'Excellent') score += 8
  if (facility.complianceRating === 'Good') score += 4

  return score
}

function buildReason(facility, requestedTown, requestedCareType, budget) {
  const parts = []

  if (requestedTown && facility.town === requestedTown.town) {
    parts.push(`in ${requestedTown.townLabel}`)
  }
  if (facility.careTypes.includes(requestedCareType)) {
    parts.push(`${requestedCareType.toLowerCase()} available`)
  }
  if (budget != null && budget >= facility.monthlyMin && budget <= facility.monthlyMax) {
    parts.push(`fits about $${budget.toLocaleString()}/mo`)
  }
  if (facility.complianceRating === 'Excellent') {
    parts.push('excellent compliance')
  } else if (facility.complianceRating === 'Good') {
    parts.push('good compliance')
  }

  return parts.slice(0, 3).join(', ')
}

export const MAX_WIZARD_FACILITY_MATCHES = 3;

function stripAssistantPlainText(text) {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\r/g, "");
}

function lookupFacilityByName(name) {
  const needle = String(name || "").trim().toLowerCase();
  if (!needle) return null;
  return (
    MASSACHUSETTS_FACILITIES.find((facility) => facility.name.toLowerCase() === needle) ||
    MASSACHUSETTS_FACILITIES.find(
      (facility) =>
        facility.name.toLowerCase().includes(needle) || needle.includes(facility.name.toLowerCase()),
    ) ||
    null
  );
}

function parseSummaryIntro(text) {
  const plain = stripAssistantPlainText(text).trim();
  const match = plain.match(/^(.+?here are your best options:)/is);
  return match ? match[1].replace(/\s+/g, " ").trim() : "";
}

/** Parse the visible top-3 facility list from a wizard assistant reply. */
export function parseWizardFacilitiesFromReply(text) {
  const plain = stripAssistantPlainText(text);
  const lines = plain
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const facilities = [];
  const seen = new Set();

  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index].match(/^(?:\d+[.)]\s*)?(.+?)\s*[—–-]\s*(.+)$/);
    if (!header) continue;

    const name = header[1].trim();
    const townLabel = header[2].trim();
    if (!name || /^memory care:/i.test(name)) continue;

    const dedupeKey = name.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    let memoryCare = "";
    for (let look = index + 1; look < Math.min(index + 4, lines.length); look += 1) {
      const memoryMatch = lines[look].match(/^memory care:\s*(yes|no|unknown)/i);
      if (memoryMatch) {
        memoryCare = memoryMatch[1];
        break;
      }
      if (/^(?:\d+[.)]\s*)?.+[—–-].+$/.test(lines[look])) break;
    }

    const matched = lookupFacilityByName(name);
    facilities.push({
      name: matched?.name || name,
      slug: matched?.slug || "",
      town: matched?.town || townLabel.toLowerCase().replace(/\s+/g, "-"),
      address: matched?.address || "",
      safetyScore: matched ? facilitySafetyScore(matched) : 0,
      monthlyMin: matched?.monthlyMin || 0,
      monthlyMax: matched?.monthlyMax || 0,
      careTypes:
        matched?.careTypes ||
        (memoryCare.toLowerCase() === "yes" ? ["Memory Care"] : ["Assisted Living"]),
      memoryCare,
    });
  }

  return facilities.slice(0, MAX_WIZARD_FACILITY_MATCHES);
}

function mapFacilitySnapshot(facility) {
  return {
    name: facility.name,
    slug: facility.slug,
    town: facility.town,
    address: facility.address,
    safetyScore: facilitySafetyScore(facility),
    monthlyMin: facility.monthlyMin,
    monthlyMax: facility.monthlyMax,
    careTypes: facility.careTypes,
  };
}

function snapshotFromKbMatch(item) {
  const title = String(item?.title || '').trim()
  const parts = title.split(/\s*[—–-]\s*/)
  const name = parts[0]?.replace(/^\d+[.)]\s*/, '').trim() || title
  const townLabel = parts[1]?.trim() || ''
  const memoryCare = String(item?.memoryCare || '').trim()
  return {
    name,
    slug: '',
    town: townLabel.toLowerCase().replace(/\s+/g, '-'),
    address: '',
    safetyScore: 0,
    monthlyMin: 0,
    monthlyMax: 0,
    careTypes:
      memoryCare.toLowerCase() === 'yes' ? ['Memory Care'] : ['Assisted Living'],
    memoryCare,
    why: item?.why || '',
  }
}

export function buildWizardSearchSnapshot({
  zipCode,
  careType,
  monthlyBudget,
  location,
  replyText = "",
  kbFacilities = [],
  urgency = "",
}) {
  const inputs = {
    Location: location,
    zip_code: zipCode,
    care_type: careType,
    monthly_budget: monthlyBudget,
    how_urgent: urgency,
  };
  const query = `assisted living in ${location}`;
  const parsedFacilities = parseWizardFacilitiesFromReply(replyText);
  const careTypeLabel =
    careType === "memory"
      ? "Memory care"
      : careType === "skilled"
        ? "Skilled nursing"
        : "Assisted living";
  const facilities =
    Array.isArray(kbFacilities) && kbFacilities.length > 0
      ? kbFacilities.map(snapshotFromKbMatch)
      : parsedFacilities;
  const summaryIntro = parseSummaryIntro(replyText);

  return {
    kind: "wizard_search",
    zip: zipCode,
    careType,
    careTypeLabel,
    location,
    monthlyBudget,
    urgency,
    summaryIntro,
    facilities,
  };
}

export function buildLocalFacilityChatFallback(query, inputs) {
  const { picks, requestedTown, requestedCareType, budget } = rankTopFacilities(query, inputs, 3)
  if (picks.length === 0) return ''

  const intro = requestedTown
    ? `Here are the best Assistedly matches I can show right now for ${requestedTown.townLabel}, Massachusetts:`
    : 'Here are the strongest Assistedly matches I can show right now across Massachusetts:'

  const lines = picks.map((facility, index) => {
    const townLabel = formatTownLabel(facility.town)
    const memoryCare = facility.careTypes.includes('Memory Care') ? 'Yes' : 'No'
    const reason = buildReason(facility, requestedTown, requestedCareType, budget)
    return `${index + 1}. ${facility.name} — ${townLabel}. Memory care: ${memoryCare}. Why: ${reason || 'strong overall fit'}.`
  })

  return `${intro}\n\n${lines.join('\n')}`
}
=======
>>>>>>> origin/main
