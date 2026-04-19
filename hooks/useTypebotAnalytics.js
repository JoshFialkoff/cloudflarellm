import { useCallback, useRef } from "react";
import {
    captureLandingEvent,
    typebotBlockMeta,
} from "../lib/landingAnalytics";
import { pushConversionDataLayer } from "../lib/conversionDataLayer";

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
    const flowStartTimeMsRef = useRef(null);
    const stepStartTimeMsRef = useRef(null);
    const currentStepIdRef = useRef(null);

    const onInit = useCallback(() => {
        const now = Date.now();
        flowStartTimeMsRef.current = now;
        stepStartTimeMsRef.current = now;
        currentStepIdRef.current = null;
        captureLandingEvent("landing_typebot_ready", { homepage_layout });
        captureLandingEvent("typebot_started", { homepage_layout });
    }, [homepage_layout]);

    const onNewInputBlock = useCallback(
        (input) => {
            const now = Date.now();
            const previousStepId = currentStepIdRef.current;
            const previousStepStartedAt = stepStartTimeMsRef.current;

            if (previousStepId && previousStepStartedAt) {
                const secondsSpent = Math.max(
                    0,
                    (now - previousStepStartedAt) / 1000,
                );
                captureLandingEvent("typebot_step_time_spent", {
                    homepage_layout,
                    step_id: previousStepId,
                    seconds_spent: Number(secondsSpent.toFixed(2)),
                });
            }

            const meta = typebotBlockMeta(input);
            captureLandingEvent("landing_typebot_input_block", {
                homepage_layout,
                ...meta,
            });
            const stepId =
                meta.id != null && meta.id !== ""
                    ? String(meta.id)
                    : null;
            const stepType =
                meta.type != null && meta.type !== ""
                    ? String(meta.type)
                    : "";
            captureLandingEvent("typebot_step_viewed", {
                homepage_layout,
                step_id: stepId ?? "",
                step_type: stepType,
            });

            currentStepIdRef.current = stepId;
            stepStartTimeMsRef.current = now;
        },
        [homepage_layout],
    );

    const onAnswer = useCallback(
        (answer) => {
            const meta = typebotBlockMeta(answer);
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
            captureLandingEvent("typebot_question_answered", {
                homepage_layout,
                answer_index: answerCountRef.current,
                ...meta,
            });
        },
        [homepage_layout],
    );

    const onEnd = useCallback(() => {
        const now = Date.now();
        const startedAt = flowStartTimeMsRef.current;
        const totalSeconds =
            startedAt != null
                ? Number(Math.max(0, (now - startedAt) / 1000).toFixed(2))
                : 0;

        captureLandingEvent("typebot_completed", {
            homepage_layout,
            total_time_seconds: totalSeconds,
        });
        pushConversionDataLayer({
            event: "typebot_completed",
            lead_source: "typebot_assistant",
            total_time_seconds: totalSeconds,
        });
    }, [homepage_layout]);

    return { onInit, onNewInputBlock, onAnswer, onEnd };
}
