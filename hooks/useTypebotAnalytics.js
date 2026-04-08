import { useCallback, useMemo, useRef } from "react";
import { captureWithExperiment } from "../lib/posthogClient";
import {
  isLikelyNameQuestionStep,
  typebotInputLabel,
} from "../lib/typebotInputLabel";

function parseNameBlockIds() {
  const raw = process.env.NEXT_PUBLIC_TYPEBOT_NAME_BLOCK_IDS || "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function useTypebotAnalytics() {
  const startedRef = useRef(false);
  const answerIndexRef = useRef(0);
  const questionLabelRef = useRef("");

  const nameBlockIds = useMemo(() => parseNameBlockIds(), []);

  const onInit = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    captureWithExperiment("typebot_started", {
      utm_source: new URLSearchParams(window.location.search).get(
        "utm_source",
      ),
      page: window.location.pathname,
    });
  }, []);

  const onNewInputBlock = useCallback((input) => {
    questionLabelRef.current = typebotInputLabel(input);
  }, []);

  const onAnswer = useCallback(
    ({ blockId }) => {
      const stepIndex = answerIndexRef.current;
      answerIndexRef.current += 1;
      const questionLabel = questionLabelRef.current;

      captureWithExperiment("typebot_question_answered", {
        question_index: stepIndex,
        question_label: questionLabel || undefined,
        has_input: true,
      });

      if (
        isLikelyNameQuestionStep(blockId, questionLabel, nameBlockIds)
      ) {
        captureWithExperiment("typebot_name_entered", {
          question_index: stepIndex,
        });
      }
    },
    [nameBlockIds],
  );

  return { onInit, onNewInputBlock, onAnswer };
}
