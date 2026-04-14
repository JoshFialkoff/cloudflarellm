import { useCallback, useRef } from "react";
import posthog from "posthog-js";
import { captureWithExperiment } from "../lib/posthogClient";

const NAME_FIELD_REGEX = /\b(name|first name|last name|full name)\b/i;

function toStringValue(value) {
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") {
        return String(value);
    }
    return "";
}

function pickFirstString(...values) {
    for (const value of values) {
        const parsed = toStringValue(value).trim();
        if (parsed) return parsed;
    }
    return "";
}

function getBlockId(block) {
    return pickFirstString(block?.id, block?.blockId, block?.input?.id);
}

function getBlockType(block) {
    return pickFirstString(block?.type, block?.blockType, block?.input?.type);
}

function getQuestionText(answerPayload) {
    return pickFirstString(
        answerPayload?.question,
        answerPayload?.block?.content,
        answerPayload?.block?.title,
        answerPayload?.block?.label,
        answerPayload?.label,
    );
}

function getAnswerValue(answerPayload) {
    return pickFirstString(
        answerPayload?.answer,
        answerPayload?.value,
        answerPayload?.text,
        answerPayload?.content,
    );
}

function getAnswerBlockId(answerPayload) {
    return pickFirstString(
        answerPayload?.block_id,
        answerPayload?.blockId,
        answerPayload?.block?.id,
    );
}

export function useTypebotAnalytics() {
    const flowStartTimeMsRef = useRef(null);
    const stepStartTimeMsRef = useRef(null);
    const currentStepIdRef = useRef(null);

    const handleInit = useCallback(() => {
        const now = Date.now();
        flowStartTimeMsRef.current = now;
        stepStartTimeMsRef.current = now;
        currentStepIdRef.current = null;
        captureWithExperiment("typebot_started");
    }, []);

    const handleNewInputBlock = useCallback((block) => {
        const now = Date.now();
        const previousStepId = currentStepIdRef.current;
        const previousStepStartedAt = stepStartTimeMsRef.current;

        if (previousStepId && previousStepStartedAt) {
            const secondsSpent = Math.max(0, (now - previousStepStartedAt) / 1000);
            captureWithExperiment("typebot_step_time_spent", {
                step_id: previousStepId,
                seconds_spent: Number(secondsSpent.toFixed(2)),
            });
        }

        const stepId = getBlockId(block);
        const stepType = getBlockType(block);
        captureWithExperiment("typebot_step_viewed", {
            step_id: stepId,
            step_type: stepType,
        });

        currentStepIdRef.current = stepId || null;
        stepStartTimeMsRef.current = now;
    }, []);

    const handleAnswer = useCallback((answerPayload) => {
        const answer = getAnswerValue(answerPayload);
        const question = getQuestionText(answerPayload);
        const blockId = getAnswerBlockId(answerPayload);

        captureWithExperiment("typebot_question_answered", {
            question,
            block_id: blockId,
            answer_length: answer.length,
        });

        const nameSignal = `${question} ${blockId}`.trim();
        if (answer && NAME_FIELD_REGEX.test(nameSignal)) {
            captureWithExperiment("typebot_name_entered", {
                answer_length: answer.length,
            });
            posthog.setPersonProperties({ typebot_name: answer });
        }
    }, []);

    const handleComplete = useCallback(() => {
        const now = Date.now();
        const startedAt = flowStartTimeMsRef.current;
        const totalTimeSeconds =
            startedAt != null ? Math.max(0, (now - startedAt) / 1000) : 0;

        captureWithExperiment("typebot_completed", {
            total_time_seconds: Number(totalTimeSeconds.toFixed(2)),
        });
    }, []);

    return {
        handleInit,
        handleNewInputBlock,
        handleAnswer,
        handleComplete,
    };
}
