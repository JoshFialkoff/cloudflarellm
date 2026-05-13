import { useEffect, useMemo, useState } from "react";
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
 *       // Optional streaming (reads prompts from matching typebots/<flow.id>.dsl)
 *       stream: true,
 *       streamEndpoint: "/api/bots/llm-stream",
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
        <div className={`${styles.player} ${className}`.trim()}>
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
                        flow={flow}
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

function Step({ step, flow, answers, onAnswer, onBack, prefill }) {
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
        if (step.stream) {
            return (
                <StreamingResultStep
                    key={streamingSessionKey(flow?.id, answers, prefill)}
                    step={step}
                    flow={flow}
                    answers={answers}
                    prefill={prefill}
                    onBack={onBack}
                />
            );
        }
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
                    <a href={interpolate(step.cta.href, answers, prefill)} className={styles.primaryBtn}>
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

function streamingSessionKey(flowId, answers, prefill) {
    try {
        return JSON.stringify({
            id: flowId ?? "",
            answers,
            prefill: prefill ?? {},
        });
    } catch {
        return String(flowId ?? "");
    }
}

function buildAnswersSummary(flow, answers, prefill) {
    const lines = [];
    for (const s of flow?.steps ?? []) {
        if (s.type !== "question") continue;
        const value = answers[s.id];
        if (!value) continue;
        const label =
            s.options?.find((o) => o.value === value)?.label ?? value;
        lines.push(`${s.text} ${label}`);
    }
    const extras = [];
    if (prefill?.care_type)
        extras.push(`Care type (from link): ${prefill.care_type}`);
    if (prefill?.region) extras.push(`Region (from link): ${prefill.region}`);
    if (prefill?.monthly_budget)
        extras.push(`Monthly budget (from link): ${prefill.monthly_budget}`);
    if (prefill?.estimated_low || prefill?.estimated_high) {
        extras.push(
            `Estimate range (from link): ${prefill.estimated_low ?? "?"} – ${prefill.estimated_high ?? "?"}`,
        );
    }
    if (extras.length) lines.push("", ...extras);
    return lines.join("\n");
}

function StreamingResultStep({ step, flow, answers, prefill, onBack }) {
    const [streamed, setStreamed] = useState("");
    const [phase, setPhase] = useState("loading");

    useEffect(() => {
        const endpoint = step.streamEndpoint ?? "/api/bots/llm-stream";
        const slug = flow?.id ?? "";
        const answersText = buildAnswersSummary(flow, answers, prefill);
        const ac = new AbortController();

        (async () => {
            try {
                const res = await fetch(endpoint, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ slug, answersText }),
                    signal: ac.signal,
                });

                if (!res.ok) {
                    setPhase("fallback");
                    return;
                }

                const ctype = res.headers.get("content-type") ?? "";
                if (!ctype.includes("text/event-stream") || !res.body) {
                    setPhase("fallback");
                    return;
                }

                setPhase("streaming");
                const reader = res.body.getReader();
                const decoder = new TextDecoder();
                let buffer = "";
                let text = "";
                let readResult = await reader.read();
                while (!readResult.done) {
                    buffer += decoder.decode(readResult.value, { stream: true });
                    const parts = buffer.split(/\r?\n/);
                    buffer = parts.pop() ?? "";
                    for (const line of parts) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === "data: [DONE]") continue;
                        if (!trimmed.startsWith("data: ")) continue;
                        try {
                            const json = JSON.parse(trimmed.slice(6));
                            const piece =
                                json.choices?.[0]?.delta?.content ?? "";
                            if (piece) {
                                text += piece;
                                setStreamed(text);
                            }
                        } catch {
                            // ignore malformed SSE lines
                        }
                    }
                    readResult = await reader.read();
                }
                if (buffer.trim()) {
                    const trimmed = buffer.trim();
                    if (trimmed.startsWith("data: ") && trimmed !== "data: [DONE]") {
                        try {
                            const json = JSON.parse(trimmed.slice(6));
                            const piece = json.choices?.[0]?.delta?.content ?? "";
                            if (piece) {
                                text += piece;
                                setStreamed(text);
                            }
                        } catch {
                            // ignore
                        }
                    }
                }
                if (!text.trim()) {
                    setPhase("fallback");
                } else {
                    setPhase("done");
                }
            } catch (e) {
                if (e?.name === "AbortError") return;
                setPhase("fallback");
            }
        })();

        return () => {
            ac.abort();
        };
    }, [flow, answers, prefill, step.stream, step.streamEndpoint]);

    const showFallback = phase === "fallback";
    const showStream = phase === "streaming" || phase === "done";

    return (
        <div className={styles.result}>
            <h3>{step.title ?? "Your personalised plan"}</h3>
            {step.text ? <p>{interpolate(step.text, answers, prefill)}</p> : null}
            {phase === "loading" ? (
                <p className={styles.streamStatus}>Streaming your guidance…</p>

            ) : null}
            {showStream && streamed ? (
                <div className={styles.streamBody}>{streamed}</div>
            ) : null}
            {showFallback && step.items?.length ? (
                <ol className={styles.resultList}>
                    {step.items.map((item, i) => (
                        <li key={i}>{interpolate(item, answers, prefill)}</li>
                    ))}
                </ol>
            ) : null}
            {step.cta ? (
                <a href={interpolate(step.cta.href, answers, prefill)} className={styles.primaryBtn}>
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


function interpolate(text, answers, prefill) {
    if (!text) return "";
    return String(text).replace(/{{\s*([\w.]+)\s*}}/g, (_, key) => {
        return answers[key] ?? prefill[key] ?? "";
    });
}
