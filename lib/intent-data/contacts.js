import { getStore, setStore } from "./store";
import { createContact } from "./models";

export function listContacts() {
  return getStore().contacts;
}

export function getContact(id) {
  return getStore().contacts.find((c) => c.id === id) || null;
}

export function findContactsByAccount(accountId) {
  return getStore().contacts.filter((c) => c.accountId === accountId);
}

export function findContactByEmail(email) {
  if (!email) return null;
  const e = email.toLowerCase().trim();
  return getStore().contacts.find((c) => c.email?.toLowerCase() === e) || null;
}

export function addContact(partial) {
  const store = getStore();
  const contact = createContact(partial);
  store.contacts.push(contact);
  setStore(store);
  return contact;
}

export function updateContact(id, patch) {
  const store = getStore();
  const idx = store.contacts.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  store.contacts[idx] = { ...store.contacts[idx], ...patch, updatedAt: new Date().toISOString() };
  setStore(store);
  return store.contacts[idx];
}

export function upsertContactByEmail(partial) {
  const existing = findContactByEmail(partial.email);
  if (existing) {
    return updateContact(existing.id, partial);
  }
  return addContact(partial);
}
