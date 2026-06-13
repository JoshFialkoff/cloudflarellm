import { captureLandingEvent } from "./landingAnalytics";
import { pushConversionDataLayer } from "./conversionDataLayer";
import {
    trackChatCompleted,
    trackChatStarted,
    trackMessageSent,
} from "./chatAnalytics";

const DEDUPE_MS = 250;

/**
 * Shared bot / assistant analytics for PostHog + GTM/GA4.
 * Routes through captureLandingEvent (PostHog + dataLayer) and
 * pushConversionDataLayer (GTM + optional direct gtag).
 */
export function createBotAnalytics({
    bot_id = "unknown",
    assistant_mode = "player_local",
    surface = "bot_page",
    homepage_layout = "",
    lead_source = "",
} = {}) {
    const firedLabels = new Set();
    let conversationStarted = false;
    let completed = false;
    let answerIndex = 0;
    let lastDedupe = { key: "", at: 0 };

    const baseProps = () => ({
        ...(homepage_layout ? { homepage_layout } : {}),
        assistant_mode,
        bot_id,
        bot_surface: surface,
        ...(lead_source ? { lead_source } : {}),
    });

    function dedupe(key) {
        const now = Date.now();
        if (lastDedupe.key === key && now - lastDedupe.at < DEDUPE_MS) {
            return true;
        }
        lastDedupe = { key, at: now };
        return false;
    }

    function onReady(extra = {}) {
        if (dedupe("ready")) return;
        captureLandingEvent("landing_typebot_ready", {
            ...baseProps(),
            ...extra,
        });
        trackChatStarted({ ...baseProps(), ...extra });
    }

    function onStepViewed(stepOrId, extra = {}) {
        const step_id =
            typeof stepOrId === "string"
                ? stepOrId
                : stepOrId?.id ?? stepOrId?.step_id;
        const step_type =
            typeof stepOrId === "object" && stepOrId != null
                ? stepOrId.type ?? stepOrId.step_type
                : extra.step_type;
        if (!step_id || dedupe(`view:${step_id}`)) return;
        captureLandingEvent("typebot_step_viewed", {
            ...baseProps(),
            step_id,
            ...(step_type ? { step_type } : {}),
            ...extra,
        });
    }

    function onStepAnswered(stepOrId, extra = {}) {
        const step_id =
            typeof stepOrId === "string"
                ? stepOrId
                : stepOrId?.id ?? stepOrId?.step_id;
        if (!step_id) return;

        const dedupeKey = `answer:${step_id}:${String(extra.answer_kind ?? "default")}`;
        if (dedupe(dedupeKey)) return;

        if (!conversationStarted) {
            conversationStarted = true;
            captureLandingEvent("Start Typebot Conversation", {
                ...baseProps(),
                step_id,
            });
        }

        answerIndex += 1;
        trackMessageSent({
            ...baseProps(),
            message_index: answerIndex - 1,
            step_id,
            answer_kind: extra.answer_kind,
            step_type: extra.step_type,
            message_preview: extra.message_preview,
            percent_complete: extra.percent_complete,
        });

        const gaLabel =
            (typeof stepOrId === "object" && stepOrId?.gaLabel?.trim()) ||
            extra.conversion_label?.trim();
        if (gaLabel && !firedLabels.has(gaLabel)) {
            firedLabels.add(gaLabel);
            pushConversionDataLayer({
                event: "typebot_conversion",
                conversion_label: gaLabel,
                step_id,
                bot_id,
                lead_source: lead_source || `${surface}_${assistant_mode}`,
            });
        }
    }

    function onCompleted(extra = {}) {
        if (completed || dedupe("completed")) return;
        completed = true;
        trackChatCompleted({
            ...baseProps(),
            ...extra,
        });
    }

    return { onReady, onStepViewed, onStepAnswered, onCompleted };
}

/** Homepage TypebotPlayer (in-house player JSON). */
export function createHomepagePlayerAnalytics(homepage_layout, bot_id) {
    return createBotAnalytics({
        bot_id,
        assistant_mode: "player_local",
        surface: "homepage",
        homepage_layout,
        lead_source: "homepage_player_assistant",
    });
}

/** Homepage AssistedlyWizard (Dify / native chat). */
export function createWizardAnalytics(homepage_layout) {
    return createBotAnalytics({
        bot_id: "homepage-assistedly-wizard",
        assistant_mode: "assistedly_wizard",
        surface: "homepage",
        homepage_layout,
        lead_source: "homepage_wizard_assistant",
    });
}

/** Standalone /bots/[slug] player pages. */
export function createBotPageAnalytics(bot_id) {
    return createBotAnalytics({
        bot_id,
        assistant_mode: "player_local",
        surface: "bot_page",
        lead_source: "bot_page_player",
    });
}
