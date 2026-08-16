/**
 * Shortlist & compare analytics events.
 *
 * Fires PostHog events plus dataLayer push for GTM/GA4.
 * Uses existing `captureWithExperiment` and `pushConversionDataLayer` patterns.
 */

import { captureWithExperiment } from './posthogClient';
import { pushConversionDataLayer } from './conversionDataLayer';

export function trackShortlistAdd({ facilityId, slug, source }) {
  const props = { facilityId, slug, source };
  captureWithExperiment('shortlist_add', props);
  pushConversionDataLayer({ event: 'shortlist_add', ...props });
  // Standard Nextdoor Universal Pixel custom conversion
  try {
    import("./nextdoorUniversalPixel").then(({ trackNextdoorCustomConversion }) => {
      trackNextdoorCustomConversion("shortlist_add", props);
    });
  } catch {
    /* silent */
  }
}

export function trackShortlistRemove({ facilityId, slug, source }) {
  const props = { facilityId, slug, source };
  captureWithExperiment('shortlist_remove', props);
  pushConversionDataLayer({ event: 'shortlist_remove', ...props });
}

export function trackCompareOpen({ count, slugs }) {
  const props = { count, slugs: slugs?.join(',') };
  captureWithExperiment('compare_open', props);
  pushConversionDataLayer({ event: 'compare_open', ...props });
  // Standard Nextdoor Universal Pixel custom conversion
  try {
    import("./nextdoorUniversalPixel").then(({ trackNextdoorCustomConversion }) => {
      trackNextdoorCustomConversion("compare_open", props);
    });
  } catch {
    /* silent */
  }
}

export function trackCompareSubmitInquiry({ count, slugs }) {
  const props = { count, slugs: slugs?.join(',') };
  captureWithExperiment('compare_submit_inquiry', props);
  pushConversionDataLayer({ event: 'compare_submit_inquiry', ...props });
  // Standard Nextdoor Universal Pixel: inquiry = Lead
  try {
    import("./nextdoorUniversalPixel").then(({ trackNextdoorLead }) => {
      trackNextdoorLead({ inquiry_surface: "compare", ...props });
    });
  } catch {
    /* silent */
  }
}
