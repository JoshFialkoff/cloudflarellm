import { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import styles from "../../styles/Tools.module.css";
import { captureLandingEvent } from "../../lib/landingAnalytics";

const CARE_TYPES = {
    assisted: {
        label: "Assisted living",
        low: 5500,
        high: 7600,
        copy: "Best for help with daily activities, meals, medication reminders, and social support.",
    },
    memory: {
        label: "Memory care",
        low: 7800,
        high: 12500,
        copy: "Best when dementia symptoms require secure space, cueing, redirection, and trained staff.",
    },
    skilled: {
        label: "Skilled nursing",
        low: 13000,
        high: 16500,
        copy: "Best when 24/7 licensed nursing or rehab-level care is needed.",
    },
};

const REGIONS = {
    boston: { label: "Boston / inner suburbs", multiplier: 1.18 },
    metroWest: { label: "MetroWest / North Shore / South Shore", multiplier: 1.08 },
    central: { label: "Central Massachusetts", multiplier: 0.96 },
    western: { label: "Western Massachusetts", multiplier: 0.9 },
};

const BUDGET_MIN = 4000;
const BUDGET_MAX = 18000;

const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
});

function clampNumber(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function budgetPercent(value) {
    const clamped = Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, value));
    return ((clamped - BUDGET_MIN) / (BUDGET_MAX - BUDGET_MIN)) * 100;
}

function buildAssistantHref(state, estimate) {
    const params = new URLSearchParams({
        typebot_entry: "cost_calculator",
        campaign_segment: "cost-planning",
        care_type: state.careType,
        region: state.region,
        monthly_budget: String(state.budget),
        estimated_low: String(estimate.low),
        estimated_high: String(estimate.high),
    });
    return `/?${params.toString()}#assistant`;
}

export default function CostCalculatorPage() {
    const [state, setState] = useState({
        careType: "memory",
        region: "boston",
        medication: true,
        incontinence: false,
        mobility: true,
        budget: 9000,
    });

    const estimate = useMemo(() => {
        const care = CARE_TYPES[state.careType];
        const region = REGIONS[state.region];
        let addLow = 0;
        let addHigh = 0;
        if (state.medication) {
            addLow += 300;
            addHigh += 900;
        }
        if (state.incontinence) {
            addLow += 250;
            addHigh += 850;
        }
        if (state.mobility) {
            addLow += 500;
            addHigh += 1400;
        }
        const low = Math.round((care.low + addLow) * region.multiplier);
        const high = Math.round((care.high + addHigh) * region.multiplier);
        const gap = Math.max(0, low - state.budget);
        return {
            low,
            high,
            gap,
            withinBudget: state.budget >= low,
            care,
            region,
        };
    }, [state]);

    const assistantHref = buildAssistantHref(state, estimate);
    const estimateLowPercent = budgetPercent(estimate.low);
    const estimateHighPercent = budgetPercent(estimate.high);
    const estimateOvalStyle = {
        left: `${estimateLowPercent}%`,
        width: `${Math.max(3, estimateHighPercent - estimateLowPercent)}%`,
    };

    const update = (key, value) => {
        setState((current) => ({ ...current, [key]: value }));
    };

    const handleAssistantClick = () => {
        captureLandingEvent("tool_cta_clicked", {
            tool: "cost_calculator",
            care_type: state.careType,
            region: state.region,
            budget_band:
                state.budget < 7000
                    ? "under_7000"
                    : state.budget < 10000
                        ? "7000_9999"
                        : "10000_plus",
            estimate_low: estimate.low,
            estimate_high: estimate.high,
        });
    };

    return (
        <>
            <Head>
                <title>Massachusetts Assisted Living Cost Calculator | Assistedly</title>
                <meta
                    name="description"
                    content="Estimate Massachusetts assisted living and memory care costs, hidden fees, and budget fit before touring facilities."
                />
            </Head>
            <main className={styles.toolPage}>
                <section className={styles.hero}>
                    <p className={styles.kicker}>Free Massachusetts care planning tool</p>
                    <h1>Assisted living and memory care cost calculator</h1>
                    <p className={styles.heroCopy}>
                        Get a practical monthly range, see common add-ons, and carry your answers into Assistedly&apos;s matching assistant.
                    </p>
                </section>

                <section className={styles.toolShell} aria-label="Cost calculator">
                    <div className={styles.inputPanel}>
                        <label className={styles.field}>
                            <span>Care setting</span>
                            <select
                                value={state.careType}
                                onChange={(e) => update("careType", e.target.value)}
                            >
                                {Object.entries(CARE_TYPES).map(([key, value]) => (
                                    <option key={key} value={key}>
                                        {value.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className={styles.field}>
                            <span>Massachusetts region</span>
                            <select
                                value={state.region}
                                onChange={(e) => update("region", e.target.value)}
                            >
                                {Object.entries(REGIONS).map(([key, value]) => (
                                    <option key={key} value={key}>
                                        {value.label}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className={`${styles.field} ${styles.rangeField}`}>
                            <span>Monthly budget</span>
                            <div className={styles.budgetSliderWrap}>
                                <span
                                    className={styles.budgetRangeOval}
                                    style={estimateOvalStyle}
                                    aria-hidden="true"
                                >
                                    <span className={styles.budgetRangeOvalLabel}>
                                        {currency.format(estimate.low)} - {currency.format(estimate.high)}
                                    </span>
                                </span>
                                <input
                                    className={styles.budgetSlider}
                                    type="range"
                                    min={BUDGET_MIN}
                                    max={BUDGET_MAX}
                                    step="250"
                                    value={state.budget}
                                    onChange={(e) => update("budget", clampNumber(e.target.value, 9000))}
                                />
                            </div>
                            <div className={styles.budgetSliderLabels}>
                                <span>{currency.format(BUDGET_MIN)}</span>
                                <strong>Estimated range</strong>
                                <span>{currency.format(BUDGET_MAX)}</span>
                            </div>
                            <strong>{currency.format(state.budget)}</strong>
                        </label>

                        <fieldset className={styles.checkGroup}>
                            <legend>Likely add-ons</legend>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={state.medication}
                                    onChange={(e) => update("medication", e.target.checked)}
                                />
                                Medication management
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={state.incontinence}
                                    onChange={(e) => update("incontinence", e.target.checked)}
                                />
                                Incontinence supplies or reminders
                            </label>
                            <label>
                                <input
                                    type="checkbox"
                                    checked={state.mobility}
                                    onChange={(e) => update("mobility", e.target.checked)}
                                />
                                Mobility / transfer support
                            </label>
                        </fieldset>
                    </div>

                    <aside className={styles.resultPanel} aria-live="polite">
                        <p className={styles.resultLabel}>Estimated monthly range</p>
                        <div className={styles.resultNumber}>
                            {currency.format(estimate.low)} - {currency.format(estimate.high)}
                        </div>
                        <p>{estimate.care.copy}</p>
                        {estimate.withinBudget ? (
                            <p className={styles.goodNews}>
                                Your stated budget may fit the lower end of this range. Next step: compare care fit and fees facility by facility.
                            </p>
                        ) : (
                            <p className={styles.warning}>
                                This estimate starts about {currency.format(estimate.gap)} above your stated budget. Ask early about MassHealth options, care-level pricing, and move-in fees.
                            </p>
                        )}
                        <Link
                            href={assistantHref}
                            className={styles.primaryCta}
                            onClick={handleAssistantClick}
                        >
                            Find facilities that fit this budget
                        </Link>
                    </aside>
                </section>

                <section className={styles.insightGrid}>
                    <article>
                        <h2>Hidden fees to ask about</h2>
                        <ul>
                            <li>Care-level increases after assessment</li>
                            <li>Medication management and pharmacy coordination</li>
                            <li>Incontinence supplies, laundry, and personal care</li>
                            <li>Transportation, activities, cable, and phone</li>
                            <li>Move-in, community, or second-person fees</li>
                        </ul>
                    </article>
                    <article>
                        <h2>Tour question</h2>
                        <p>
                            Ask each facility: “What would cause this monthly price to increase in the first 90 days, and can you show me the care-level fee schedule?”
                        </p>
                    </article>
                </section>
            </main>
        </>
    );
}
