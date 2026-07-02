/**
 * Shortlist — single source of truth for saved/comparing facilities.
 *
 * Persisted in localStorage under `assistedly_shortlist_v1`.
 * Stale slugs (facilities removed from dataset) are silently dropped on read.
 */

const STORAGE_KEY = 'assistedly_shortlist_v1';

/** Read current shortlist from localStorage, filtering out stale IDs. */
export function getShortlist(validSlugs) {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const slugs = raw.filter((s) => typeof s === 'string' && s.length > 0);
    if (!validSlugs) return slugs;
    return slugs.filter((s) => validSlugs.includes(s));
  } catch {
    return [];
  }
}

function writeShortlist(slugs) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(slugs));
  } catch {
    // localStorage may be full or unavailable
  }
}

/** Add a facility slug. No-op if already present. */
export function addToShortlist(slug) {
  if (typeof window === 'undefined') return;
  const current = getShortlist();
  if (current.includes(slug)) return;
  writeShortlist([...current, slug]);
}

/** Remove a facility slug. No-op if absent. */
export function removeFromShortlist(slug) {
  if (typeof window === 'undefined') return;
  const current = getShortlist();
  if (!current.includes(slug)) return;
  writeShortlist(current.filter((s) => s !== slug));
}

/** Toggle presence. Returns the new state (true = present). */
export function toggleShortlist(slug) {
  const current = getShortlist();
  const exists = current.includes(slug);
  if (exists) {
    writeShortlist(current.filter((s) => s !== slug));
    return false;
  }
  writeShortlist([...current, slug]);
  return true;
}

/** Remove all. */
export function clearShortlist() {
  writeShortlist([]);
}

/** Alias for backward compat / clarity. */
export const clearAll = clearShortlist;

export const MAX_COMPARE = 4;
