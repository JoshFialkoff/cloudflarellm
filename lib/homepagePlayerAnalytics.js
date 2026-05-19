import { captureLandingEvent } from "./landingAnalytics";
import { pushConversionDataLayer } from "./conversionDataLayer";

const DEDUPE_MS = 250;

/**
 * In-house homepage player analytics — routes through existing GTM/PostHog
 * (captureLandingEvent + pushConversionDataLayer). Does NOT replay Typebot
 * builder "Google Analytics" blocks (no direct gtag to legacy GA or Ads IDs).
 */
export function createHomepagePlayerAnalytics(homepage_layout, bot_id) {
    const firedLabels = new Set();
    let conversationStarted = false;
    let completed = false;
    let answerIndex = 0;
    let lastDedupe = { key: "", at: 0 };

    function dedupe(key) {
        const now = Date.now();
        if (lastDedupe.key === key && now - lastDedupe.at < DEDUPE_MS) {
            return true;
        }
        lastDedupe = { key, at: now };
        return false;
    }

    function onReady() {
        if (dedupe("ready")) return;
        captureLandingEvent("landing_typebot_ready", {
            homepage_layout,
            assistant_mode: "player_local",
            bot_id,
        });
        captureLandingEvent("typebot_started", {
            homepage_layout,
            assistant_mode: "player_local",
            bot_id,
        });
    }

    function onStepViewed(step) {
        if (!step?.id || dedupe(`view:${step.id}`)) return;
        captureLandingEvent("typebot_step_viewed", {
            homepage_layout,
            assistant_mode: "player_local",
            bot_id,
            step_id: step.id,
            step_type: step.type,
        });
    }

    function onStepAnswered(step, value) {
        if (!step?.id) return;
        const dedupeKey = `answer:${step.id}:${String(value).slice(0, 32)}`;
        if (dedupe(dedupeKey)) return;

        if (!conversationStarted) {
            conversationStarted = true;
            captureLandingEvent("Start Typebot Conversation", {
                homepage_layout,
                assistant_mode: "player_local",
                bot_id,
                step_id: step.id,
            });
        }

        answerIndex += 1;
        captureLandingEvent("typebot_answer_submitted", {
            homepage_layout,
            assistant_mode: "player_local",
            bot_id,
            step_id: step.id,
            answer_index: answerIndex,
        });
        captureLandingEvent("typebot_step_completed", {
            homepage_layout,
            assistant_mode: "player_local",
            bot_id,
            step_id: step.id,
            answer_index: answerIndex,
        });

        const gaLabel = step.gaLabel?.trim();
        if (gaLabel && !firedLabels.has(gaLabel)) {
            firedLabels.add(gaLabel);
            pushConversionDataLayer({
                event: "typebot_conversion",
                conversion_label: gaLabel,
                step_id: step.id,
                bot_id,
                lead_source: "homepage_player_assistant",
            });
        }
    }

    function onCompleted() {
        if (completed || dedupe("completed")) return;
        completed = true;
        captureLandingEvent("typebot_completed", {
            homepage_layout,
            assistant_mode: "player_local",
            bot_id,
        });
        pushConversionDataLayer({
            event: "typebot_completed",
            lead_source: "homepage_player_assistant",
            bot_id,
        });
    }

    return { onReady, onStepViewed, onStepAnswered, onCompleted };
}
