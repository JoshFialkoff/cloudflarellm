import { getStore, setStore } from "./store";
import { createAccount } from "./models";

export function listAccounts() {
  return getStore().accounts;
}

export function getAccount(id) {
  return getStore().accounts.find((a) => a.id === id) || null;
}

export function findAccountByDomain(domain) {
  if (!domain) return null;
  const d = domain.toLowerCase().trim();
  return getStore().accounts.find((a) => a.domain?.toLowerCase() === d) || null;
}

export function addAccount(partial) {
  const store = getStore();
  const account = createAccount(partial);
  store.accounts.push(account);
  setStore(store);
  return account;
}

export function updateAccount(id, patch) {
  const store = getStore();
  const idx = store.accounts.findIndex((a) => a.id === id);
  if (idx === -1) return null;
  store.accounts[idx] = { ...store.accounts[idx], ...patch, updatedAt: new Date().toISOString() };
  setStore(store);
  return store.accounts[idx];
}

export function upsertAccountByDomain(partial) {
  const existing = findAccountByDomain(partial.domain);
  if (existing) {
    return updateAccount(existing.id, partial);
  }
  return addAccount(partial);
}
