import { useCallback, useMemo, useRef } from "react";  
import { captureWithExperiment } from "../lib/posthogClient";  
import {  
  isLikelyNameQuestionStep,  
  typebotInputLabel,  
} from "../lib/typebotInputLabel";

const TOTAL_STEPS = 6;

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
  const stepIndexRef = useRef(0);  
  const answerIndexRef = useRef(0);  
  const questionLabelRef = useRef("");

  const nameBlockIds = useMemo(() => parseNameBlockIds(), []);

  const onInit = useCallback(() => {  
    if (startedRef.current) return;  
    startedRef.current = true;  
    captureWithExperiment("typebot_started", {  
      utm_source: new URLSearchParams(window.location.search).get("utm_source"),  
      page: window.location.pathname,  
    });  
  }, []);

  const onNewInputBlock = useCallback((input) => {  
    const label = typebotInputLabel(input);  
    questionLabelRef.current = label;

    const stepNumber = stepIndexRef.current + 1;  
    stepIndexRef.current += 1;

    const percentComplete = Math.round((stepNumber / TOTAL_STEPS) * 100);

    captureWithExperiment("typebot_step_viewed", {  
      step_number: stepNumber,  
      total_steps: TOTAL_STEPS,  
      percent_complete: percentComplete,  
      step_label: label || undefined,  
    });  
  }, []);

  const onAnswer = useCallback(  
    ({ blockId }) => {  
      const stepIndex = answerIndexRef.current;  
      answerIndexRef.current += 1;  
      const questionLabel = questionLabelRef.current;  
      const percentComplete = Math.round(((stepIndex + 1) / TOTAL_STEPS) * 100);

      captureWithExperiment("typebot_question_answered", {  
        question_index: stepIndex,  
        question_label: questionLabel || undefined,  
        step_number: stepIndex + 1,  
        total_steps: TOTAL_STEPS,  
        percent_complete: percentComplete,  
        has_input: true,  
      });

      if (isLikelyNameQuestionStep(blockId, questionLabel, nameBlockIds)) {  
        captureWithExperiment("typebot_name_entered", {  
          question_index: stepIndex,  
          step_number: stepIndex + 1,  
        });  
      }

      if (stepIndex + 1 >= TOTAL_STEPS) {  
        captureWithExperiment("typebot_completed", {  
          total_steps: TOTAL_STEPS,  
        });  
      }  
    },  
    [nameBlockIds],  
  );

  return { onInit, onNewInputBlock, onAnswer };  
}  
