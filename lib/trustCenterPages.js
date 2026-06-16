const TRUST_CENTER_PAGES = {
  "how-we-work": {
    title: "How Assistedly.ai works",
    description:
      "See how Assistedly.ai organizes Massachusetts public data, family inputs, and AI explanations without selling placements.",
    sections: [
      {
        heading: "What we do",
        body: [
          "Assistedly.ai acts like a consumer research layer for Massachusetts assisted living decisions.",
          "We organize public data, explain what it means in plain English, and help families compare trade-offs before they tour.",
        ],
      },
      {
        heading: "What we do not do",
        body: [
          "We are not a healthcare provider, referral agency, or facility marketplace.",
          "We do not sell preferred placement in rankings or hide who pays us.",
        ],
      },
    ],
  },
  "how-we-make-money": {
    title: "How Assistedly.ai makes money",
    description:
      "Transparent revenue model for Assistedly.ai: premium consumer memberships and guided decision support.",
    sections: [
      {
        heading: "Primary revenue",
        body: [
          "The MVP focuses on premium consumer memberships for detailed reports, advanced comparisons, and saved facility lists.",
          "We also offer guided decision-support packages for families who want a more hands-on comparison and move-planning workflow.",
        ],
      },
      {
        heading: "What we do not sell",
        body: [
          "We do not sell placements, referral leads, or paid ranking slots to facilities.",
          "If our revenue model changes, this page will be updated before the change goes live.",
        ],
      },
    ],
  },
  methodology: {
    title: "Methodology",
    description:
      "Understand how Assistedly.ai summarizes pricing, staffing, occupancy, and compliance signals for Massachusetts families.",
    sections: [
      {
        heading: "Data synthesis",
        body: [
          "We combine Massachusetts public records, facility profile details, and Assistedly.ai trust heuristics to surface what families should ask next.",
          "Scores are directional prompts, not guarantees or medical recommendations.",
        ],
      },
      {
        heading: "Human interpretation",
        body: [
          "Every AI explanation is meant to translate public data into a faster decision-support workflow.",
          "Families should always confirm current staffing, pricing, availability, and licensure directly with each operator.",
        ],
      },
    ],
  },
  "data-sources": {
    title: "Data sources",
    description:
      "Assistedly.ai relies on Massachusetts public data, facility-provided profile information, and family research inputs.",
    sections: [
      {
        heading: "Public data first",
        body: [
          "The MVP uses Massachusetts public compliance and care context wherever possible.",
          "When information comes from a facility or family workflow, we label it as profile context instead of verified state data.",
        ],
      },
      {
        heading: "Limits",
        body: [
          "Public records can lag real-world operations. We encourage families to use Assistedly.ai as a research accelerator, not a substitute for direct verification.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy",
    description:
      "How Assistedly.ai handles lead capture, magic-link authentication, analytics, and research interactions for the MVP.",
    sections: [
      {
        heading: "What we collect",
        body: [
          "The MVP may collect email, name, town, care need, and comparison activity when a family asks for a guide, signs in, or requests help.",
          "We also use analytics tools such as PostHog, GTM, and optional GA4 to understand registrations, AI usage, and conversions.",
        ],
      },
      {
        heading: "How we use it",
        body: [
          "We use this information to send requested resources, improve the product, and understand which research tools families use most.",
          "We do not sell family data as lead inventory.",
        ],
      },
    ],
  },
  "editorial-policy": {
    title: "Editorial policy",
    description:
      "Assistedly.ai publishes research-driven facility guidance with transparency, source labeling, and plain-English explanations.",
    sections: [
      {
        heading: "Editorial standards",
        body: [
          "We prioritize clarity, source labeling, and transparent limitations over promotional language.",
          "When data is incomplete or uncertain, we say so plainly.",
        ],
      },
      {
        heading: "AI guardrails",
        body: [
          "AI outputs are edited for consumer understanding, not medical or legal advice.",
          "Families should use the product to generate better questions, not to replace clinicians or elder law professionals.",
        ],
      },
    ],
  },
};

module.exports = {
  TRUST_CENTER_PAGES,
};
