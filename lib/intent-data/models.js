/**
 * AIDP data model definitions — used for validation, smoke tests, and docs.
 */

export function now() {
  return new Date().toISOString();
}

export function uuid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export const MODELS = {
  Account: {
    id: "string",
    name: "string",
    domain: "string",
    industry: "string",
    size: "string",
    signals: "array",
    createdAt: "string",
    updatedAt: "string",
  },
  Contact: {
    id: "string",
    email: "string",
    firstName: "string",
    lastName: "string",
    title: "string",
    accountId: "string",
    signals: "array",
    createdAt: "string",
    updatedAt: "string",
  },
  Audience: {
    id: "string",
    name: "string",
    description: "string",
    criteria: "object",
    accountIds: "array",
    contactIds: "array",
    createdAt: "string",
    updatedAt: "string",
  },
  Campaign: {
    id: "string",
    name: "string",
    audienceId: "string",
    channel: "string",
    status: "string",
    createdAt: "string",
    updatedAt: "string",
  },
};

export function createAccount(partial = {}) {
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

export function createContact(partial = {}) {
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

export function createAudience(partial = {}) {
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

export function createCampaign(partial = {}) {
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
