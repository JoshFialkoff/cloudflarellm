# Partner One-Pager: Assistedly Care-Transition Pilot

> Print-ready / digital PDF source | 8.5" × 11" single page
> Customizable per partner: replace {{PARTNER}} and {{PARTNER_SHORT}} fields

---

## Page Layout (Visual Description)

**Top:** Dual logo header — {{PARTNER_SHORT}} logo (left) + Assistedly.ai logo (right) with small "in partnership with" connector

**Body:** Two-column layout, 60/40 split

---

## [LEFT COLUMN — 60%]

### Headline
**When families ask "what comes next," give them an independent answer.**

### Subhead
{{PARTNER}} helps families support independent living. 
Assistedly gives those families an **independent way to understand care options** when staying at home is getting harder.

---

### The Problem
Families using {{PARTNER}}'s product eventually face a question: **what comes next?**

Most companies have no answer. Families either:
- Search alone and find commission-driven referral sites
- Wait until a crisis forces a rushed decision
- Never get the information they need to plan

The result: worse outcomes, lower satisfaction, and a missed moment to deepen the customer relationship.

---

### The Solution: Assistedly's Independent Care-Transition Layer

Assistedly adds an **independent care-navigation experience** to {{PARTNER}}'s customer journey — without the complexity of an API integration.

**How it works (3 steps):**

| Step | What Happens |
|---|---|
| **1. Insert the link** | {{PARTNER}} adds a co-branded link at a natural customer moment — annual review email, wellness check, or support workflow |
| **2. Family completes assessment** | A short, source-linked evaluation of current needs, living situation, and priorities |
| **3. Receive care snapshot** | A personalized, transparent summary with clear next steps. Families choose what to do. |

---

### Why Independence Matters

- Assistedly **does not** choose or rank facilities on behalf of partners
- Families see **state-verified data** (licensing, inspections, staffing ratios)
- Any fee Assistedly earns comes from participating communities **only if a family chooses to move in**
- {{PARTNER}} gets **measurable insight** into the transition journey without handling sensitive data

---

## [RIGHT COLUMN — 40%]

### Partner Benefits (in order)

**1. Better support at a difficult customer moment**
When families need guidance most, {{PARTNER}} offers a trusted next step — not a dead end.

**2. Continued relevance as needs evolve**
Your product serves independent living. As needs change, you stay relevant by providing independent guidance.

**3. Potential new revenue stream**
Subject to legal review and pilot results. Transparent terms, no percentage of resident rent.

---

### Pilot Structure

| | |
|---|---|
| **Duration** | 90 days |
| **Partner** | {{PARTNER}} |
| **Channel** | One customer communication channel (email, portal, or call-center) |
| **Geography** | Massachusetts (where Assistedly has coverage + legal review) |
| **Metrics** | Reach, consent rate, assessment completion, qualified conversations, satisfaction |
| **Commitment** | Minimal: insert a link + share aggregate reporting |

---

### What Partners Say (when available — do not fabricate)

> *"Quote from pilot partner about customer response and experience value."*
> — Name, Title, Company**

---

### Contact

**Josh Fialkoff, Founder**
Assistedly.ai — The Senior-Care Trust Layer
josh@assistedly.ai | https://assistedly.ai/partners

---

**[FOOTER — Full width, small text]**

_Assistedly.ai is not a placement agency. We do not sell lead lists or preferential rankings. Any commercial relationship is disclosed to families at the point of recommendation. Pilot terms subject to legal review in each jurisdiction._

---

## Design Notes for PDF Conversion

- **Colors:** Use partner accent color for top bar and CTA. Assistedly primary (#4a7c7e) for trust badges and checkmarks.
- **Fonts:** System sans-serif stack (matches Assistedly.ai site)
- **White space:** Generous. Avoid dense text blocks.
- **Icons:** Simple outline icons for the 3-step process and benefit list
- **Print:** Ensure all text is 10pt+ for readability

## Conversion Command

```bash
# Using pandoc (install via brew)
pandoc partner-one-pager.md -o partner-one-pager.pdf \
  --pdf-engine=xelatex \
  -V geometry:margin=0.75in \
  -V mainfont="Helvetica" \
  -V fontsize=10pt \
  --include-in-header=partner-one-pager-header.tex
```

Or: paste Markdown into Google Docs, apply formatting, export as PDF.
