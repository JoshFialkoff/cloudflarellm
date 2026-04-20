import { useCallback, useEffect, useRef } from "react";
import {
    captureLandingEvent,
    typebotBlockMeta,
} from "../lib/landingAnalytics";
import { pushConversionDataLayer } from "../lib/conversionDataLayer";

/**
 * Safe metadata for an answer/step, including funnel-friendly `question_index` when Typebot sends it
 * on `event.detail` (embed may use `questionIndex`, `index`, or `question_index`).
 * Never forwards answer text / labels (PII).
 * @param {unknown} block
 */
function typebotAnswerMeta(block) {
    const base = typebotBlockMeta(block);
    if (!block || typeof block !== "object") return base;
    const b = /** @type {Record<string, unknown>} */ (block);
    const qi = b.questionIndex ?? b.index ?? b.question_index;
    if (typeof qi === "number" || (typeof qi === "string" && qi !== "")) {
        base.question_index = qi;
    }
    const pc = b.percentCompleted ?? b.percent_complete;
    if (typeof pc === "number") {
        base.percent_complete = pc;
    }
    return base;
}

/**
 * Typebot lifecycle → PostHog + GTM dataLayer (no answer content / PII).
 * GTM/GA4/Reddit-friendly names: "Start Typebot Conversation", "Typebot Create Chat Message",
 * "typebot_completed". "Typebot Dify Response" is not emitted here (not exposed by @typebot.io/react embed).
 *
 * Answer events are merged from React `onAnswer` and from `window` (`typebot-answer`, `typebot-submit`)
 * so text/email/phone submits are not missed; a short dedupe window avoids double counts when both fire.
 * `typebot-end` on `window` backs `onEnd` when the embed omits the React prop (e.g. some layouts).
 * @param {{ homepage_layout: string }} opts
 */
export function useTypebotAnalytics(opts) {
    const { homepage_layout } = opts;
    const answerCountRef = useRef(0);
    const conversationStartedRef = useRef(false);
    const flowStartTimeMsRef = useRef(null);
    const stepStartTimeMsRef = useRef(null);
    const currentStepIdRef = useRef(null);
    const completedEmittedRef = useRef(false);
    const lastAnswerDedupeRef = useRef({ signature: "", at: 0 });

    const onInit = useCallback(() => {
        const now = Date.now();
        flowStartTimeMsRef.current = now;
        stepStartTimeMsRef.current = now;
        currentStepIdRef.current = null;
        completedEmittedRef.current = false;
        answerCountRef.current = 0;
        conversationStartedRef.current = false;
        lastAnswerDedupeRef.current = { signature: "", at: 0 };
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

    const processAnswerPayload = useCallback(
        (raw) => {
            const meta = typebotAnswerMeta(raw);
            const signature = JSON.stringify(meta);
            const now = Date.now();
            if (
                signature &&
                lastAnswerDedupeRef.current.signature === signature &&
                now - lastAnswerDedupeRef.current.at < 200
            ) {
                return;
            }
            lastAnswerDedupeRef.current = { signature, at: now };

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

    const onAnswer = useCallback(
        (answer) => {
            processAnswerPayload(answer);
        },
        [processAnswerPayload],
    );

    const emitCompleted = useCallback(() => {
        if (completedEmittedRef.current) return;
        completedEmittedRef.current = true;
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

    const onEnd = useCallback(() => {
        emitCompleted();
    }, [emitCompleted]);

    useEffect(() => {
        if (typeof window === "undefined") return;

        const handleWindowAnswer = (event) => {
            processAnswerPayload(event.detail);
        };

        const handleWindowEnd = () => {
            emitCompleted();
        };

        window.addEventListener("typebot-answer", handleWindowAnswer);
        window.addEventListener("typebot-submit", handleWindowAnswer);
        window.addEventListener("typebot-end", handleWindowEnd);

        return () => {
            window.removeEventListener("typebot-answer", handleWindowAnswer);
            window.removeEventListener("typebot-submit", handleWindowAnswer);
            window.removeEventListener("typebot-end", handleWindowEnd);
        };
    }, [emitCompleted, processAnswerPayload]);

    return { onInit, onNewInputBlock, onAnswer, onEnd };
}
