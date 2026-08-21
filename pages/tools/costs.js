import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import AuthCapture from "../../components/AuthCapture";
import GeoPrice from "../../components/GeoPrice";
import LandingBanner from "../../components/LandingBanner";
import LowerCostCompanion from "../../components/LowerCostCompanion";
import styles from "../../styles/Tools.module.css";
import { captureLandingEvent } from "../../lib/landingAnalytics";
import { MA_FINANCIAL_PROGRAMS, MA_SUPPORT_ALLIES } from "../../lib/massachusettsBudgetResources";

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
    const router = useRouter();
    const [state, setState] = useState({
        careType: "memory",
        region: "boston",
        medication: true,
        incontinence: false,
        mobility: true,
        budget: 9000,
    });

    const estimate = useMemo(() => {
        const care = CARE_TYPES[state.careType] || CARE_TYPES.memory;
        const region = REGIONS[state.region] || REGIONS.boston;
        let addLow = 0;
        let addHigh = 0;
        if (state.medication) { addLow += 300; addHigh += 900; }
        if (state.incontinence) { addLow += 250; addHigh += 850; }
        if (state.mobility) { addLow += 500; addHigh += 1400; }
        const low = Math.round((care.low + addLow) * region.multiplier);
        const high = Math.round((care.high + addHigh) * region.multiplier);
        const gap = Math.max(0, low - state.budget);
        return { low, high, gap, withinBudget: state.budget >= low, care, region };
    }, [state]);

    const assistantHref = buildAssistantHref(state, estimate);
    const resultSnapshot = {
        kind: "cost_calculator",
        careType: state.careType,
        region: state.region,
        medication: state.medication,
        incontinence: state.incontinence,
        mobility: state.mobility,
        budget: state.budget,
        estimateLow: estimate.low,
        estimateHigh: estimate.high,
    };
    const estimateLowPercent = budgetPercent(estimate.low);
    const estimateHighPercent = budgetPercent(estimate.high);
    const estimateOvalStyle = {
        left: `${estimateLowPercent}%`,
        width: `${Math.max(3, estimateHighPercent - estimateLowPercent)}%`,
    };

    const update = (key, value) => setState((current) => ({ ...current, [key]: value }));
    const sliderRef = useRef(null);

    useEffect(() => {
        const el = sliderRef.current;
        if (!el) return;
        const onWheel = (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -250 : 250;
            setState((current) => ({
                ...current,
                budget: Math.min(BUDGET_MAX, Math.max(BUDGET_MIN, current.budget + delta)),
            }));
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, []);

    const handleAssistantClick = () => {
        captureLandingEvent("tool_cta_clicked", {
            tool: "cost_calculator",
            care_type: state.careType,
            region: state.region,
            budget_band: state.budget < 7000 ? "under_7000" : state.budget < 10000 ? "7000_9999" : "10000_plus",
            estimate_low: estimate.low,
            estimate_high: estimate.high,
        });
    };

    // Open companion bot if ?lower_cost_bot=1 is in URL (after hydration only)
    const initialBotOpen = router.isReady && router.query.lower_cost_bot === "1";

    return (
        <>
            <Head>
                <title>Assisted Living Savings Finder | Assistedly</title>
                <meta
                    name="description"
                    content="Estimate Massachusetts assisted living and memory care costs, hidden fees, and budget fit before touring facilities."
                />
            </Head>
            <main className={styles.toolPage}>
                <header style={{ background: 'linear-gradient(135deg, #4a7c7e 0%, rgba(74, 124, 126, 0.9) 100%)', padding: '0.75rem 1.5rem', position: 'sticky', top: 0, zIndex: 1000, boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                    <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center', color: 'white' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255, 255, 255, 0.15)', padding: '0.4rem 1rem', borderRadius: '50px', border: '1px solid rgba(255, 255, 255, 0.3)' }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 600, letterSpacing: '-0.01em' }}>
                                Use Data not Stock Photos Like These to Find Assisted Living
                            </span>
                        </div>
                    </div>
                </header>
                
                <div className={styles.toolGrid} style={{ maxWidth: '1200px', margin: '2rem auto 0', padding: '0 1.5rem' }}>
                    <div>
                        <section className={styles.hero}>
                            <h1 className={styles.toolTitle}>See how you can lower typical monthly cost of $10,148 – $17,464 in Winchester, MA</h1>
                        </section>

                        <details className={styles.calculatorDrawer}>
                            <summary className={styles.calculatorDrawerToggle}>
                                Update care options
                            </summary>
                            <section className={styles.toolShell} aria-label="Cost calculator">
                                <div className={styles.inputPanel}>
                                    <label className={styles.field}>
                                        <span>Care setting</span>
                                        <select
                                            value={state.careType}
                                            onChange={(e) => update("careType", e.target.value)}
                                        >
                                            {Object.entries(CARE_TYPES).map(([key, value]) => (
                                                <option key={key} value={key}>{value.label}</option>
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
                                                <option key={key} value={key}>{value.label}</option>
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
                                                ref={sliderRef}
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
                                    <p className={styles.resultLabel} style={{ fontSize: '0.75rem', opacity: 0.7 }}>Typical monthly cost (before savings)</p>
                                    <div className={styles.resultNumber} style={{ fontSize: '1.25rem', fontWeight: 500, opacity: 0.75, color: '#666' }}>
                                        {currency.format(estimate.low)} – {currency.format(estimate.high)}
                                    </div>
                                    <p className={styles.resultLabel} style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#4a7c7e', fontWeight: 600 }}>Answer 4 simple questions to see how much you can save.</p>
                                    <div className={styles.resultNumber} style={{ fontSize: '2.25rem', color: '#4a7c7e', fontWeight: 700 }}>
                                        up to {currency.format(Math.round(estimate.low * 0.55))}/mo
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                                        Combining MassHealth, housing, and military benefits can offset most of the cost above for eligible families.
                                    </p>
                                    <p style={{ fontSize: '0.8rem', color: '#666' }}>{estimate.care.copy}</p>
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
                        </details>
                    </div>

                    <div style={{ position: 'sticky', top: '1rem', alignSelf: 'start' }}>
                        <LowerCostCompanion
                            key={`${state.careType}-${state.region}`}
                            initialOpen={true}
                            careType={state.careType}
                            region={state.region}
                            budget={state.budget}
                            estimateLow={estimate.low}
                            estimateHigh={estimate.high}
                        />
                    </div>
                </div>

                <div style={{ maxWidth: '1200px', margin: '2rem auto 0', padding: '0 1.5rem' }}>
                    <div className={styles.magicLinkCard} style={{ width: '100%', padding: '1.5rem', background: '#f9f6f2', border: '1px solid #e6e6e9', borderRadius: '12px', textAlign: 'center' }}>
                        <h3 style={{ marginTop: 0, color: '#4a7c7e' }}>Enter your email address to save and share results.</h3>
                        <p style={{ color: '#666', marginTop: '0.25rem', marginBottom: '1rem' }}>High security without annoying passwords!</p>
                        <AuthCapture
                            authSurface="cost_calculator"
                            formId="cost_calculator_magic_link"
                            reason="Enter your email address to save and share results. High security without annoying passwords!"
                            redirectTo="/results"
                            resultSnapshot={resultSnapshot}
                            buttonLabel="Save & share results"
                        />
                    </div>
                </div>
            </main>
        </>
    );
}
