import { useCallback, useRef } from "react";
import {
    captureLandingEvent,
    typebotBlockMeta,
} from "../lib/landingAnalytics";

/**
 * Typebot lifecycle → PostHog + GTM dataLayer (no answer content / PII).
 * GTM/GA4/Reddit-friendly names: "Start Typebot Conversation", "Typebot Create Chat Message",
 * "typebot_completed". "Typebot Dify Response" is not emitted here (not exposed by @typebot.io/react embed).
 *
 * "Start Typebot Conversation" fires once on the first `onAnswer` from the embed (text submit or
 * choice/button tap, e.g. urgency buttons), not on `onInit`.
 * @param {{ homepage_layout: string }} opts
 */
export function useTypebotAnalytics(opts) {
    const { homepage_layout } = opts;
    const answerCountRef = useRef(0);
    const conversationStartedRef = useRef(false);

    const onInit = useCallback(() => {
        captureLandingEvent("landing_typebot_ready", { homepage_layout });
    }, [homepage_layout]);

    const onNewInputBlock = useCallback(
        (input) => {
            captureLandingEvent("landing_typebot_input_block", {
                homepage_layout,
                ...typebotBlockMeta(input),
            });
        },
        [homepage_layout],
    );

    const onAnswer = useCallback(
        (answer) => {
            const meta = typebotBlockMeta(answer);
            // Typebot calls onAnswer for text sends and for choice/button picks alike.
            if (!conversationStartedRef.current) {
                conversationStartedRef.current = true;
                captureLandingEvent("Start Typebot Conversation", {
                    homepage_layout,
                    ...meta,
                });
            }
            answerCountRef.current += 1;
            captureLandingEvent("landing_typebot_answer", {
                homepage_layout,
                answer_index: answerCountRef.current,
                ...meta,
            });
            captureLandingEvent("Typebot Create Chat Message", {
                homepage_layout,
                answer_index: answerCountRef.current,
                ...meta,
            });
        },
        [homepage_layout],
    );

    const onEnd = useCallback(() => {
        captureLandingEvent("typebot_completed", { homepage_layout });
    }, [homepage_layout]);

    return { onInit, onNewInputBlock, onAnswer, onEnd };
}
