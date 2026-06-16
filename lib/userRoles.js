const { getUserByEmail, recordUserAuth } = require("./mvpDataStore");

const ROLES = {
  VISITOR: "visitor",
  REGISTERED: "registered_user",
  PREMIUM: "premium_user",
  FACILITY_REP: "facility_representative",
  ADMIN: "admin",
};

function parseEmailList(value) {
  return new Set(
    String(value || "")
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
}

function configuredRoleForEmail(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return ROLES.VISITOR;

  if (parseEmailList(process.env.ASSISTEDLY_ADMIN_EMAILS).has(normalizedEmail)) {
    return ROLES.ADMIN;
  }
  if (parseEmailList(process.env.ASSISTEDLY_PREMIUM_EMAILS).has(normalizedEmail)) {
    return ROLES.PREMIUM;
  }
  if (
    parseEmailList(process.env.ASSISTEDLY_FACILITY_REP_EMAILS).has(normalizedEmail)
  ) {
    return ROLES.FACILITY_REP;
  }

  return null;
}

async function resolveUserRecord(email) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) {
    return { email: "", role: ROLES.VISITOR };
  }

  const existing = await getUserByEmail(normalizedEmail);
  const configuredRole = configuredRoleForEmail(normalizedEmail);
  const role = configuredRole || existing?.role || ROLES.REGISTERED;

  return {
    email: normalizedEmail,
    role,
    createdAt: existing?.createdAt || null,
    lastSeenAt: existing?.lastSeenAt || null,
  };
}

async function upsertUserFromAuth(email) {
  const resolved = await resolveUserRecord(email);
  if (!resolved.email) return resolved;
  return recordUserAuth(resolved.email, resolved.role);
}

function isRegisteredRole(role) {
  return [
    ROLES.REGISTERED,
    ROLES.PREMIUM,
    ROLES.FACILITY_REP,
    ROLES.ADMIN,
  ].includes(role);
}

function isPremiumRole(role) {
  return [ROLES.PREMIUM, ROLES.ADMIN].includes(role);
}

function isAdminRole(role) {
  return role === ROLES.ADMIN;
}

module.exports = {
  ROLES,
  isAdminRole,
  isPremiumRole,
  isRegisteredRole,
  resolveUserRecord,
  upsertUserFromAuth,
};
