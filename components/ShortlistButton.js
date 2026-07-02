import { useCallback } from 'react';
import { useShortlist } from '../hooks/useShortlist';
import { trackShortlistAdd, trackShortlistRemove } from '../lib/shortlistAnalytics';
import styles from './ShortlistButton.module.css';

/**
 * Reusable save/unsave button that syncs with the shortlist service.
 *
 * Props:
 *   slug        — facility slug
 *   facilityId  — facility ID (for analytics)
 *   source      — where this was clicked: 'search', 'facility', 'results'
 *   variant     — 'default' | 'pill' | 'compact'
 *   labelSaved  — text when saved (default "Saved")
 *   labelSave   — text when unsaved (default "Save")
 */
export default function ShortlistButton({
  slug,
  facilityId,
  source = 'unknown',
  variant = 'default',
  labelSaved = 'Saved',
  labelSave = 'Save',
}) {
  const { isSaved, toggle } = useShortlist();

  const saved = isSaved(slug);

  const handleClick = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      const next = toggle(slug);
      if (next) {
        trackShortlistAdd({ facilityId, slug, source });
      } else {
        trackShortlistRemove({ facilityId, slug, source });
      }
    },
    [slug, facilityId, source, toggle],
  );

  const variantClass = variant === 'pill' ? styles.pill : variant === 'compact' ? styles.compact : '';

  return (
    <button
      type="button"
      className={`${styles.saveBtn} ${saved ? styles.saved : ''} ${variantClass}`}
      onClick={handleClick}
      aria-label={saved ? `Remove ${slug} from shortlist` : `Save ${slug} to shortlist`}
    >
      <span className={`${styles.icon} ${saved ? styles.iconSaved : ''}`}>
        {saved ? '♥' : '♡'}
      </span>
      {saved ? labelSaved : labelSave}
    </button>
  );
}
