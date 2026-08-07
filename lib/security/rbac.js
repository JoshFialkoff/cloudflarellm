/**
 * Role-Based Access Control (RBAC) + HIPAA scope enforcement
 *
 * Massachusetts 201 CMR 17.00 requires:
 * - Restrict access to personal information to those who need it.
 * - Maintain audit trails of access.
 *
 * We inject this as Express/Next.js middleware on every endpoint
 * that reads or writes care-profile / preference / PHI data.
 */

import { auditAccess } from "./auditLog.js";
import { ROLES } from "../userRoles.js";
// serverAuth is CommonJS; Next.js interop resolves named imports
import { getSession } from "../serverAuth.js";

export const SCOPES = {
  READ_FACILITY_PUBLIC: "read:facility:public",
  READ_FACILITY_PHI: "read:facility:phi",
  READ_CARE_PROFILE: "read:care_profile",
  WRITE_CARE_PROFILE: "write:care_profile",
  READ_USER_PII: "read:user:pii",
  WRITE_USER_PII: "write:user:pii",
  ADMIN_DASHBOARD: "admin:dashboard",
  LLM_DEEP_DIVE: "llm:deep_dive",
};

const SCOPE_MATRIX = {
  [ROLES.VISITOR]: [SCOPES.READ_FACILITY_PUBLIC],
  [ROLES.REGISTERED]: [
    SCOPES.READ_FACILITY_PUBLIC,
    SCOPES.READ_CARE_PROFILE,
    SCOPES.WRITE_CARE_PROFILE,
  ],
  [ROLES.PREMIUM]: [
    SCOPES.READ_FACILITY_PUBLIC,
    SCOPES.READ_FACILITY_PHI,
    SCOPES.READ_CARE_PROFILE,
    SCOPES.WRITE_CARE_PROFILE,
    SCOPES.LLM_DEEP_DIVE,
  ],
  [ROLES.FACILITY_REP]: [
    SCOPES.READ_FACILITY_PUBLIC,
    SCOPES.READ_FACILITY_PHI,
    SCOPES.ADMIN_DASHBOARD,
  ],
  [ROLES.ADMIN]: Object.values(SCOPES),
};

export function roleHasScope(role, scope) {
  const allowed = SCOPE_MATRIX[role] || [];
  return allowed.includes(scope);
}

/**
 * Next.js API-route middleware factory.
 *
 * Usage:
 *   export default withRbac(handler, { scope: SCOPES.LLM_DEEP_DIVE })
 */
export function withRbac(handler, { scope, allowVisitor = false } = {}) {
  return async function rbacWrapped(req, res) {
    const session = req.__session || getSession(req) || null;
    // Attach resolved session so downstream handlers don't re-parse cookies
    req.__session = session;
    const role = session?.role || ROLES.VISITOR;
    const actor = session?.email || `guest:${req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown"}`;

    if (!allowVisitor && role === ROLES.VISITOR) {
      auditAccess({ actor, resource: req.url, granted: false, reason: "visitor_not_allowed" });
      res.setHeader("Allow", "Authenticated sessions only");
      return res.status(401).json({ error: "Authentication required." });
    }

    if (scope && !roleHasScope(role, scope)) {
      auditAccess({ actor, resource: req.url, granted: false, reason: `missing_scope:${scope}` });
      return res.status(403).json({ error: "Insufficient permissions." });
    }

    auditAccess({ actor, resource: req.url, granted: true, reason: `role:${role}` });
    return handler(req, res);
  };
}

/**
 * Stand-alone requireScope check for inside API handlers
 * that do custom auth resolution.
 */
export function requireScope(session, scope) {
  const role = session?.role || ROLES.VISITOR;
  if (!roleHasScope(role, scope)) {
    const actor = session?.email || "anonymous";
    auditAccess({ actor, resource: "inline", granted: false, reason: `missing_scope:${scope}` });
    return false;
  }
  return true;
}
