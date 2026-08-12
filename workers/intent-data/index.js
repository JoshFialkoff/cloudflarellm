/**
 * Assistedly Intent Data Platform (AIDP) — Cloudflare Worker
 * Lightweight edge-native implementation using KV + Cloudflare Access.
 */

const KV_KEY = "aidp:store";
const ALLOWED_DOMAINS = ["assistedly.ai", "forwardjump.com"];

// ---------- Auth ----------
function getUser(request) {
  const email = request.headers.get("CF-Access-Authenticated-User-Email");
  if (!email) return null;
  const domain = email.split("@")[1]?.toLowerCase();
  if (!ALLOWED_DOMAINS.includes(domain)) return null;
  return { email, domain };
}

function requireAuth(request) {
  const user = getUser(request);
  if (!user) {
    return json({ error: "Unauthorized — sign in via Cloudflare Access." }, 401);
  }
  return user;
}

// ---------- Storage helpers ----------
async function loadStore(kv) {
  try {
    const raw = await kv.get(KV_KEY, { type: "json" });
    return raw || { accounts: [], contacts: [], audiences: [], campaigns: [], events: [] };
  } catch {
    return { accounts: [], contacts: [], audiences: [], campaigns: [], events: [] };
  }
}

async function saveStore(kv, store) {
  await kv.put(KV_KEY, JSON.stringify(store));
}

// ---------- Utils ----------
function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function now() {
  return new Date().toISOString();
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------- Models ----------
function createAccount(partial = {}) {
  const t = now();
  return {
    id: partial.id || uuid(),
    name: partial.name || "",
    domain: partial.domain || "",
    industry: partial.industry || "",
    size: partial.size || "",
    signals: partial.signals || [],
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
}

function createContact(partial = {}) {
  const t = now();
  return {
    id: partial.id || uuid(),
    email: partial.email || "",
    firstName: partial.firstName || "",
    lastName: partial.lastName || "",
    title: partial.title || "",
    accountId: partial.accountId || "",
    signals: partial.signals || [],
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
}

function createAudience(partial = {}) {
  const t = now();
  return {
    id: partial.id || uuid(),
    name: partial.name || "",
    description: partial.description || "",
    criteria: partial.criteria || {},
    accountIds: partial.accountIds || [],
    contactIds: partial.contactIds || [],
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
}

function createCampaign(partial = {}) {
  const t = now();
  return {
    id: partial.id || uuid(),
    name: partial.name || "",
    audienceId: partial.audienceId || "",
    channel: partial.channel || "email",
    status: partial.status || "draft",
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
}

// ---------- Data ops ----------
function findAccountByDomain(store, domain) {
  if (!domain) return null;
  const d = domain.toLowerCase().trim();
  return store.accounts.find((a) => a.domain?.toLowerCase() === d) || null;
}

function findContactByEmail(store, email) {
  if (!email) return null;
  const e = email.toLowerCase().trim();
  return store.contacts.find((c) => c.email?.toLowerCase() === e) || null;
}

function findContactsByAccount(store, accountId) {
  return store.contacts.filter((c) => c.accountId === accountId);
}

function getAudience(store, id) {
  return store.audiences.find((a) => a.id === id) || null;
}

function buildAudienceFromCriteria(store, criteria) {
  let accountIds = [];
  if (criteria.industry) {
    accountIds = store.accounts
      .filter((a) => a.industry?.toLowerCase().includes(criteria.industry.toLowerCase()))
      .map((a) => a.id);
  }
  if (criteria.size) {
    accountIds = store.accounts
      .filter((a) => a.size?.toLowerCase().includes(criteria.size.toLowerCase()))
      .map((a) => a.id);
  }
  if (criteria.signal) {
    accountIds = store.accounts
      .filter((a) => a.signals?.some((s) => s.toLowerCase().includes(criteria.signal.toLowerCase())))
      .map((a) => a.id);
  }
  const contactIds = accountIds.length > 0
    ? store.contacts.filter((c) => accountIds.includes(c.accountId)).map((c) => c.id)
    : [];
  return { accountIds, contactIds };
}

function scoreDomain(store, domain) {
  const account = findAccountByDomain(store, domain);
  if (!account) {
    return { domain, score: 0, signals: [], contacts: 0, tier: "unknown" };
  }
  const contacts = findContactsByAccount(store, account.id);
  const weights = {
    pricing_page: 35,
    demo_request: 40,
    case_study_download: 25,
    career_page: -10,
    newsletter_signup: 5,
    g2_review: 20,
    competitor_comparison: 30,
    linkedin_engagement: 10,
    site_visit: 1,
  };
  let score = 0;
  const signalScores = [];
  for (const signal of account.signals || []) {
    const weight = weights[signal] || 3;
    score += weight;
    signalScores.push({ signal, weight });
  }
  score += Math.min(contacts.length * 3, 15);
  score = Math.min(Math.max(Math.round(score), 0), 100);
  let tier = "cold";
  if (score >= 75) tier = "hot";
  else if (score >= 50) tier = "warm";
  else if (score >= 25) tier = "mild";
  return { domain, score, tier, signals: signalScores, contacts: contacts.length, accountId: account.id };
}

function resolveGraph(store, { domain, email }) {
  let account = null;
  if (domain) {
    account = store.accounts.find((a) => a.domain?.toLowerCase() === domain.toLowerCase().trim()) || null;
  }
  let contact = null;
  if (email) {
    contact = store.contacts.find((c) => c.email?.toLowerCase() === email.toLowerCase().trim()) || null;
    if (contact && !account) {
      account = store.accounts.find((a) => a.id === contact.accountId) || null;
    }
  }
  if (!account && !contact) return { found: false };
  const accountContacts = account ? findContactsByAccount(store, account.id) : [];
  const accountAudiences = account ? store.audiences.filter((a) => a.accountIds?.includes(account.id)) : [];
  const contactAudiences = contact ? store.audiences.filter((a) => a.contactIds?.includes(contact.id)) : [];
  return {
    found: true,
    account,
    contact,
    contacts: accountContacts,
    audiences: [...new Set([...accountAudiences, ...contactAudiences])],
    signals: account?.signals || [],
  };
}

function graphStats(store) {
  return {
    totalAccounts: store.accounts.length,
    totalContacts: store.contacts.length,
    totalAudiences: store.audiences.length,
    avgContactsPerAccount: store.accounts.length ? +(store.contacts.length / store.accounts.length).toFixed(2) : 0,
  };
}

// ---------- Seed ----------
function seed(store) {
  const accounts = [
    createAccount({
      name: "BrightSpring Health Services",
      domain: "brightspringhealth.com",
      industry: "Healthcare",
      size: "10000+",
      signals: ["pricing_page", "demo_request", "linkedin_engagement"],
    }),
    createAccount({
      name: "Amedisys",
      domain: "amedisys.com",
      industry: "Healthcare",
      size: "5000-10000",
      signals: ["case_study_download", "g2_review", "site_visit"],
    }),
    createAccount({
      name: "ProMedica Senior Care",
      domain: "promedicaseniorcare.org",
      industry: "Senior Living",
      size: "1000-5000",
      signals: ["pricing_page", "demo_request", "g2_review", "linkedin_engagement"],
    }),
  ];
  const contacts = [
    createContact({ email: "sarah.j@brightspringhealth.com", firstName: "Sarah", lastName: "Jenkins", title: "VP Operations", accountId: accounts[0].id }),
    createContact({ email: "mike.r@brightspringhealth.com", firstName: "Mike", lastName: "Roberts", title: "Director of IT", accountId: accounts[0].id }),
    createContact({ email: "linda.k@amedisys.com", firstName: "Linda", lastName: "Kim", title: "CMO", accountId: accounts[1].id }),
  ];
  const audiences = [
    createAudience({
      name: "High Intent Healthcare",
      description: "Accounts showing pricing + demo + engagement signals",
      criteria: { signal: "pricing_page" },
      accountIds: [accounts[0].id, accounts[2].id],
      contactIds: [contacts[0].id, contacts[1].id],
    }),
  ];
  const campaigns = [
    createCampaign({ name: "Q3 Outreach - High Intent", audienceId: audiences[0].id, channel: "email", status: "active" }),
  ];
  store.accounts = accounts;
  store.contacts = contacts;
  store.audiences = audiences;
  store.campaigns = campaigns;
  store.events = [];
  return store;
}

// ---------- Router ----------
async function route(request, env) {
  const url = new URL(request.url);
  const kv = env.AIDP_KV;

  // Always allow health
  if (url.pathname === "/api/intent/health" || url.pathname === "/health") {
    return json({ ok: true, service: "aidp", version: "0.2.0", runtime: "cloudflare-worker" });
  }

  // Auth gate for everything else
  const auth = requireAuth(request);
  if (auth instanceof Response) return auth;

  const store = await loadStore(kv);

  // GET /api/intent/models
  if (url.pathname === "/api/intent/models" && request.method === "GET") {
    return json({ ok: true, models: ["Account", "Contact", "Audience", "Campaign"] });
  }

  // POST /api/intent/seed
  if (url.pathname === "/api/intent/seed" && request.method === "POST") {
    seed(store);
    await saveStore(kv, store);
    return json({ ok: true, seeded: { accounts: store.accounts.length, contacts: store.contacts.length, audiences: store.audiences.length, campaigns: store.campaigns.length } });
  }

  // GET/POST /api/intent/accounts
  if (url.pathname === "/api/intent/accounts") {
    if (request.method === "GET") {
      return json({ ok: true, data: store.accounts });
    }
    if (request.method === "POST") {
      try {
        const body = await request.json();
        store.accounts.push(createAccount(body));
        await saveStore(kv, store);
        return json({ ok: true, data: store.accounts.at(-1) }, 201);
      } catch {
        return json({ error: "Invalid body" }, 400);
      }
    }
  }

  // GET/POST /api/intent/contacts
  if (url.pathname === "/api/intent/contacts") {
    if (request.method === "GET") {
      return json({ ok: true, data: store.contacts });
    }
    if (request.method === "POST") {
      try {
        const body = await request.json();
        store.contacts.push(createContact(body));
        await saveStore(kv, store);
        return json({ ok: true, data: store.contacts.at(-1) }, 201);
      } catch {
        return json({ error: "Invalid body" }, 400);
      }
    }
  }

  // GET /api/intent/intent-score?domain=...
  if (url.pathname === "/api/intent/intent-score" && request.method === "GET") {
    const domain = url.searchParams.get("domain");
    if (!domain) return json({ error: "Missing domain" }, 400);
    return json({ ok: true, data: scoreDomain(store, domain) });
  }

  // GET /api/intent/graph || /api/intent/graph?stats=true
  if (url.pathname === "/api/intent/graph" && request.method === "GET") {
    if (url.searchParams.get("stats") === "true") {
      return json({ ok: true, data: graphStats(store) });
    }
    const domain = url.searchParams.get("domain");
    const email = url.searchParams.get("email");
    return json({ ok: true, data: resolveGraph(store, { domain, email }) });
  }

  // GET/POST /api/intent/audiences
  if (url.pathname === "/api/intent/audiences") {
    if (request.method === "GET") {
      return json({ ok: true, data: store.audiences });
    }
    if (request.method === "POST") {
      try {
        const body = await request.json();
        let payload = body;
        if (body.criteria) {
          const { accountIds, contactIds } = buildAudienceFromCriteria(store, body.criteria);
          payload = { ...body, accountIds, contactIds };
        }
        store.audiences.push(createAudience(payload));
        await saveStore(kv, store);
        return json({ ok: true, data: store.audiences.at(-1) }, 201);
      } catch {
        return json({ error: "Invalid body" }, 400);
      }
    }
  }

  // /api/intent/audiences/:id/*
  const audMatch = url.pathname.match(/^\/api\/intent\/audiences\/([^\/]+)\/(export|sync|campaigns)$/);
  if (audMatch) {
    const [, id, action] = audMatch;
    const audience = getAudience(store, id);
    if (!audience) return json({ error: "Audience not found" }, 404);

    if (action === "export") {
      const format = url.searchParams.get("format") || "json";
      const accounts = (audience.accountIds || []).map((aid) => store.accounts.find((a) => a.id === aid)).filter(Boolean);
      const contacts = (audience.contactIds || []).map((cid) => store.contacts.find((c) => c.id === cid)).filter(Boolean);

      if (format === "csv") {
        const rows = [
          ["type", "id", "name", "email", "domain", "industry", "title"].join(","),
          ...accounts.map((a) => ["account", a.id, a.name, "", a.domain, a.industry, ""].join(",")),
          ...contacts.map((c) => ["contact", c.id, `${c.firstName} ${c.lastName}`, c.email, "", "", c.title].join(",")),
        ];
        return new Response(rows.join("\n"), {
          status: 200,
          headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="audience-${id}.csv"`,
          },
        });
      }
      return json({ ok: true, data: { audience, accounts, contacts } });
    }

    if (action === "sync") {
      if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
      const contacts = (audience.contactIds || []).map((cid) => store.contacts.find((c) => c.id === cid)).filter(Boolean);
      return json({ ok: true, data: { success: true, source: "twenty", syncedAt: now(), contactCount: contacts.length, note: "Stub — no actual Twenty API call made." } });
    }

    if (action === "campaigns") {
      const campaigns = store.campaigns?.filter((c) => c.audienceId === id) || [];
      return json({ ok: true, data: campaigns });
    }
  }

  return json({ error: "Not found" }, 404);
}

// ---------- Handler ----------
export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    const response = await route(request, env);

    // Attach CORS
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Access-Control-Allow-Origin", "*");
    return new Response(response.body, { status: response.status, headers: newHeaders });
  },
};
