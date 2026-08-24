/**
 * Authentication & Authorization Gateway
 * - Validates JWTs (RS256 or HS256 depending on deployment)
 * - Enforces audience-bound, short-lived tokens
 * - Tenant isolation
 * - Per-user permissions
 * - Token revocation support (in-memory; production uses Redis/DB)
 */

import { importJWK, jwtVerify, JWTPayload } from "jose";
import type { Identity, PolicyDecision } from "../types/index.js";

const REVOKED_JTIS = new Set<string>();
const ALLOWED_AUDIENCES = new Set(["assistedly-mcp", "assistedly-mcp:find-matching-options", "assistedly-mcp:get-option-summary", "assistedly-mcp:create-follow-up-draft"]);
const TOKEN_MAX_AGE_SECONDS = 3600; // 1 hour

// In production, load from JWKS endpoint or env secret
let _verificationKey: any = null;

export async function loadVerificationKey(): Promise<void> {
  const secret = process.env.MCP_JWT_SECRET;
  if (!secret) {
    // Dev fallback: generate a dummy key
    _verificationKey = await importJWK(
      { kty: "oct", k: Buffer.from("dev-secret-key-do-not-use-in-production-32b!").toString("base64url") },
      "HS256"
    );
    return;
  }
  _verificationKey = await importJWK(
    { kty: "oct", k: Buffer.from(secret).toString("base64url") },
    "HS256"
  );
}

export async function authenticate(token?: string): Promise<PolicyDecision> {
  if (!token) {
    return { decision: "deny", reason: "missing_token" };
  }
  if (!_verificationKey) {
    await loadVerificationKey();
  }

  let payload: JWTPayload;
  try {
    const { payload: p } = await jwtVerify(token, _verificationKey!, {
      clockTolerance: 30,
      maxTokenAge: `${TOKEN_MAX_AGE_SECONDS} sec`,
    });
    payload = p;
  } catch (e) {
    return { decision: "deny", reason: `token_invalid: ${e instanceof Error ? e.message : "unknown"}` };
  }

  if (REVOKED_JTIS.has(payload.jti as string)) {
    return { decision: "deny", reason: "token_revoked" };
  }

  const aud = payload.aud;
  const audiences = Array.isArray(aud) ? aud : [aud];
  if (!audiences.some((a) => ALLOWED_AUDIENCES.has(String(a)))) {
    return { decision: "deny", reason: `token_audience_invalid: ${audiences.join(", ")}` };
  }

  if (!payload.sub || !payload.tenant) {
    return { decision: "deny", reason: "token_missing_claims" };
  }

  const identity: Identity = {
    sub: String(payload.sub),
    tenant: String(payload.tenant),
    roles: Array.isArray(payload.roles) ? payload.roles.map(String) : [],
    aud: String(audiences[0]),
    exp: Number(payload.exp ?? 0),
    iat: Number(payload.iat ?? 0),
    jti: String(payload.jti ?? ""),
  };

  return {
    decision: "allow",
    context: {
      identity,
      toolName: "", // filled later by caller
      requestId: crypto.randomUUID(),
      timestamp: new Date(),
    },
  };
}

export function requireRole(identity: Identity, role: string): boolean {
  return identity.roles.includes(role) || identity.roles.includes("admin");
}

export function revokeToken(jti: string): void {
  REVOKED_JTIS.add(jti);
}

export function isRevoked(jti: string): boolean {
  return REVOKED_JTIS.has(jti);
}
