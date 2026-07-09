import { buildFastTop3AnswerPrefix } from './fastTop3WorkflowConfig'
import { facilitySafetyScore } from './facilityTrust'
import { MASSACHUSETTS_FACILITIES } from './massachusettsFacilities'
import { formatTownLabel } from './massachusettsRouteUtils'

const TOWN_INDEX = MASSACHUSETTS_FACILITIES.map((facility) => ({
  town: facility.town,
  townLabel: formatTownLabel(facility.town),
}))

function parseBudget(inputs) {
  const raw = String(inputs?.monthly_budget_raw || inputs?.monthly_budget || '').replace(/[^\d]/g, '')
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function inferRequestedCareType(query, inputs) {
  const explicit = String(inputs?.care_type || '').trim().toLowerCase()
  if (explicit === 'memory') return 'Memory Care'
  if (explicit === 'skilled') return 'Skilled Nursing'
  if (explicit === 'assisted') return 'Assisted Living'

  const q = String(query || '').toLowerCase()
  if (/\b(memory|dementia|alzheim)/.test(q)) return 'Memory Care'
  if (/\b(skilled|nursing|wheelchair|rehab)/.test(q)) return 'Skilled Nursing'
  if (/\b(independent)\b/.test(q)) return 'Independent Living'
  return 'Assisted Living'
}

function inferRequestedTown(query, inputs) {
  const locationText = String(inputs?.Location || inputs?.location || '').trim()
  const haystack = `${locationText} ${String(query || '')}`.toLowerCase()

  const match = TOWN_INDEX.find(({ town, townLabel }) => {
    return haystack.includes(town) || haystack.includes(townLabel.toLowerCase())
  })
  if (match) return match

  const zipMatch = haystack.match(/\b(\d{5})\b/)
  if (zipMatch) {
    return { town: zipMatch[1], townLabel: `ZIP ${zipMatch[1]}` }
  }

  return null
}

function formatFacilityContextChunk(facility) {
  const townLabel = formatTownLabel(facility.town)
  const memoryCare = facility.careTypes.includes('Memory Care') ? 'Yes' : 'No'
  const careTypes = facility.careTypes.join(', ')
  const about = String(facility.about || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  return [
    `[${facility.name}]`,
    `Town: ${townLabel} | Care: ${careTypes} | Memory care: ${memoryCare}`,
    `Rating: ${facility.rating} | Compliance: ${facility.complianceRating || 'Unknown'}`,
    `Monthly: $${facility.monthlyMin}-$${facility.monthlyMax}`,
    about ? `About: ${about}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

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
  let name = parts[0]?.replace(/^\d+[.)]\s*/, '').trim() || title
  // Remove PDF filename patterns (e.g., "PDF v. 9-18-2024_LR")
  name = name.replace(/\s*PDF\s+v\.\s*[\d\-]+_LR.*$/gi, '').trim()
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
