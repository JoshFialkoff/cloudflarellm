# Nextdoor Outreach Strategy for Assistedly.ai

> **Status**: Compliant operating model validated against Nextdoor Member Agreement, Business Posting Guidelines, and Self-Promotion Policy (August 2026)
> **Platform Risk**: LOW — Nextdoor explicitly welcomes local service businesses in recommendation threads. Personal account promotion is prohibited; Business Page engagement is the sanctioned path.

---

## Executive Summary

Nextdoor is the **highest-trust, lowest-risk platform** in Assistedly.ai's organic outreach mix. Unlike Reddit (antagonistic to commercial content), Quora (aggressive AI detection), or Facebook (fake-account prohibition), Nextdoor has **purpose-built infrastructure for local businesses to respond to neighbor recommendation requests**. Every neighbor is address-verified. Recommendations carry more weight than anonymous reviews. And businesses are *expected* to reply when tagged or when their service category is requested.

**The core mechanic**: Neighbors post "Anyone know a good [service] for [situation]?" → Your Business Page replies with genuinely helpful information → Some neighbors click through, explore, and eventually leave recommendations → Recommendations compound into organic visibility.

**Critical constraint**: Nextdoor's paid "Opportunity Alerts" feature ($99/mo) does **NOT** include senior care, elder care, assisted living, or memory care categories. Eligible categories are limited to auto services, home services (plumbing, HVAC, lawn care), hair salons, pet services, and pressure washing. **Assistedly.ai must use manual monitoring, not automated alerts.**

---

## Part 1: How Nextdoor Works for Local Service Businesses

### 1.1 The Recommendation Ecosystem

Nextdoor's entire value proposition is **verified-neighbor recommendations**. Key stats from Nextdoor's own data:
- Recommendations account for nearly **one-third of all conversations** on Nextdoor.
- Recommendations are from **verified addresses** — not anonymous accounts.
- The more recommendations a business has in a neighborhood, the **higher it ranks** in that neighborhood's Recommendations section.
- Recommendations written on a Business Page, and posts/comments where a business was tagged, display under the **"What neighbors say"** tab on the Business Page.

### 1.2 Personal Account vs. Business Page — The Hard Boundary

Nextdoor's Self-Promotion policy (updated 2024–2025) draws an absolute line:

| Activity | Personal Account | Business Page |
|---|---|---|
| Post promotional content in main feed | ❌ Prohibited | ✅ 2 free posts/month allowed |
| Reply to recommendation requests with your own business | ❌ Prohibited | ✅ Required/sanctioned |
| Send unsolicited DMs to promote services | ❌ Prohibited | ❌ Prohibited (no cold DMs) |
| Reply to DMs/mentions of your business | ❌ Must switch to Business Page | ✅ Allowed |
| Recommend another (unaffiliated) business | ✅ Allowed | N/A |
| Tag your business in a comment | N/A | ✅ Allowed |
| Post expert advice related to your service | N/A | ✅ Explicitly allowed |

**The policy is crystal clear**: "When a neighbor asks for a recommendation (e.g., 'Who is a great plumber?'), you may not reply to recommend your own business. These replies must come from other neighbors **or your business profile**." And: "You should reply from your business account."

**What this means for Assistedly.ai**:
- There is **no "Pat" personal account strategy** on Nextdoor. Pat cannot promote Assistedly.ai from a personal account — this violates Nextdoor's Self-Promotion policy and will trigger automated suppression or account restriction.
- **ALL Assistedly.ai commercial activity must flow through the Business Page.**
- The Business Page is not a workaround — it is the **intended and sanctioned channel**.

### 1.3 Business Posts: The 2-Free-Posts-per-Month Channel

Nextdoor gives every Business Page **2 free posts per month** to the neighborhood newsfeed (within a 2-mile radius of the business, or targeted to specific ZIP codes). Allowed content includes:

- **Informational content** (changed hours, upcoming opportunities)
- **Questions prompting neighbor feedback** ("What senior resources do you wish existed in [town]?")
- **Local events** (caregiver support workshop, senior fair booth)
- **Customer/employee spotlights**
- **Community-engagement questions**
- **Expert advice related to a service you provide** ← *This is the key lever for Assistedly.ai*

**Prohibited in Business Posts**:
- Spam, unsolicited repeated actions
- Negative posts about competitors
- False promises, exaggerated claims, untrue statements
- Templated content with no personalization or original commentary
- Links to third-party deal/classified sites
- Posting a neighbor's information without consent

### 1.4 Opportunity Alerts: NOT Available for Senior Care

Nextdoor's paid Opportunity Alerts ($99/mo) notify businesses when neighbors ask for their service category within a 20-mile radius. **Eligible categories** (as of August 2026):

- Auto services (detailing, repair, body shop)
- Home services (appliance repair, carpentry, carpet cleaning, electrician, handyman, home cleaners, HVAC, interior decoration, junk removal, locksmith, movers, painting, pest control, plumber, pool, roof/window)
- Hair salons, landscaping, pet grooming, pet sitting, pressure washing

**Senior care, elder care, assisted living, memory care, home health, and caregiving are NOT eligible.**

**Implication**: Assistedly.ai cannot rely on push notifications. Monitoring must be manual or semi-automated via external tools (see Part 4).

---

## Part 2: The Assistedly.ai Nextdoor Operating Model

### 2.1 Business Page Identity

| Field | Value |
|---|---|
| **Business Name** | Assistedly |
| **Category** | Business Consultant or Professional Services (NOT "Assisted Living Facility" — positioning as advisor, not facility) |
| **Address** | Real Massachusetts address (ForwardJump office, virtual office, or designated service-area hub). P.O. boxes prohibited. |
| **Service Area** | All of Massachusetts (or prioritized counties: Middlesex, Worcester, Norfolk, Plymouth, Essex, Suffolk, Bristol, Hampden, Hampshire, Berkshire, Barnstable, Dukes, Nantucket, Franklin) |
| **Phone** | Local MA number (not shortcode) |
| **Website** | assistedly.ai |
| **Profile Photo** | Clean, professional logo or team photo — not stock imagery |
| **Cover Photo** | Hyper-local imagery or caregiver-family moment |
| **Bio/Description** | "Massachusetts families use Assistedly to compare assisted living, memory care, and in-home care options — with local inspection data, unbiased guidance, and no referral fees." |

**Why "Business Consultant" instead of health care category?**
- Pro Active Elder Care (Chelmsford, MA) uses "Business Consultant" and thrives.
- It positions Assistedly as an advisor/strategic partner, not a care facility.
- It avoids the expectation that Assistedly *operates* facilities (which it does not).
- It aligns with the actual service: decision-support consulting.

### 2.2 The Human-in-the-Loop Workflow

As with all platforms in the Maggie playbook, **AI drafts, human reviews, human manually posts from the Business Page**.

```
Discovery (manual or alert) → AI drafts reply → Human reviews & personalizes → 
Human switches to Business Page → Human manually posts comment → 
Neighbor engages → If neighbor requests DM, human switches to Business Page → 
Human sends DM from Business Page → If neighbor opts into SMS, Maggie (AI) takes over
```

**Automation prohibition**: Nextdoor explicitly bans "Use of software, devices, scripts, robots... to scrape." No bots, no automated posting, no scheduling tools. Every Business Page comment and DM must be manually sent by a human.

### 2.3 The Maggie / Business Page Handoff

On Nextdoor, the two-layer trust model adapts as follows:

| Layer | Identity | Role | Disclosure |
|---|---|---|---|
| **Public** | Assistedly Business Page | Replies to recommendation requests, posts expert advice | None needed — clearly a business |
| **DM** | Assistedly Business Page | Answers follow-up questions, shares resources | Optional: "We also have an AI assistant, Maggie, who can send you personalized options by text if that's easier." |
| **SMS** | Maggie (AI) | Delivers facility comparisons, inspection reports, cost estimates | **Mandatory first-text disclosure**: "Hi, this is Maggie, an AI assistant with Assistedly..." |

**No personal account (Pat) on Nextdoor for promotion.** A real person may have a personal Nextdoor account for genuine neighborly participation, but they must **never** mention or promote Assistedly.ai from it. Nextdoor's algorithm specifically flags "staff or close friends posting on behalf of a business" as coordinated inauthentic behavior.

---

## Part 3: Real Massachusetts Posts to Monitor & Respond To

Discovery method: Manual monitoring via Google Alerts + periodic native Nextdoor searches. Firecrawl search results identified the following live or recent posts.

### Priority 1: Direct Assisted Living / Memory Care Requests

| # | Location | Post Title / URL | Signal Strength | Notes |
|---|---|---|---|---|
| 1 | **Plymouth, MA** | "Looking for recommendations for best memory care assisted living facility in the area" ([ask-neighbors link](https://nextdoor.com/ask-neighbors/plymouth--ma/looking-for-recommendations-for-best-memory-care-assisted-living-facility-in-the-area--mmb2QdPgzwL7/)) | ⭐⭐⭐⭐⭐ Bottom-funnel | Memory care = highest urgency and value. Active post in Plymouth (pop ~60K, high retiree population). |
| 2 | **Plymouth, MA** | "If you or anyone you know is looking for information on senior care" ([ask-neighbors link](https://nextdoor.com/ask-neighbors/plymouth--ma/if-you-or-anyone-you-know-is-looking-for-information-on-senior-care--SK83j_hJ4YHg/)) | ⭐⭐⭐⭐⭐ Advocacy-style | Someone is proactively sharing senior care info — fertile ground for a knowledgeable Business Page reply. |
| 3 | **Harwich, MA** | "Anybody have a recommendation for a private pay, part time caregiver" ([ask-neighbors link](https://nextdoor.com/ask-neighbors/harwich--ma/shelly-was-so-happy-staying-with-kate--9yXQSDh9mpRq/)) | ⭐⭐⭐⭐ Mid-funnel | Private pay caregiver request on Cape Cod — can pivot to "have you also considered assisted living vs. in-home?" |
| 4 | **Halifax, MA** | Post about nurse looking for part-time home care ([ask-neighbors link](https://nextdoor.com/ask-neighbors/halifax--ma/i-have-been-a-nurse-for-15-years-and-switched-careers-to-an-esthetician--DSp4dhm4ZbDM/)) | ⭐⭐⭐⭐ Professional referral | A nurse seeking home care for Tuesdays/Thursdays — high-trust professional who may advise families. |
| 5 | **Three Rivers, MA** | "Looking for someone to help me enroll my disabled brother in Medicaid... he is in an assisted living facility" ([ask-neighbors link](https://nextdoor.com/ask-neighbors/three-rivers--ma/looking-for-someone-to-help-me-enroll-by-disabled-brother-in-medicaid--X4Jf2SRRNDCT/)) | ⭐⭐⭐⭐ Medicaid complexity | Medicaid enrollment + assisted living = high-complexity case where data-backed guidance shines. |

### Priority 2: Eldercare Adjacent / Community Help

| # | Location | Post Title / URL | Signal Strength | Notes |
|---|---|---|---|---|
| 6 | **Mashpee, MA** | "I have two amazing elderly couple my neighbors for years" ([ask-neighbors link](https://nextdoor.com/ask-neighbors/mashpee--ma/i-have-two-amazing-elderly-couple-my-neighbors-for-years--jw8XGtzH3Bjy/)) | ⭐⭐⭐ Awareness | Elderly neighbors — may not be a direct request but offers community-context reply opportunity. |
| 7 | **Plymouth, MA** | "Hello friends! My husband had a tragic fall... I am in need of a ride to Boston" ([post link](https://nextdoor.com/p/sfMF7GWMbnXn)) | ⭐⭐⭐ Crisis-adjacent | Post-craniotomy, transportation need — not directly assisted living but in the caregiver stress universe. Extreme vulnerability. **Reply only with direct help/resources, not promotion.** |
| 8 | **Hadley, MA** | "Any recommendations for a good estate-clean-out company... nursing home and he is not going back home" ([ask-neighbors link](https://nextdoor.com/ask-neighbors/hadley--ma/any-recommendations-for-a-good-estate-clean-out-company--FWQcWBxjtyPh/)) | ⭐⭐⭐⭐ Transition moment | Estate clean-out + nursing home discharge = family in transition. May be open to facility research. |

### Priority 3: Competitive Intelligence — Existing Elder Care Advisor Pages

| Business | Location | Category | What They Do Well | Gap for Assistedly.ai |
|---|---|---|---|---|
| **Pro Active Elder Care** | Chelmsford, MA | Business Consultant | RN-led, memory loss planning focus, strong neighbor recommendations | Smaller geographic footprint; no AI/data angle; no cost calculator |
| **Nashoba Park Assisted Living** | Ayer, MA | Assisted Living/Adult Care | Facility page with volunteer/VOA branding, photos | Sells their own beds, not unbiased comparison |
| **Chelmsford Crossings** | Chelmsford, MA | Assisted Living/Adult Care | Benchmark community, phone number, address | Same as above — single-facility, not advisory |
| **Help and Care** | (MA service area) | In-Home Care Services | Emphasizes "stay independent in own homes" | No assisted living comparison; no data transparency |

---

## Part 4: Monitoring & Discovery Infrastructure

Since Opportunity Alerts are unavailable for senior care, build a **manual + semi-automated monitoring stack**:

### 4.1 Google Alerts (Free)

Create alerts for each of these keyword clusters, scoped to Massachusetts:

```
"assisted living" "nextdoor" Massachusetts
"memory care" "nextdoor" Massachusetts
"nursing home" "nextdoor" Massachusetts
"senior care" "nextdoor" Massachusetts
"home care" "nextdoor" Massachusetts
"elder care" "nextdoor" Massachusetts
"aging parents" "nextdoor" Massachusetts
"Medicaid" "assisted living" "nextdoor" Massachusetts
```

Set frequency: **As-it-happens** for the first 30 days, then dial to **Daily** once volume is understood.

### 4.2 Native Nextdoor Monitoring (Manual, 10 min/day)

1. **Sign into the Assistedly Business Page** on web (not app — app switching is clunky).
2. **Use the search bar** to search: `assisted living`, `memory care`, `nursing home`, `senior care`, `home care`, `elder care`, `aging parents`, `Medicaid`.
3. **Filter by "Posts"** to see neighbor conversations.
4. **Open each relevant post**, copy the link (Share → Copy Link), and paste into a tracking spreadsheet.
5. **Switch to Business Page** and draft a reply.

### 4.3 MA Towns to Prioritize

Based on retiree population density, assisted living facility count, and Nextdoor activity:

**Tier 1 (Highest Priority)**
- Plymouth (retiree-heavy, large senior population, active Nextdoor)
- Barnstable / Hyannis / Falmouth (Cape Cod retiree belt)
- Worcester (central MA hub, diverse demographics)
- Framingham / Natick / Sudbury (suburban sandwich generation)
- Lexington / Concord / Carlisle (high-income, educated, proactive caregivers)
- Newton / Brookline / Chestnut Hill (affluent, research-oriented)
- Hingham / Cohasset / Scituate (South Shore retiree communities)
- Pittsfield / Lenox / Great Barrington (Berkshires retiree belt)

**Tier 2**
- Springfield / Chicopee (Western MA, cost-sensitive)
- Lowell / Chelmsford / Dracut (Merrimack Valley)
- Lynn / Salem / Peabody (North Shore)
- Taunton / Attleboro / New Bedford (South Coast)

**Tier 3**
- Smaller towns with assisted living facilities but lower Nextdoor volume — still worth monitoring via Google Alerts.

---

## Part 5: Response Frameworks (Structural, Not Templates)

Nextdoor's Business Posting Guidelines explicitly prohibit: "Posting unoriginal/templated content with no personalization or original commentary."

**Therefore, the below are structural frameworks. A human must customize 80%+ of the actual text before posting.**

### Framework A: Direct Recommendation Request Reply

**Trigger**: Neighbor posts "Looking for recommendations for [assisted living / memory care / home care] in [town]."

**Structure**:
1. **Acknowledge the specific situation** (name the town, the person being cared for if mentioned, the urgency level).
2. **Lead with a genuinely free, specific resource** (not a sales pitch). Examples:
   - "The Massachusetts Executive Office of Elder Affairs has a searchable directory of licensed facilities in [county] at mass.gov/elders — you can filter by memory care and see inspection reports."
   - "If you haven't toured [specific local facility name] yet, they have a memory care wing and are [distance] from downtown [town]. I can share their latest state inspection score if helpful."
   - "One thing many families in [town] don't know: MassHealth covers some assisted living costs through the Group Adult Foster Care (GAFC) program. Eligibility depends on income and care needs."
3. **Softly introduce Assistedly** as a secondary option, never the primary:
   - "If you want a side-by-side comparison of facilities within 30 minutes of [town] — with state inspection data, real cost ranges, and no sales pressure — my team at Assistedly helps families with this. No referral fees, no facility kickbacks."
4. **Clear opt-out / low-pressure close**:
   - "Happy to answer any questions here, or you're welcome to message our page directly. No obligation either way — this is a hard process and you deserve real info."
5. **No link in the first comment** (comes across as spammy on Nextdoor). Let the neighbor click the Business Page if curious.

**Red Flag Checklist Before Posting**:
- [ ] Did I name the neighbor's specific town or situation in the first sentence?
- [ ] Did I share a free resource (state data, local facility name, program info) BEFORE mentioning Assistedly?
- [ ] Is the tone neighbor-to-neighbor, not salesperson-to-prospect?
- [ ] Did I avoid superlatives ("best," "#1," "top-rated")?
- [ ] Did I include an opt-out / no-pressure line?
- [ ] Is this comment at least 60% about helping, and at most 40% about Assistedly?
- [ ] Did I verify I am posting from the **Business Page**, not a personal account?

### Framework B: Expert Advice Business Post (2/month)

**Trigger**: Proactive post from the Business Page (not a reply).

**Allowed topics**:
- "3 questions to ask on every assisted living tour in Massachusetts"
- "What the Mass. state inspection report actually tells you (and what it doesn't)"
- "Memory care vs. assisted living: the difference matters more than you think"
- "GAFC, SCO, PACE: Massachusetts programs that can help pay for care"
- "We're tracking 12 new assisted living communities opening in Massachusetts in 2026 — here's what families should know"

**Structure**:
1. **Hook with a specific local stat or story** ("Last month, 3 families in Plymouth reached out confused about memory care waitlists...")
2. **2–3 actionable insights** (no generic advice — cite actual MA programs, actual facilities, actual regulations)
3. **Invite neighbor questions in comments** (not "DM us" — Nextdoor prefers public conversation)
4. **Optional**: "If you want a printable checklist for your next tour, message our page and we'll send it."

**Anti-Spam Guardrails**:
- Never post the same topic twice.
- Never copy-paste from blog posts — rewrite for the neighbor audience.
- Always include a genuine question or invitation for neighbor input.
- Space posts at least 10 days apart.

### Framework C: Follow-Up DM (Only After Neighbor Initiates Contact)

**Trigger**: Neighbor messages the Assistedly Business Page, or explicitly says "DM me" in a public comment.

**Structure**:
1. **Thank them for reaching out** by name.
2. **Ask 1–2 clarifying questions** (not a survey — genuine diagnostic):
   - "Is this for yourself or a parent?"
   - "Are you looking in a specific town or county, or open to a radius?"
   - "Have you toured any facilities yet, or are you just starting?"
3. **Offer immediate value**:
   - "I can send you a list of licensed facilities within 20 minutes of [town] with their latest state inspection scores and real cost ranges."
4. **Introduce Maggie (the AI assistant) honestly**:
   - "I also have an AI assistant, Maggie, who can text you personalized comparisons and answer follow-up questions anytime. She's fast and doesn't sleep. Want me to connect you?"
5. **Clear opt-out**: "Totally up to you — no pressure."

---

## Part 6: Exact Safe First-Response Examples (MA-Specific Scenarios)

> ⚠️ **These are training examples, not copy-paste templates.** Every real response must be rewritten by a human with specific details from the actual post.

### Example 1: Memory Care Request (Plymouth-style)

**Neighbor post**: "Looking for recommendations for best memory care assisted living facility in the Plymouth area. My mom was recently diagnosed with Alzheimer's and we're starting to look at options."

**Business Page reply**:
> Hi [Name] — I'm sorry to hear about your mom's diagnosis. That's a lot to process, and you're doing the right thing by starting the research early. Memory care waitlists in Plymouth County can be 3–6 months for the better-rated facilities, so starting now is smart.
>
> A few free resources that help families in your situation:
> - The state's searchable directory at mass.gov/elders lets you filter Plymouth-area facilities by memory care license and see their latest inspection reports.
> - Whitney Place at Northborough and Allerton House in Hingham both have dedicated memory care programs within 30 minutes of Plymouth. Their inspection histories are publicly available.
> - If your mom is a MassHealth member (or eligible), the GAFC program can offset some assisted living costs — worth checking with a SHINE counselor at 1-800-AGE-INFO.
>
> If you want a side-by-side comparison of all memory care facilities within a 30-minute drive — with real cost ranges, waitlist info, and inspection scores — my team at Assistedly builds those for free. No referral fees, no facility kickbacks. Happy to answer questions here or you can message our page anytime. No pressure at all — this process is hard enough without salespeople breathing down your neck.

**Why this works**:
- Names the town and diagnosis specifically.
- Leads with 3 free resources, 0% promotion.
- Introduces Assistedly softly at the end.
- Includes an opt-out.
- Tone is neighbor-like, not corporate.
- Posts from Business Page (verified, transparent).

### Example 2: Medicaid + Assisted Living Complexity (Three Rivers-style)

**Neighbor post**: "Looking for someone to help me enroll my disabled brother in Medicaid. He is in an assisted living facility in Connecticut and his assets are complicated."

**Business Page reply**:
> Hi [Name] — Medicaid enrollment with assisted living involvement and cross-state assets is genuinely complex. You're not alone in finding this overwhelming.
>
> A few starting points:
> - Connecticut and Massachusetts have different Medicaid rules for assisted living. If you're moving him to MA, he'd need to reapply here under MassHealth, which has different asset limits and a 5-year lookback period.
> - The Mass. Family Caregiver Support Program (1-800-243-4636) has counselors who specifically help families navigating Medicaid + facility transitions.
> - If the facility he's in is out-of-network or private-pay-only, some families use a pooled trust or Miller trust to qualify — an elder law attorney in [County] can advise on this.
>
> If you want a clear breakdown of MassHealth-eligible assisted living facilities in Western Mass — with their Medicaid acceptance status, bed availability, and contact info — we keep that updated at Assistedly. Message our page if it would save you some phone calls. Either way, hope you find a path forward soon.

### Example 3: In-Home Care Request (Harwich-style)

**Neighbor post**: "Anybody have a recommendation for a private pay, part time caregiver who could assist with daily living activities?"

**Business Page reply**:
> Hi [Name] — In-home care on Cape Cod can run $28–$35/hour for private pay, and good caregivers are in high demand. A few angles to consider:
>
> - The Barnstable County ADRC (Aging & Disability Resource Consortium) maintains a vetted caregiver registry: call 508-375-6628.
> - If costs are adding up, some families find that assisted living becomes comparable in price to 40+ hours/week of in-home care — especially when you factor in meals, medication management, and 24/7 supervision.
> - For short-term respite, the Alzheimer's Family Support Center in Brewster offers caregiver relief programs.
>
> If you want to run the numbers — what in-home care costs vs. assisted living in Barnstable County — we have a free calculator that breaks it down by actual local rates. Message our page and we'll send the link. Totally up to you; just want you to have the full picture.

---

## Part 7: Building the Recommendation Flywheel

On Nextdoor, **recommendations from verified neighbors are the primary growth engine**. Here's how to earn them:

### Stage 1: Earn the First 3–5 Recommendations

- Ask **satisfied families** who have used Assistedly.ai to leave a recommendation on the Business Page.
- Nextdoor explicitly allows recommendations from "clients, customers, family, and friends" — not just paying customers.
- The recommendation ask should be: "Would you mind sharing your experience on our Nextdoor page? It helps other Massachusetts families find unbiased help."
- Do NOT incentivize reviews (gift cards, discounts) — Nextdoor discourages this and neighbors distrust it.

### Stage 2: Be Tagged in Organic Conversations

- When you help a family, and they later see a neighbor asking for assisted living advice, they may tag `@Assistedly` in their reply.
- When tagged, **reply promptly from the Business Page** to thank them and offer additional help.
- Tagged posts show up on your Business Page under "What neighbors say."

### Stage 3: Rank in Neighborhood Recommendations

- The more recommendations you have in a specific neighborhood, the higher you rank in that neighborhood's "Recommendations" section.
- Target neighborhoods with high retiree populations first: Plymouth neighborhoods, Cape Cod towns, Lexington/Concord suburbs, etc.

---

## Part 8: Success Metrics

| Metric | Target | How to Track |
|---|---|---|
| Business Page recommendations | 10+ in first 90 days | Native Nextdoor dashboard |
| Replies to recommendation requests | 2–4 per week | Manual log |
| Reply-to-engagement rate | 25%+ (neighbor likes, comments, or DMs after our reply) | Manual log |
| DM conversations initiated from replies | 10+ per month | Nextdoor Business Page inbox |
| SMS opt-ins from Nextdoor DMs | 5+ per month | PostHog custom event: `nextdoor_dm_opt_in` |
| Business Post engagement (likes + comments) | 5+ per post | Native Nextdoor dashboard |
| Negative feedback / reports | 0 | Native Nextdoor dashboard + manual monitoring |

---

## Part 9: Risk Mitigation & Compliance Checklist

### Nextdoor-Specific Rules

| Rule | Source | How We Comply |
|---|---|---|
| No personal account self-promotion | Self-Promotion Policy | All promotion flows through Business Page exclusively |
| No cold DMs | Business Posting Guidelines | DMs only sent from Business Page, and only after neighbor initiates contact or explicitly requests it |
| No templated content | Business Posting Guidelines | Every comment/post is 80%+ human-customized; AI drafts only |
| No automated posting/scraping | Member Agreement | All posts are manual; no bots, scripts, or schedulers |
| Real business name required | Business Page Policy | "Assistedly" matches real-world brand |
| Real address required | Business Page Policy | Real MA address; P.O. box prohibited |
| No exaggerated claims | Business Posting Guidelines | No "best," "#1," "guaranteed"; cite actual state data |
| No competitor bashing | Business Posting Guidelines | Never mention competitors negatively; focus on what Assistedly offers |
| No false promises | Business Posting Guidelines | Transparent about what is free (comparisons, data) vs. what costs (placement fees, if any) |

### Ban Triggers to Avoid

- ❌ Posting promotional content from a personal account (automated suppression + possible restriction)
- ❌ Sending unsolicited DMs to neighbors who haven't engaged (reported as spam)
- ❌ Copy-pasting the same comment to multiple posts (flagged as templated content)
- ❌ Using a fake address or P.O. box (Business Page removal)
- ❌ Family/staff posting on behalf of the business from personal accounts (treated as coordinated inauthentic behavior)
- ❌ Posting more than 2 Business Posts per month (overage may be blocked or require paid tier)

---

## Part 10: Week-by-Week Launch Plan

### Week 1: Foundation
- [ ] Claim Nextdoor Business Page for "Assistedly"
- [ ] Select category: "Business Consultant" or "Professional Services"
- [ ] Enter real MA address and service area (all of Massachusetts)
- [ ] Upload profile photo (logo) and cover photo
- [ ] Write bio emphasizing "Massachusetts families," "unbiased," "state inspection data," "no referral fees"
- [ ] Add website (assistedly.ai) and local phone number
- [ ] Verify Business Page (follow Nextdoor's verification prompts)

### Week 2: First Value Post
- [ ] Draft and post first Business Post: expert advice topic (see Framework B)
- [ ] Monitor Google Alerts for new MA Nextdoor posts
- [ ] Begin manual search on Nextdoor for active assisted living conversations
- [ ] Log all discovered posts in tracking spreadsheet

### Week 3: First Reply
- [ ] Identify 1–2 active recommendation request posts in MA
- [ ] AI drafts reply → Human reviews → Human posts from Business Page
- [ ] Track engagement (likes, comments, DMs)
- [ ] Post second Business Post

### Week 4: Optimization
- [ ] Review first month's engagement data
- [ ] Adjust reply tone/frameworks based on what resonated
- [ ] Ask first satisfied family for a Nextdoor recommendation
- [ ] Document learnings for scaling

### Month 2–3: Scale
- [ ] Maintain 2 Business Posts per month
- [ ] Reply to 2–4 recommendation requests per week
- [ ] Build to 5+ Business Page recommendations
- [ ] Track SMS opt-ins via PostHog custom event
- [ ] Expand monitoring to Tier 2 towns

---

## Part 11: Comparison to Other Platforms

| Dimension | Nextdoor | Reddit | Quora | Facebook Groups |
|---|---|---|---|---|
| **Trust level** | Very high (verified address) | Low–Medium (anonymous) | Medium (real name culture) | Medium (real names, private groups) |
| **Commercial hostility** | Low (welcomes Business Pages) | High (antagonistic to brands) | Medium (removes AI content) | Medium (organic only, no ads in groups) |
| **Organic reach for replies** | High (hyperlocal, newsfeed) | Medium (algorithm buries new accounts) | Low (answer ranking is competitive) | High (group members see all posts) |
| **Automation detection** | Strict (manual only) | Very strict (karma + history checks) | Very strict (AI moderation) | Strict (fake account detection) |
| **Scalability** | Limited by geography | High (subreddits are national) | Medium (questions are national) | Low (per-group manual work) |
| **Best for Assistedly.ai** | Bottom-funnel local families | Top-of-funnel research mode | Research + SEO | Community trust-building |
| **Risk of ban** | Low (if Business Page rules followed) | High (if self-promotion detected) | Medium (if AI-detected) | Medium (if fake account or spam) |

**Strategic positioning**: Nextdoor is where families go when they need help *now* ("My mom fell and I need options this week"). Reddit is where they go when they're researching ("What should I know about assisted living?"). Quora is where they go for general knowledge. Facebook Groups are where they go for peer support.

Nextdoor should be the **highest-priority, lowest-volume platform** — fewer posts, but each one is a warm lead from a verified neighbor in crisis.

---

## Appendix A: Real Nextdoor Posts Summary (As of August 2026)

| Post | Town | Type | URL | Status |
|---|---|---|---|---|
| Memory care ALF recommendations | Plymouth, MA | Ask Neighbors | [link](https://nextdoor.com/ask-neighbors/plymouth--ma/looking-for-recommendations-for-best-memory-care-assisted-living-facility-in-the-area--mmb2QdPgzwL7/) | Active — Priority 1 |
| Senior care info share | Plymouth, MA | Ask Neighbors | [link](https://nextdoor.com/ask-neighbors/plymouth--ma/if-you-or-anyone-you-know-is-looking-for-information-on-senior-care--SK83j_hJ4YHg/) | Active — Priority 1 |
| Private pay caregiver | Harwich, MA | Ask Neighbors | [link](https://nextdoor.com/ask-neighbors/harwich--ma/shelly-was-so-happy-staying-with-kate--9yXQSDh9mpRq/) | Active — Priority 1 |
| Nurse seeking home care | Halifax, MA | Ask Neighbors | [link](https://nextdoor.com/ask-neighbors/halifax--ma/i-have-been-a-nurse-for-15-years-and-switched-careers-to-an-esthetician--DSp4dhm4ZbDM/) | Active — Priority 2 |
| Medicaid + ALF enrollment | Three Rivers, MA | Ask Neighbors | [link](https://nextdoor.com/ask-neighbors/three-rivers--ma/looking-for-someone-to-help-me-enroll-by-disabled-brother-in-medicaid--X4Jf2SRRNDCT/) | Active — Priority 2 |
| Elderly neighbors appreciation | Mashpee, MA | Community | [link](https://nextdoor.com/ask-neighbors/mashpee--ma/i-have-two-amazing-elderly-couple-my-neighbors-for-years--jw8XGtzH3Bjy/) | Active — Context only |
| Estate clean-out + nursing home | Hadley, MA | Ask Neighbors | [link](https://nextdoor.com/ask-neighbors/hadley--ma/any-recommendations-for-a-good-estate-clean-out-company--FWQcWBxjtyPh/) | Active — Priority 2 |
| Elder care advisor recommendation | Sheffield, MA | Ask Neighbors | [link](https://nextdoor.com/ask-neighbors/sheffield--ma/i-highly-recommend-paula-almgren-in-lenox--FLp57rRxgSt_/) | Active — Competitive intel |

---

## Appendix B: Nextdoor Policy Sources

| Document | URL | Key Finding |
|---|---|---|
| Self-Promotion using Personal Account | [help.nextdoor.com](https://help.nextdoor.com/s/article/Self-Promotion-using-your-Personal-Account) | Must reply from Business Page; no personal account promotion |
| Business Posting Guidelines | [help.nextdoor.com](https://help.nextdoor.com/s/article/Business-posting-guidelines) | 2 free posts/month; expert advice allowed; no templated content |
| Business Page Policy | [help.nextdoor.com](https://help.nextdoor.com/s/article/Business-posting-guidelines) | Real name and real address required; P.O. boxes prohibited |
| Reply as a Business | [help.nextdoor.com](https://help.nextdoor.com/s/article/Reply-to-a-neighbor-post-as-a-business) | Business Pages can reply to posts where their service is requested |
| Opportunity Alerts Eligibility | [help.nextdoor.com](https://help.nextdoor.com/s/article/Am-I-eligible-for-Opportunity-Alerts) | Senior care NOT in eligible categories |
| Recommendations FAQ | [help.nextdoor.com](https://help.nextdoor.com/s/article/About-Recommendations) | Recs from verified neighbors; businesses can reply to recs |
| Member Agreement | [legal.nextdoor.com](https://legal.nextdoor.com/us-member-agreement-2021/) | Scraping, bots, impersonation prohibited |

---

*Document version: 1.0 — August 11, 2026*
*Next review: After 30 days of active Business Page operation*
