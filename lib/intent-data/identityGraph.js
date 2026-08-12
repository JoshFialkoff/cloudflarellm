import { listAccounts } from "./accounts";
import { listContacts, findContactsByAccount } from "./contacts";
import { listAudiences } from "./audiences";

/**
 * Resolve an identity graph for a given domain or email.
 * Returns account + contacts + audiences the entity belongs to.
 */
export function resolveGraph({ domain, email }) {
  const accounts = listAccounts();
  const contacts = listContacts();
  const audiences = listAudiences();

  let account = null;
  if (domain) {
    account = accounts.find((a) => a.domain?.toLowerCase() === domain.toLowerCase().trim()) || null;
  }

  let contact = null;
  if (email) {
    contact = contacts.find((c) => c.email?.toLowerCase() === email.toLowerCase().trim()) || null;
    if (contact && !account) {
      account = accounts.find((a) => a.id === contact.accountId) || null;
    }
  }

  if (!account && !contact) {
    return { found: false };
  }

  const accountContacts = account ? findContactsByAccount(account.id) : [];
  const accountAudiences = account
    ? audiences.filter((a) => a.accountIds?.includes(account.id))
    : [];
  const contactAudiences = contact
    ? audiences.filter((a) => a.contactIds?.includes(contact.id))
    : [];
  const allAudiences = [...new Set([...accountAudiences, ...contactAudiences])];

  return {
    found: true,
    account: account || null,
    contact: contact || null,
    contacts: accountContacts,
    audiences: allAudiences,
    signals: account?.signals || [],
  };
}

/**
 * Return a summary stats object for the graph.
 */
export function graphStats() {
  const accounts = listAccounts();
  const contacts = listContacts();
  const audiences = listAudiences();

  return {
    totalAccounts: accounts.length,
    totalContacts: contacts.length,
    totalAudiences: audiences.length,
    avgContactsPerAccount: accounts.length ? +(contacts.length / accounts.length).toFixed(2) : 0,
    topIndustries: topK(accounts.map((a) => a.industry).filter(Boolean), 5),
    topSignals: topK(accounts.flatMap((a) => a.signals || []), 5),
  };
}

function topK(arr, k) {
  const counts = {};
  for (const item of arr) counts[item] = (counts[item] || 0) + 1;
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, k)
    .map(([name, count]) => ({ name, count }));
}
