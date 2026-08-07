/**
 * Assistedly.ai — Privacy-First & HIPAA-Compliant Guardrails
 *
 * Barrel export for security modules.
 */

export { auditLog, auditPrompt, auditAccess, safeError } from "./auditLog.js";
export {
  sanitize,
  sanitizePromptPayload,
  hashForAudit,
  safePreview,
  containsPii,
} from "./sanitizer.js";
export { withRbac, requireScope, roleHasScope, SCOPES } from "./rbac.js";
export { getZdrHeaders, mergeZdr, detectVendorFromUrl, isZdrEnforced, ZDR_HEADERS } from "./zdr.js";
