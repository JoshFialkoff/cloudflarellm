import { pushConversionDataLayer } from "./conversionDataLayer";
import { captureWithExperiment } from "./posthogClient";

export const ACTION_GOALS = {
  ask_advisor_clicked: "Clicked Ask an Advisor button",
  content_search_box_clicked: "Click content search box",
  download_shortlist_clicked: "Clicked Download Shortlist button",
  top_nav_search_clicked: "Clicked top nav search button",
  about_link_clicked: "Clicked on About link",
  contact_link_clicked: "Clicked on Contact link",
};

/**
 * Emits normalized action-goal signals across PostHog + GTM/GA4.
 * Downstream tools can subscribe to `action_goal`.
 */
export function trackActionGoal(goalKey, properties = {}) {
  if (typeof window === "undefined") return;
  const action_goal_label = ACTION_GOALS[goalKey];
  if (!action_goal_label) return;

  const payload = {
    action_goal: goalKey,
    action_goal_label,
    ...properties,
  };

  captureWithExperiment("action_goal", payload);
  pushConversionDataLayer({
    event: "action_goal",
    ...payload,
  });
}
