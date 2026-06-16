const fs = require("fs/promises");
const path = require("path");
const { randomUUID } = require("crypto");

const STORE_PATH =
  process.env.MVP_DATA_FILE || path.join(process.cwd(), ".data", "mvp-store.json");

const DEFAULT_STORE = {
  users: {},
  leads: [],
  comparisons: [],
  aiUsage: [],
};

let memoryStore = { ...DEFAULT_STORE };

function cloneDefaultStore() {
  return {
    users: { ...DEFAULT_STORE.users },
    leads: [...DEFAULT_STORE.leads],
    comparisons: [...DEFAULT_STORE.comparisons],
    aiUsage: [...DEFAULT_STORE.aiUsage],
  };
}

async function readStore() {
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw);
    memoryStore = {
      users: parsed?.users && typeof parsed.users === "object" ? parsed.users : {},
      leads: Array.isArray(parsed?.leads) ? parsed.leads : [],
      comparisons: Array.isArray(parsed?.comparisons) ? parsed.comparisons : [],
      aiUsage: Array.isArray(parsed?.aiUsage) ? parsed.aiUsage : [],
    };
    return memoryStore;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      console.warn("MVP store read failed, using in-memory fallback", error);
    }
    return memoryStore || cloneDefaultStore();
  }
}

async function writeStore(nextStore) {
  memoryStore = nextStore;
  try {
    await fs.mkdir(path.dirname(STORE_PATH), { recursive: true });
    await fs.writeFile(STORE_PATH, JSON.stringify(nextStore, null, 2));
  } catch (error) {
    console.warn("MVP store write failed, keeping in-memory fallback", error);
  }
  return nextStore;
}

async function updateStore(mutator) {
  const current = await readStore();
  const working = {
    users: { ...current.users },
    leads: [...current.leads],
    comparisons: [...current.comparisons],
    aiUsage: [...current.aiUsage],
  };
  const next = (await mutator(working)) || working;
  return writeStore(next);
}

async function getUserByEmail(email) {
  if (!email) return null;
  const store = await readStore();
  return store.users[String(email).trim().toLowerCase()] || null;
}

async function recordUserAuth(email, role, extra = {}) {
  if (!email) return null;
  const normalizedEmail = String(email).trim().toLowerCase();
  const now = new Date().toISOString();

  const store = await updateStore((current) => {
    const existing = current.users[normalizedEmail] || {};
    current.users[normalizedEmail] = {
      email: normalizedEmail,
      role,
      createdAt: existing.createdAt || now,
      lastSeenAt: now,
      lastAuthAt: now,
      ...existing,
      ...extra,
      email: normalizedEmail,
      role,
      lastSeenAt: now,
      lastAuthAt: now,
    };
    return current;
  });

  return store.users[normalizedEmail];
}

async function saveLead(payload) {
  const now = new Date().toISOString();
  const lead = {
    id: randomUUID(),
    createdAt: now,
    email: "",
    name: "",
    city: "",
    town: "",
    careNeed: "",
    intent: "consumer_mvp",
    leadMagnet: "",
    page: "",
    facilities: [],
    notes: "",
    status: "new",
    ...payload,
  };

  await updateStore((current) => {
    current.leads.unshift(lead);
    current.leads = current.leads.slice(0, 500);
    return current;
  });

  return lead;
}

async function saveComparison(payload) {
  const comparison = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    title: "Saved comparison",
    facilitySlugs: [],
    ownerEmail: "",
    ...payload,
  };

  await updateStore((current) => {
    current.comparisons.unshift(comparison);
    current.comparisons = current.comparisons.slice(0, 250);
    return current;
  });

  return comparison;
}

async function listComparisonsByOwner(ownerEmail) {
  const normalizedEmail = String(ownerEmail || "").trim().toLowerCase();
  if (!normalizedEmail) return [];
  const store = await readStore();
  return store.comparisons.filter((comparison) => comparison.ownerEmail === normalizedEmail);
}

async function recordAiUsage(payload) {
  const event = {
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    type: "chat",
    ...payload,
  };

  await updateStore((current) => {
    current.aiUsage.unshift(event);
    current.aiUsage = current.aiUsage.slice(0, 1000);
    return current;
  });

  return event;
}

function countFacilities(records = [], getNames) {
  const counts = {};
  records.forEach((record) => {
    getNames(record).forEach((name) => {
      if (!name) return;
      counts[name] = (counts[name] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([facility, count]) => ({ facility, count }));
}

async function getDashboardSummary() {
  const store = await readStore();
  const users = Object.values(store.users);
  const leads = [...store.leads];
  const comparisons = [...store.comparisons];
  const aiUsage = [...store.aiUsage];

  const premiumUsers = users.filter((user) => user.role === "premium_user").length;
  const facilityClaims = leads.filter((lead) => lead.intent === "facility_claim").length;

  return {
    totals: {
      users: users.length,
      registrations: users.length,
      premiumUsers,
      leads: leads.length,
      facilityClaims,
      aiUsage: aiUsage.length,
      savedComparisons: comparisons.length,
    },
    funnel: {
      emailCaptures: leads.length,
      registrations: users.length,
      aiUsage: aiUsage.length,
      comparisons: comparisons.length,
      premiumConversions: premiumUsers,
    },
    popularFacilities: countFacilities(
      [
        ...leads.map((lead) => ({ facilities: lead.facilities || [] })),
        ...comparisons.map((comparison) => ({ facilities: comparison.facilitySlugs || [] })),
        ...aiUsage.map((event) => ({ facilities: event.facilities || [] })),
      ],
      (record) => record.facilities || [],
    ),
    recentLeads: leads.slice(0, 10),
    recentUsers: users
      .sort((a, b) => String(b.lastSeenAt || "").localeCompare(String(a.lastSeenAt || "")))
      .slice(0, 10),
    recentAiUsage: aiUsage.slice(0, 10),
  };
}

module.exports = {
  getDashboardSummary,
  getUserByEmail,
  listComparisonsByOwner,
  recordAiUsage,
  recordUserAuth,
  readStore,
  saveComparison,
  saveLead,
};
