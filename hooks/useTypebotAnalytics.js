import { useCallback, useRef } from "react";
import {
    captureLandingEvent,
    typebotBlockMeta,
} from "../lib/landingAnalytics";

/**
 * Typebot lifecycle → PostHog + GTM dataLayer (no answer content / PII).
 * @param {{ homepage_layout: string }} opts
 */
export function useTypebotAnalytics(opts) {
    const { homepage_layout } = opts;
    const answerCountRef = useRef(0);

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
            answerCountRef.current += 1;
            captureLandingEvent("landing_typebot_answer", {
                homepage_layout,
                answer_index: answerCountRef.current,
                ...typebotBlockMeta(answer),
            });
        },
        [homepage_layout],
    );

    return { onInit, onNewInputBlock, onAnswer };
}
