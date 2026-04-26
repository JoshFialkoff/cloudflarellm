import posthog from "posthog-js";
import { getSessionMarketingAttribution } from "./marketingAttribution";

export const HOMEPAGE_VIDEO_EXPERIMENT_FLAG = "homepage-video-experiment";

let clientInitStarted = false;

export function initPosthog() {
  if (typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || clientInitStarted) return;
  clientInitStarted = true;

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest",
    ui_host: "https://us.posthog.com",
    defaults: "2026-01-30",
    capture_pageview: true,
    persistence: "localStorage+cookie",
    // Session replay loads rrweb workers; in Next dev (Turbopack) their source maps
    // often 404 as GET /image-bitmap-data-url-worker-*.js.map — harmless but noisy.
    disable_session_recording: process.env.NODE_ENV === "development",
    session_recording: {
      recordConsoleLog: true,
    },
    loaded: (ph) => {
      const touch = getSessionMarketingAttribution();
      if (Object.keys(touch).length) ph.register(touch);
      if (process.env.NODE_ENV === "development") ph.debug();
    },
  });
}

export function captureWithExperiment(event, properties) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  const touch = getSessionMarketingAttribution();

  posthog.capture(event, {
    ...touch,
    ...properties,
    $feature_flag: HOMEPAGE_VIDEO_EXPERIMENT_FLAG,
    $feature_flag_response: posthog.getFeatureFlag(
      HOMEPAGE_VIDEO_EXPERIMENT_FLAG,
    ),
  });
}
