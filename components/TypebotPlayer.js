import { useEffect, useId, useMemo, useState } from "react";
import styles from "../styles/TypebotPlayer.module.css";
import { createHomepagePlayerAnalytics } from "../lib/homepagePlayerAnalytics";

/**
 * TypebotPlayer — renders a player-format assistant flow entirely inline,
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
    homepage_layout = "",
    analyticsMode = "homepage",
}) {
    const [currentStepId, setCurrentStepId] = useState(() =>
        resolveFirstQuestionStepId(flow),
    );
    const [answers, setAnswers] = useState({});
    const [history, setHistory] = useState([]);
    const analytics = useMemo(() => {
        if (analyticsMode !== "homepage") return null;
        return createHomepagePlayerAnalytics(
            homepage_layout,
            flow?.id ?? "unknown",
        );
    }, [analyticsMode, homepage_layout, flow?.id]);

    useEffect(() => {
        analytics?.onReady();
    }, [analytics]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset inline bot when `flow` identity changes
        setCurrentStepId(resolveFirstQuestionStepId(flow));
        setAnswers({});
        setHistory([]);
    }, [flow]);

    const stepMap = useMemo(() => {
        const map = {};
        for (const step of flow?.steps ?? []) {
            map[step.id] = step;
        }
        return map;
    }, [flow]);

    const currentStep = currentStepId ? stepMap[currentStepId] : null;

    useEffect(() => {
        if (currentStep) analytics?.onStepViewed(currentStep);
    }, [analytics, currentStep]);

    const answer = (stepId, value) => {
        const next = { ...answers, [stepId]: value };
        setAnswers(next);

        const step = stepMap[stepId];
        if (step) analytics?.onStepAnswered(step, value);
        const nextId =
            step?.branches?.[value] ??
            step?.nextStep ??
            nextStepId(stepId);

        setHistory((h) => [...h, stepId]);
        if (nextId) {
            setCurrentStepId(nextId);
        } else {
            setCurrentStepId(null);
            analytics?.onCompleted();
            if (onComplete) onComplete(next);
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

    if (!flow) return null;

    return (
        <div className={`${styles.player} ${className}`}>
            <div className={styles.header}>
                <div className={styles.avatar} aria-hidden="true">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/favicon.png"
                        alt=""
                        width={26}
                        height={26}
                        className={styles.avatarImg}
                    />
                </div>
                <div>
                    <p className={styles.eyebrow}>{flow.name}</p>
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
    const inputId = useId();
    const [draft, setDraft] = useState("");

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
                    <a
                        href={interpolate(step.cta.href, answers, prefill)}
                        className={styles.primaryBtn}
                    >
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

    const submitFreeText = () => {
        const value = draft.trim();
        if (!value) return;
        onAnswer(step.id, value);
        setDraft("");
    };

    return (
        <div className={styles.question}>
            <p className={styles.questionText}>
                {interpolate(step.text, answers, prefill)}
            </p>
            {step.freeText ? (
                <>
                    {step.isLong ? (
                        <textarea
                            id={inputId}
                            className={styles.textInput}
                            rows={4}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                        />
                    ) : (
                        <input
                            id={inputId}
                            className={styles.textInput}
                            type={step.inputType ?? "text"}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") submitFreeText();
                            }}
                        />
                    )}
                    <button
                        type="button"
                        className={styles.primaryBtn}
                        onClick={submitFreeText}
                    >
                        {step.buttonLabel ?? "Continue"}
                    </button>
                </>
            ) : (
                <div
                    className={
                        step.inputKind === "rating"
                            ? styles.ratingOptions
                            : styles.options
                    }
                >
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
            )}
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
                <a
                    href={interpolate(step.cta.href, answers, prefill)}
                    className={styles.primaryBtn}
                >
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

/** First interactive question on load (honors startStepId; skips leading message steps). */
function resolveFirstQuestionStepId(flow) {
    const steps = flow?.steps ?? [];
    if (!steps.length) return null;

    const byId = new Map(steps.map((step) => [step.id, step]));
    const seen = new Set();

    const walk = (id) => {
        if (!id || seen.has(id)) return null;
        seen.add(id);
        const step = byId.get(id);
        if (!step) return null;
        if (step.type === "question") return id;
        const idx = steps.findIndex((s) => s.id === id);
        const next = step.nextStep ?? steps[idx + 1]?.id ?? null;
        return walk(next);
    };

    if (flow?.startStepId) {
        const fromStart = walk(flow.startStepId);
        if (fromStart) return fromStart;
    }

    return steps.find((step) => step.type === "question")?.id ?? steps[0]?.id ?? null;
}

/** Replace {{variable}} tokens with answers or prefill values. */
function interpolate(text, answers, prefill) {
    if (!text) return "";
    return String(text).replace(/{{\s*([^}]+?)\s*}}/g, (_, key) => {
        const k = key.trim();
        return answers[k] ?? prefill[k] ?? "";
    });
}
