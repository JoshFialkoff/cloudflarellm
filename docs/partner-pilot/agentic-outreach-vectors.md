# Agentic Outreach Vectors — Partner Target Companies

> Reconnaissance date: 2026-08-21 | Method: Live site scraping, widget fingerprinting, form endpoint analysis

---

## Summary: Companies Ranked by Agentic Contactability

| Rank | Company | Primary Chat Platform | Form Automation | Other Vectors | Agentic Score |
|---|---|---|---|---|---|
| 1 | **GoGoGrandparent** | Crisp (ID: `b3c3ceb9-78c2-4e48-b2b8-24bdb0ead741`) | Webflow subscription form | Partnership page, affiliate via Impact.com, email subscription | **★★★★★** |
| 2 | **Hero Health** | Intercom (23 refs) | Likely HubSpot/Typeform | Modern tech stack, likely API-first | **★★★★☆** |
| 3 | **Aloe Care Health** | Zendesk + Webflow form | Webflow contact form (Name/Email/Phone/Message) | Partner page links, support portal | **★★★★☆** |
| 4 | **Medical Guardian** | Olark + Crisp | Custom WordPress/Divi forms | CSRF-protected but scriptable, "request brochure" flow | **★★★☆☆** |
| 5 | **Bay Alarm Medical** | Crisp | WordPress/Divi forms | Partner page exists, Google review widget | **★★★☆☆** |
| 6 | **UnaliWear** | Zoho SalesIQ + Crisp | Unknown | Smaller site, likely simple forms | **★★★☆☆** |
| 7 | **Papa** | None detected (app-first) | Unknown | "Partner" page content heavy, likely B2B outreach via Salesforce | **★★☆☆☆** |
| 8 | **MobileHelp** | None detected | Likely simple forms | ADT ecosystem — may route through ADT corporate | **★★☆☆☆** |
| 9 | **SafelyYou** | None detected | Unknown | B2B sales-heavy, likely Salesforce + sales dev | **★★☆☆☆** |
| 10 | **Honor Technology** | None detected | Unknown | Large corporate — likely Salesforce, heavy procurement | **★☆☆☆☆** |

---

## Detailed Agentic Vectors

### 1. GoGoGrandparent — ⭐ Highest Agentic Potential

**Website:** gogograndparent.com

**Confirmed Chat Infrastructure:**
- **Crisp** chat widget with exposed `CRISP_WEBSITE_ID = "b3c3ceb9-78c2-4e48-b2b8-24bdb0ead741"`
- Crisp visitors can send messages via WebSocket after initializing `$crisp` with the website ID
- Chat is JavaScript-driven, no CAPTCHA on widget load

**Automation Approaches:**

**A. Crisp Chat Automation (Headless Browser)**
```javascript
// Puppeteer/Playwright approach
await page.goto('https://gogograndparent.com');
await page.evaluate(() => {
  window.CRISP_READY_TRIGGER = function() {
    window.$crisp.push(["do", "chat:open"]);
    window.$crisp.push(["do", "message:send", ["text", 
      "Hi, I'm reaching out from Assistedly.ai about a potential partnership..."]]);
  };
});
```

**B. Email Subscription Form**
- Webflow form: `id="subscribeEmailForm"`
- Endpoint: Webflow form handler (POST to current page)
- Fields: `subscribeEmail` (email only)
- Can be automated with proper `data-wf-page-id` and `data-wf-element-id`

**C. Direct Partnership Path**
- `/for-business/select-industry` — industry selector
- `/for-business/senior-living` — senior living partnerships
- `/for-business/health-care` — healthcare partnerships
- Affiliate program via Impact.com (`impact.com/campaign-campaign-info-v2/GoGoGrandparent.brand`)
- Email: hidden behind Cloudflare protection (`[email&#160;protected]`)

**D. Phone**
- `1 (855) 464-6872` — visible in nav

**Recommendations:**
- Use Crisp chat via headless browser for initial outreach
- Use Impact.com affiliate program as secondary "warm" entry
- Phone call as highest-touch path

---

### 2. Hero Health — ⭐ Strong Agentic Potential

**Website:** herohealth.com

**Confirmed Chat Infrastructure:**
- **Intercom** (23 references on homepage alone)
- Highly integrated — Intercom Messenger likely configured for sales/support

**Automation Approaches:**

**A. Intercom Messenger Automation (Headless Browser)**
```javascript
// Intercom can be triggered via window.Intercom API
await page.evaluate(() => {
  Intercom('showNewMessage', 'Hello from Assistedly.ai — we help families navigate care transitions and would love to explore a partnership.');
});
```

**B. Modern Tech Stack Inference**
- 23 Intercom references suggests heavy investment in conversational UX
- Likely has a "Talk to Sales" or "Request Demo" flow via Intercom
- Probably has HubSpot or Salesforce integration behind Intercom

**Recommendations:**
- Intercom messenger is the most agentic vector
- May have a partner/integrations page (not checked yet)
- Modern startup = likely responsive to tech-forward partnership pitches

---

### 3. Aloe Care Health — ⭐ Strong Agentic Potential

**Website:** aloecare.com

**Confirmed Chat Infrastructure:**
- **Zendesk** support portal (`support.aloecare.com`)
- Webflow contact form with fields: Name, Email, Phone, Message, Consent checkbox

**Automation Approaches:**

**A. Webflow Form Automation**
- Form fields: `Name-2`, `Email-4`, `Phone-2`, `Message-2`, `Consent-2`
- Webflow page ID: `654e51c407c1260f865b1ad0`
- Webflow element ID: `014212e8-3363-60ee-a600-7ee92c051fb0`
- POST to same page URL with form data
- Note: Webflow has rate limiting and may require solving a hidden anti-spam field

```bash
# Example curl
POST https://aloecare.com/contact
Content-Type: application/x-www-form-urlencoded

Name-2=Josh+Fialkoff&Email-4=josh@assistedly.ai&Phone-2=555-0100&Message-2=Partnership+inquiry...&Consent-2=on
```

**B. Zendesk Support Portal**
- `support.aloecare.com/hc/en-us` — may have "Submit a request" for B2B inquiries
- Less agentic than direct chat but scriptable

**C. Partner Page Navigation**
- Contact page includes "Partner" references in UI
- Likely has a care circle / B2B product team

**Recommendations:**
- Webflow form is automatable but respect rate limits
- Zendesk "Submit a request" could be used for formal B2B outreach
- Manual email follow-up recommended after form submit

---

### 4. Medical Guardian — ⭐ Moderate Agentic Potential

**Website:** medicalguardian.com

**Confirmed Chat Infrastructure:**
- **Olark** (12 references) — legacy chat platform
- **Crisp** (1 reference) — may be transitioning

**Other Vectors:**
- Custom WordPress/Divi forms with CSRF token (`8116326f5f3ca162674b3e81badc6a2d`)
- `contactformsubmit` CSS class on forms
- "Request Brochure" form with hidden fields (promo_code, display_number)
- AJAX-based form submission (JavaScript-driven)

**Automation Approaches:**

**A. Olark Chat (Headless Browser)**
- Olark has a JavaScript API: `olark('api.chat.sendMessageToVisitor', ...)` (for operators) but visitor-to-operator requires the widget
- Visitor can potentially initiate: `olark('api.box.expand')` then interact
- Olark is older and may not have strong anti-bot measures

**B. Form Automation (CSRF Challenge)**
- Must first GET the page to extract CSRF token
- Then POST with extracted token + form fields
- Hidden fields: `promo_code=GOODBYESUMMER`, `display_number=1-800-668-9200`
- More brittle but scriptable

```bash
# Pattern:
# 1. curl GET medicalguardian.com/contact
# 2. Extract CSRF token from X-CSRF-TOKEN input
# 3. POST with token + name/email/phone/message
```

**Recommendations:**
- Olark chat via headless browser is most viable
- Form automation is higher effort due to CSRF
- Consider phone: `1-800-668-9200` (displayed on page)

---

### 5. Bay Alarm Medical — ⭐ Moderate Agentic Potential

**Website:** bayalarmmedical.com

**Confirmed Chat Infrastructure:**
- **Crisp** (1 reference confirmed)

**Other Vectors:**
- WordPress/Divi site (Google Reviews widget: rpi-31259)
- "Partner" and "partnership" text present in page
- Likely has contact/partner inquiry forms

**Automation Approaches:**

**A. Crisp Chat (Headless Browser)**
- Similar approach to GoGoGrandparent
- Must extract CRISP_WEBSITE_ID from page source dynamically
- Likely lower CSRF protection than Medical Guardian

**B. Form Automation**
- WordPress/Divi forms are typically simpler than Medical Guardian's custom setup
- Likely standard `wp-json/contact-form-7/v1/contact-forms/.../feedback` endpoints or similar

**Recommendations:**
- Start with Crisp chat automation
- Check for dedicated partner page (`/partners` or `/partner`)

---

### 6. UnaliWear — ⭐ Moderate Agentic Potential

**Website:** unaliwear.com

**Confirmed Chat Infrastructure:**
- **Zoho SalesIQ** (5 references)
- **Crisp** (1 reference)

**Automation Approaches:**

**A. Zoho SalesIQ Chat**
- Zoho SalesIQ has a visitor API: `window.$zoho.salesiq.visitor.show()`
- Can send messages programmatically in headless browser
- SalesIQ chatbots may auto-respond, creating a conversation loop

**B. Crisp (if loaded)**
- Secondary chat option

**Recommendations:**
- Smaller company = higher likelihood of human reading messages
- Zoho SalesIQ automation via headless browser

---

### 7–10. Lower Agentic Potential (Corporate / App-First)

| Company | Why Lower Potential | Recommended Approach |
|---|---|---|
| **Papa** | App-first, no web chat widget, "Partner" text heavy but likely Salesforce-driven B2B | LinkedIn outreach to partnerships team, email to hello@papa.com |
| **MobileHelp** | Part of ADT ecosystem, no chat widget, likely routes through ADT corporate | Phone: check site for 800 number, corporate ADT partnerships |
| **SafelyYou** | B2B sales-focused, no web chat, likely Salesforce + outbound SDRs | LinkedIn to enterprise team, conference/event approach |
| **Honor Technology** | Large ($600M+), likely heavy procurement process, no chat widget | Warm introduction via mutual connection, LinkedIn BD team |

---

## Headless Browser Chat Automation Playbook

For companies with **Crisp**, **Intercom**, **Olark**, or **Zoho SalesIQ**, the highest-fidelity agentic approach is a headless browser (Puppeteer/Playwright):

### Playwright Script Template

```javascript
import { chromium } from 'playwright';

const PARTNER_SITES = [
  { name: 'GoGoGrandparent', url: 'https://gogograndparent.com',
    chatType: 'crisp', websiteId: 'b3c3ceb9-78c2-4e48-b2b8-24bdb0ead741' },
  { name: 'Hero Health', url: 'https://herohealth.com',
    chatType: 'intercom' },
  { name: 'Aloe Care Health', url: 'https://aloecare.com',
    chatType: 'webflow-form', formId: 'subscribeEmailForm' },
  { name: 'Medical Guardian', url: 'https://www.medicalguardian.com',
    chatType: 'olark' },
  { name: 'Bay Alarm Medical', url: 'https://www.bayalarmmedical.com',
    chatType: 'crisp' },
  { name: 'UnaliWear', url: 'https://unaliwear.com',
    chatType: 'zoho-salesiq' },
];

const OUTREACH_MESSAGE = `Hi there,

I'm Josh Fialkoff, founder of Assistedly.ai. We help families navigate care transitions with independent, data-backed guidance.

We'd love to explore a partnership with [COMPANY] — our first pilot partners are senior-safety companies that want to offer families a trusted next step when care needs change.

Would someone from partnerships be open to a 15-minute call?

Best,
Josh`;

async function runOutreach(site) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' });
  const page = await context.newPage();
  
  await page.goto(site.url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // Let chat widgets load
  
  switch (site.chatType) {
    case 'crisp':
      await page.evaluate((id) => {
        window.CRISP_WEBSITE_ID = id;
        window.$crisp = [];
        window.CRISP_READY_TRIGGER = function() {
          window.$crisp.push(["do", "chat:open"]);
          setTimeout(() => {
            window.$crisp.push(["do", "message:send", ["text", OUTREACH_MESSAGE.replace('[COMPANY]', site.name)]]);
          }, 500);
        };
        // Trigger Crisp load if not already loaded
        if (window.$crisp && window.$crisp.push) {
          window.CRISP_READY_TRIGGER();
        }
      }, site.websiteId);
      break;
      
    case 'intercom':
      await page.evaluate(() => {
        if (window.Intercom) {
          Intercom('showNewMessage', OUTREACH_MESSAGE.replace('[COMPANY]', site.name));
        }
      });
      break;
      
    case 'olark':
      await page.evaluate(() => {
        if (window.olark) {
          olark('api.box.expand');
          setTimeout(() => {
            // Olark visitor message API is limited; may need DOM manipulation
            const textarea = document.querySelector('.olark-text-input');
            if (textarea) {
              textarea.value = OUTREACH_MESSAGE.replace('[COMPANY]', site.name);
              textarea.dispatchEvent(new Event('input', { bubbles: true }));
              const form = textarea.closest('form');
              if (form) form.dispatchEvent(new Event('submit', { bubbles: true }));
            }
          }, 1000);
        }
      });
      break;
      
    case 'zoho-salesiq':
      await page.evaluate(() => {
        if (window.$zoho && window.$zoho.salesiq) {
          window.$zoho.salesiq.visitor.show();
          setTimeout(() => {
            const textarea = document.querySelector('[id*="salesiq"] textarea, .zsiq_flt_rel textarea');
            if (textarea) {
              textarea.value = OUTREACH_MESSAGE.replace('[COMPANY]', site.name);
              textarea.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
            }
          }, 1500);
        }
      });
      break;
  }
  
  await page.waitForTimeout(5000);
  await browser.close();
}

// Run sequentially to avoid rate limiting
for (const site of PARTNER_SITES) {
  console.log(`Starting outreach to ${site.name}...`);
  await runOutreach(site);
  await new Promise(r => setTimeout(r, 10000)); // 10s delay between sites
}
```

---

## Ethical & Legal Considerations

⚠️ **Important:**
1. **Respect robots.txt** — check before scraping
2. **Rate limiting** — add delays between messages, never flood
3. **Business hours** — trigger chat during business hours (9 AM–5 PM local time)
4. **Human review** — this playbook should include a human-in-the-loop for responses
5. **Opt-out honor** — if a company asks to stop, stop immediately
6. **GDPR/CCPA** — do not collect or store PII from chat responses without consent
7. **Platform ToS** — Crisp, Intercom, and Olark may have terms against automated visitor interaction

---

## Recommended Outreach Priority Queue

| Order | Company | Vector | Effort | Expected Response |
|---|---|---|---|---|
| 1 | GoGoGrandparent | Crisp chat + Impact.com affiliate | Low-Moderate | High (growth stage, partnership-friendly) |
| 2 | Aloe Care Health | Webflow form + Zendesk | Low | Moderate (has partner page) |
| 3 | Hero Health | Intercom chat | Moderate | Moderate (tech-forward startup) |
| 4 | Bay Alarm Medical | Crisp chat | Low | Moderate (family-owned, responsive) |
| 5 | UnaliWear | Zoho SalesIQ | Low | Moderate-High (small = direct to decision maker) |
| 6 | Medical Guardian | Olark chat | Moderate | Lower (large volume, more gatekeepers) |
| 7 | Papa | LinkedIn + direct email | High | Lower (app-first, B2B team) |
| 8 | MobileHelp | Phone + ADT corporate | High | Lower (corporate structure) |
| 9–15 | Honor, SafelyYou, etc. | Manual/warm intro only | High | Lower (corporate sales cycles) |

---

*Generated by `assistedly-partner-research` agent with live site reconnaissance.*
