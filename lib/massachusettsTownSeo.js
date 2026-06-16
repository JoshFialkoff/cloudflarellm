import { MASSACHUSETTS_FACILITIES } from "./massachusettsFacilities";
import { buildFacilityProfile } from "./facilityProfiles";
import { formatTownLabel } from "./massachusettsRouteUtils";

export const MVP_TOWNS = [
  "lexington",
  "winchester",
  "arlington",
  "belmont",
  "burlington",
  "bedford",
  "woburn",
  "reading",
  "wakefield",
  "newton",
  "brookline",
  "needham",
  "wellesley",
  "concord",
];

const PAGE_CONFIG = {
  "best-assisted-living": {
    titlePrefix: "Best assisted living",
    intro:
      "Compare transparency-focused profiles, pricing context, and compliance prompts for families researching assisted living.",
  },
  "memory-care": {
    titlePrefix: "Memory care",
    intro:
      "Understand which local options list memory care support, what safety follow-up questions to ask, and where care intensity differs.",
  },
  costs: {
    titlePrefix: "Assisted living costs",
    intro:
      "Use Assistedly.ai to understand pricing bands, likely add-on fees, and what Massachusetts families should confirm before committing.",
  },
  comparison: {
    titlePrefix: "Assisted living comparison",
    intro:
      "Build a 2-4 facility comparison report, compare compliance and occupancy signals, and generate better tour questions.",
  },
};

function fallbackFacilities(town) {
  const exact = MASSACHUSETTS_FACILITIES.filter((facility) => facility.town === town);
  if (exact.length) return exact.map(buildFacilityProfile);
  return MASSACHUSETTS_FACILITIES.slice(0, 4).map(buildFacilityProfile);
}

export function getTownSeoPage(town, pageType) {
  const config = PAGE_CONFIG[pageType];
  if (!config || !MVP_TOWNS.includes(town)) return null;
  const townLabel = formatTownLabel(town);
  const facilities = fallbackFacilities(town);
  const faqs = [
    {
      question: `How should families compare assisted living in ${townLabel}?`,
      answer:
        "Start with care fit, staffing follow-up questions, occupancy pressure, and recent compliance context before you rely on marketing claims.",
    },
    {
      question: `Does Assistedly.ai provide medical advice for ${townLabel} families?`,
      answer:
        "No. Assistedly.ai provides research and decision-support guidance only. Families should confirm care plans directly with clinicians and facilities.",
    },
    {
      question: `What should I ask on a tour in ${townLabel}?`,
      answer:
        "Ask about staffing by shift, emergency response, move-out triggers, all-in monthly pricing, and how recent compliance issues were corrected.",
    },
  ];

  return {
    town,
    townLabel,
    pageType,
    config,
    facilities,
    faqs,
    canonicalPath: `/massachusetts/${town}/${pageType}`,
    title: `${config.titlePrefix} in ${townLabel}, MA | Assistedly.ai`,
    description: `${config.intro} Built for Massachusetts families researching ${townLabel}.`,
  };
}
