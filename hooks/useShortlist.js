import { useCallback, useEffect, useState } from 'react';
import { getShortlist, toggleShortlist, addToShortlist, removeFromShortlist, clearShortlist, MAX_COMPARE } from '../lib/shortlist';

const STORAGE_EVENT = 'assistedly:shortlist-updated';

/**
 * React hook wrapping the shortlist localStorage service.
 *
 * Usage:
 *   const { shortlist, isSaved, toggle, add, remove, clear } = useShortlist()
 *   const { shortlist, isSaved, toggle, add, remove, clear } = useShortlist(validSlugs)
 *
 * Cross-tab sync via custom storage event emitted from direct service calls.
 */
export function useShortlist(validSlugs) {
  const [shortlist, setShortlist] = useState([]);

  const sync = useCallback(() => {
    setShortlist(getShortlist(validSlugs));
  }, [validSlugs]);

  useEffect(() => {
    sync();
    window.addEventListener('storage', sync);
    window.addEventListener(STORAGE_EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(STORAGE_EVENT, sync);
    };
  }, [sync]);

  function notify() {
    // Dispatch a custom event so other hooks (or tabs) re-sync
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(STORAGE_EVENT));
    }
  }

  const toggle = useCallback(
    (slug) => {
      const present = toggleShortlist(slug);
      setShortlist(getShortlist(validSlugs));
      notify();
      return present;
    },
    [validSlugs],
  );

  const add = useCallback(
    (slug) => {
      addToShortlist(slug);
      setShortlist(getShortlist(validSlugs));
      notify();
    },
    [validSlugs],
  );

  const remove = useCallback(
    (slug) => {
      removeFromShortlist(slug);
      setShortlist(getShortlist(validSlugs));
      notify();
    },
    [validSlugs],
  );

  const clear = useCallback(() => {
    clearShortlist();
    setShortlist([]);
    notify();
  }, []);

  const isSaved = useCallback(
    (slug) => shortlist.includes(slug),
    [shortlist],
  );

  const canCompare = shortlist.length >= 2;
  const compareExceedsMax = shortlist.length > MAX_COMPARE;

  return {
    shortlist,
    isSaved,
    toggle,
    add,
    remove,
    clear,
    canCompare,
    compareExceedsMax,
    maxCompare: MAX_COMPARE,
  };
}
