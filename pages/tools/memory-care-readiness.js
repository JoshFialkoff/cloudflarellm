import { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import styles from "../../styles/Tools.module.css";
import { captureLandingEvent } from "../../lib/landingAnalytics";

const QUESTIONS = [
    {
        id: "wandering",
        label: "Wandering or exit-seeking",
        helper: "They try to leave home, get lost, or need secured exits.",
        weight: 4,
    },
    {
        id: "overnight",
        label: "Unsafe overnight or when alone",
        helper: "They wake confused, leave appliances on, fall, or cannot be safely unsupervised.",
        weight: 4,
    },
    {
        id: "medication",
        label: "Medication or medical routine is breaking down",
        helper: "Missed doses, duplicate doses, insulin/oxygen complexity, or frequent urgent calls.",
        weight: 3,
    },
    {
        id: "falls",
        label: "Falls, transfers, or mobility risks are increasing",
        helper: "Recent falls, trouble bathing/toileting, or needing two-person help.",
        weight: 3,
    },
    {
        id: "behavior",
        label: "Dementia behaviors are hard to redirect",
        helper: "Agitation, delusions, repeated calls, resistance to care, or unsafe decisions.",
        weight: 3,
    },
    {
        id: "caregiver",
        label: "The caregiver is reaching burnout",
        helper: "Sleep loss, health decline, missed work, or constant crisis management.",
        weight: 3,
    },
    {
        id: "nutrition",
        label: "Meals, hydration, or hygiene need daily prompting",
        helper: "Weight loss, spoiled food, skipped bathing, or incontinence support.",
        weight: 2,
    },
    {
        id: "social",
        label: "Isolation or loss of structure is accelerating decline",
        helper: "They need cueing, activities, or a supervised daily routine.",
        weight: 1,
    },
];

const LEVELS = {
    low: {
        title: "Home support or assisted living may still fit",
        summary:
            "The signals you selected suggest the next step may be more structure, scheduled help, or assisted living rather than a secured memory care unit.",
        cta: "Compare assisted living options",
        entry: "assisted-living-readiness",
    },
    moderate: {
        title: "Start evaluating memory care now",
        summary:
            "There are enough safety or care-complexity signals that you should tour memory care programs and ask detailed staffing, medication, and elopement questions.",
        cta: "Find memory care matches",
        entry: "memory-care-readiness",
    },
    high: {
        title: "Prioritize secured memory care and safety planning",
        summary:
            "The pattern points to urgent supervision and dementia-trained staffing needs. Ask about secured exits, overnight coverage, incident reporting, and discharge triggers before choosing a community.",
        cta: "Get urgent memory care guidance",
        entry: "urgent-memory-care",
    },
};

function getLevel(score) {
    if (score >= 12) return LEVELS.high;
    if (score >= 6) return LEVELS.moderate;
    return LEVELS.low;
}

export default function MemoryCareReadinessPage() {
    const [selected, setSelected] = useState(() => new Set(["wandering", "caregiver"]));

    const result = useMemo(() => {
        const score = QUESTIONS.reduce(
            (sum, question) => sum + (selected.has(question.id) ? question.weight : 0),
            0,
        );
        const active = QUESTIONS.filter((question) => selected.has(question.id));
        return { score, active, level: getLevel(score) };
    }, [selected]);

    const toggleQuestion = (id) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const matchHref = {
        pathname: "/",
        query: {
            typebot_entry: result.level.entry,
            care_type: result.score >= 6 ? "memory-care" : "assisted-living",
            readiness_score: String(result.score),
            safety_signals: result.active.map((question) => question.id).join(","),
            utm_source: "readiness_quiz",
            utm_medium: "tool",
            utm_campaign: "memory_care_readiness",
        },
        hash: "assistant",
    };

    const handleCta = () => {
        captureLandingEvent("memory_care_readiness_cta_clicked", {
            readiness_score: result.score,
            readiness_level: result.level.entry,
            selected_signal_count: result.active.length,
        });
    };

    return (
        <>
            <Head>
                <title>Memory Care Readiness Quiz | Assistedly</title>
                <meta
                    name="description"
                    content="Answer a few safety and caregiving questions to decide whether assisted living or memory care may fit your loved one in Massachusetts."
                />
            </Head>

            <main className={styles.toolPage}>
                <section className={styles.toolHero}>
                    <div className={styles.toolHeroCopy}>
                        <p className={styles.kicker}>Massachusetts Senior Care Tools</p>
                        <h1>Is it time to look at memory care?</h1>
                        <p>
                            Access our unique AI tools to find best assisted living &amp; memory
                            care in Massachusetts, then map your signals to a practical next step.
                        </p>
                    </div>
                    <div className={styles.resultCard} aria-live="polite">
                        <span className={styles.resultLabel}>Readiness score</span>
                        <strong>{result.score}</strong>
                        <p>{result.level.title}</p>
                    </div>
                </section>

                <section className={styles.toolGrid} aria-label="Memory care readiness quiz">
                    <form className={styles.panel}>
                        <h2>What is happening right now?</h2>
                        <div className={styles.checkGrid}>
                            {QUESTIONS.map((question) => (
                                <label key={question.id} className={styles.checkCard}>
                                    <input
                                        type="checkbox"
                                        checked={selected.has(question.id)}
                                        onChange={() => toggleQuestion(question.id)}
                                    />
                                    <span>
                                        <strong>{question.label}</strong>
                                        <small>{question.helper}</small>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </form>

                    <aside className={styles.panel}>
                        <h2>{result.level.title}</h2>
                        <p className={styles.largeText}>{result.level.summary}</p>

                        <div className={styles.summaryList}>
                            <h3>Bring these topics to tours</h3>
                            <ul>
                                {result.active.length ? (
                                    result.active.slice(0, 5).map((question) => (
                                        <li key={question.id}>{question.label}</li>
                                    ))
                                ) : (
                                    <li>Daily routine, medication support, and staff coverage.</li>
                                )}
                            </ul>
                        </div>

                        <div className={styles.callout}>
                            <strong>Ask every memory care program:</strong>
                            <p>
                                How many dementia-trained staff are on overnight, what triggers an
                                incident call, and how do you prevent elopement?
                            </p>
                        </div>

                        <Link
                            className={styles.primaryCta}
                            href={matchHref}
                            onClick={handleCta}
                        >
                            {result.level.cta}
                        </Link>
                        <Link className={styles.secondaryCta} href="/tools/cost-calculator">
                            Estimate monthly cost first
                        </Link>
                    </aside>
                </section>
            </main>
        </>
    );
}
