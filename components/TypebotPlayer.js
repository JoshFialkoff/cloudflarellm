import { useMemo, useState } from "react";
import styles from "../styles/TypebotPlayer.module.css";
import { captureLandingEvent } from "../lib/landingAnalytics";

/**
 * TypebotPlayer — renders a player-format Typebot flow entirely inline,
 * one step at a time, matching the Assistedly brand.
 *
 * Player flow format:
 * {
 *   id: "my-bot",
 *   name: "Bot name",
 *   steps: [
 *     {
 *       id: "q1",
 *       type: "question",          // "question" | "message" | "result"
 *       text: "Question text",
 *       options: [                 // only for "question"
 *         { value: "yes", label: "Yes" },
 *         { value: "no",  label: "No" },
 *       ],
 *       // Optional: jump to a specific step id based on answer
 *       nextStep: "q2",            // default: advance to next index
 *       branches: {                // optional per-answer overrides
 *         "yes": "q2",
 *         "no":  "q3",
 *       },
 *     },
 *     {
 *       id: "result_low",
 *       type: "result",
 *       text: "Result text or plan",
 *       items: ["Action 1", "Action 2"],  // optional list
 *       cta: { label: "Next step", href: "/" },
 *     },
 *   ]
 * }
 */
export default function TypebotPlayer({
    flow,
    prefill = {},
    onComplete,
    className = "",
}) {
    const [currentStepId, setCurrentStepId] = useState(
        () => flow?.steps?.[0]?.id ?? null,
    );
    const [answers, setAnswers] = useState({});
    const [history, setHistory] = useState([]);

    const stepMap = useMemo(() => {
        const map = {};
        for (const step of flow?.steps ?? []) {
            map[step.id] = step;
        }
        return map;
    }, [flow]);

    const currentStep = currentStepId ? stepMap[currentStepId] : null;

    const answer = (stepId, value) => {
        const next = { ...answers, [stepId]: value };
        setAnswers(next);
        captureLandingEvent("typebot_player_answered", {
            bot_id: flow?.id ?? "unknown",
            step_id: stepId,
            answer_value: value,
        });

        const step = stepMap[stepId];
        const nextId =
            step?.branches?.[value] ??
            step?.nextStep ??
            nextStepId(stepId);

        setHistory((h) => [...h, stepId]);
        if (nextId) {
            setCurrentStepId(nextId);
        } else {
            setCurrentStepId(null);
            if (onComplete) onComplete(next);
            captureLandingEvent("typebot_player_completed", {
                bot_id: flow?.id ?? "unknown",
            });
        }
    };

    const goBack = () => {
        if (!history.length) return;
        const prev = history[history.length - 1];
        setHistory((h) => h.slice(0, -1));
        setCurrentStepId(prev);
    };

    const nextStepId = (stepId) => {
        const idx = (flow?.steps ?? []).findIndex((s) => s.id === stepId);
        return flow?.steps?.[idx + 1]?.id ?? null;
    };

    const total = (flow?.steps ?? []).filter(
        (s) => s.type === "question",
    ).length;
    const answered = history.filter(
        (id) => stepMap[id]?.type === "question",
    ).length;

    if (!flow) return null;

    return (
        <div className={`${styles.player} ${className}`}>
            <div className={styles.header}>
                <div className={styles.avatar} aria-hidden="true">AI</div>
                <div>
                    <p className={styles.eyebrow}>{flow.name}</p>
                    {currentStep && currentStep.type !== "result" && total > 1 ? (
                        <p className={styles.progress}>
                            Question {answered + 1} of {total}
                        </p>
                    ) : null}
                </div>
            </div>

            <div className={styles.body} aria-live="polite">
                {currentStep ? (
                    <Step
                        step={currentStep}
                        answers={answers}
                        onAnswer={answer}
                        onBack={history.length > 0 ? goBack : null}
                        prefill={prefill}
                    />
                ) : (
                    <div className={styles.done}>
                        <p>All done — your answers have been recorded.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function Step({ step, answers, onAnswer, onBack, prefill }) {
    if (step.type === "message") {
        return (
            <div className={styles.message}>
                <p>{interpolate(step.text, answers, prefill)}</p>
                <button
                    type="button"
                    className={styles.primaryBtn}
                    onClick={() => onAnswer(step.id, "continue")}
                >
                    {step.buttonLabel ?? "Continue"}
                </button>
            </div>
        );
    }

    if (step.type === "result") {
        return (
            <div className={styles.result}>
                <h3>{step.title ?? "Your personalised plan"}</h3>
                {step.text ? <p>{interpolate(step.text, answers, prefill)}</p> : null}
                {step.items?.length ? (
                    <ol className={styles.resultList}>
                        {step.items.map((item, i) => (
                            <li key={i}>{interpolate(item, answers, prefill)}</li>
                        ))}
                    </ol>
                ) : null}
                {step.cta ? (
                    <a href={step.cta.href} className={styles.primaryBtn}>
                        {step.cta.label}
                    </a>
                ) : null}
                {onBack ? (
                    <button type="button" className={styles.backBtn} onClick={onBack}>
                        Back
                    </button>
                ) : null}
            </div>
        );
    }

    // default: "question"
    return (
        <div className={styles.question}>
            <p className={styles.questionText}>
                {interpolate(step.text, answers, prefill)}
            </p>
            <div className={styles.options}>
                {(step.options ?? []).map((opt) => (
                    <button
                        key={opt.value}
                        type="button"
                        className={
                            answers[step.id] === opt.value
                                ? styles.optionActive
                                : styles.option
                        }
                        onClick={() => onAnswer(step.id, opt.value)}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
            {onBack ? (
                <button type="button" className={styles.backBtn} onClick={onBack}>
                    Back
                </button>
            ) : null}
        </div>
    );
}

/** Replace {{variable}} tokens with answers or prefill values. */
function interpolate(text, answers, prefill) {
    if (!text) return "";
    return String(text).replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
        return answers[key] ?? prefill[key] ?? "";
    });
}
