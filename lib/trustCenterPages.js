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
    title: "Privacy & Security",
    description:
      "How Assistedly.ai keeps your family’s information private, secure, and out of the wrong hands—including AI vendors.",
    sections: [
      {
        heading: "We scrub personal details before AI ever sees them",
        body: [
          "When you type a question into our assistant, we automatically remove sensitive details like Social Security numbers, phone numbers, emails, credit cards, addresses, and even names before sending your question to any AI model.",
          "Think of it like a digital privacy filter: your raw question goes in, but the AI only receives a cleaned-up version with personal details replaced by a placeholder like [REDACTED-EMAIL].",
          "This protects you from accidentally exposing family information to third-party AI companies.",
        ],
      },
      {
        heading: "We ask AI vendors to forget your questions immediately",
        body: [
          "Every time we send a request to an AI partner—whether it is OpenAI, Dify, or our own on-premise system—we attach a special signal that says: 'Do not keep this. Do not train on it. Delete it after answering.'",
          "This is called Zero Data Retention. It means the AI company is contractually and technically instructed to treat your question as a one-time conversation, not a data point they can store or reuse.",
        ],
      },
      {
        heading: "We lock down who can see what",
        body: [
          "Not everyone on our platform gets the same access. We use role-based permissions, which means a casual visitor, a logged-in family member, and a facility representative each see only what they are supposed to see.",
          "For example, AI-generated deep-dive reports about specific care needs are only available to users with the right permission level. This prevents sensitive care insights from being exposed to unauthorized viewers.",
        ],
      },
      {
        heading: "We encrypt sensitive records like a bank vault",
        body: [
          "For our Massachusetts platform, any personal or health-related information stored in our database is encrypted using AES-256-GCM—the same encryption standard used by banks and the U.S. government.",
          "Each piece of data gets its own unique lock and key, so even if someone gained access to the database, they could not read your information without the specific decryption key.",
        ],
      },
      {
        heading: "We keep an audit trail without keeping your words",
        body: [
          "We log every AI interaction for accountability and security, but we never store the actual text of your question. Instead, we record a one-way digital fingerprint (a hash) and a safe summary.",
          "This lets us investigate issues or verify compliance without ever needing to see what you actually typed. If something goes wrong, we can trace what happened without exposing your family's private details.",
        ],
      },
      {
        heading: "We do not sell your information",
        body: [
          "We do not sell, rent, or trade your email, name, care needs, or search history to facilities, marketers, or data brokers.",
          "If you sign up for a guide, request a comparison, or chat with our assistant, your information stays within Assistedly.ai unless you explicitly choose to share it with a facility.",
        ],
      },
      {
        heading: "Open-source transparency",
        body: [
          "Our privacy and security code is publicly available on GitHub so security researchers, families, and partners can verify our claims.",
          "You can inspect our sanitization rules, audit logging, and data-retention policies at https://github.com/JoshFialkoff/Assistedly.ai/ under the lib/security folder.",
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
