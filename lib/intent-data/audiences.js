import { getStore, setStore } from "./store";
import { createAudience } from "./models";

export function listAudiences() {
  return getStore().audiences;
}

export function getAudience(id) {
  return getStore().audiences.find((a) => a.id === id) || null;
}

export function addAudience(partial) {
  const store = getStore();
  const audience = createAudience(partial);
  store.audiences.push(audience);
  setStore(store);
  return audience;
}

export function updateAudience(id, patch) {
  const store = getStore();
  const idx = store.audiences.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  store.audiences[idx] = { ...store.audiences[idx], ...patch, updatedAt: new Date().toISOString() };
  setStore(store);
  return store.audiences[idx];
}

export function deleteAudience(id) {
  const store = getStore();
  store.audiences = store.audiences.filter((a) => a.id !== id);
  setStore(store);
}

export function buildAudienceFromCriteria(criteria) {
  const store = getStore();
  let accountIds = [];
  let contactIds = [];

  // Simple criteria: by industry, size, or signal keyword
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

  if (accountIds.length > 0) {
    contactIds = store.contacts
      .filter((c) => accountIds.includes(c.accountId))
      .map((c) => c.id);
  }

  return { accountIds, contactIds };
}
