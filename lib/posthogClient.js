import posthog from "posthog-js";

export const HOMEPAGE_VIDEO_EXPERIMENT_FLAG = "homepage-video-experiment";

let clientInitStarted = false;

export function initPosthog() {
  if (typeof window === "undefined") return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || clientInitStarted) return;
  clientInitStarted = true;

  posthog.init(key, {
    api_host:
      process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: true,
    persistence: "localStorage+cookie",
    // Session replay loads canvas/worker chunks that often 404 on missing .js.map in dev.
    // Set NEXT_PUBLIC_POSTHOG_SESSION_RECORDING=1 to enable replay when you need it.
    disable_session_recording:
      process.env.NEXT_PUBLIC_POSTHOG_SESSION_RECORDING !== "1",
  });
}

export function captureWithExperiment(event, properties) {
  if (typeof window === "undefined") return;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return;

  posthog.capture(event, {
    ...properties,
    $feature_flag: HOMEPAGE_VIDEO_EXPERIMENT_FLAG,
    $feature_flag_response: posthog.getFeatureFlag(
      HOMEPAGE_VIDEO_EXPERIMENT_FLAG,
    ),
  });
}
