import { useMemo, useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import LandingBanner from "../../components/LandingBanner";
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

const LOWER_COST_QUESTIONS = [
    {
        id: "massHealth",
        question: "Do you get insurance through MassHealth?",
        options: [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
            { value: "unsure", label: "Not sure" },
        ],
    },
    {
        id: "income",
        question: "Which monthly income range is closest?",
        options: [
            { value: "low", label: "Under $1,500/month" },
            { value: "moderate", label: "$1,500-$3,000/month" },
            { value: "higher", label: "Over $3,000/month" },
            { value: "unsure", label: "Not sure" },
        ],
    },
    {
        id: "assets",
        question: "Do they have savings or assets that could affect benefits?",
        options: [
            { value: "limited", label: "Very limited savings" },
            { value: "some", label: "Some savings / home / retirement funds" },
            { value: "unsure", label: "Not sure" },
        ],
    },
    {
        id: "driveFlex",
        question: "Could family consider a lower-priced region within driving distance?",
        options: [
            { value: "30", label: "Up to 30 minutes" },
            { value: "60", label: "Up to 60 minutes" },
            { value: "90", label: "Up to 90+ minutes" },
            { value: "no", label: "No, must stay very local" },
        ],
    },
    {
        id: "veteran",
        question: "Is the older adult or spouse a veteran?",
        options: [
            { value: "yes", label: "Yes" },
            { value: "no", label: "No" },
            { value: "unsure", label: "Not sure" },
        ],
    },
    {
        id: "safety",
        question: "Is secured memory care or overnight supervision a safety need?",
        options: [
            { value: "yes", label: "Yes, safety supervision is required" },
            { value: "no", label: "No, standard assisted living may fit" },
            { value: "unsure", label: "Not sure" },
        ],
    },
];

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

function buildQuestionHref(state, estimate, intent) {
    const params = new URLSearchParams({
        typebot_entry:
            intent === "lower_cost_options"
                ? "lowest_cost_assisted_living_finder"
                : "cost_followup_questions",
        campaign_segment: "cost-planning",
        care_type: state.careType,
        region: state.region,
        monthly_budget: String(state.budget),
        estimated_low: String(estimate.low),
        estimated_high: String(estimate.high),
        tool_intent: intent,
        wants_hidden_fees: intent === "hidden_fees" || intent === "both" ? "yes" : "no",
        wants_tour_questions: intent === "tour_questions" || intent === "both" ? "yes" : "no",
        wants_lower_cost_options:
            intent === "lower_cost_options" || intent === "both" ? "yes" : "no",
        utm_source: "cost_calculator",
        utm_medium: "tool",
        utm_campaign:
            intent === "lower_cost_options"
                ? "lowest_cost_assisted_living"
                : "hidden_fees_tour_questions",
    });
    return `/?${params.toString()}#assistant`;
}

function buildLowerCostPlan(answers, state, estimate) {
    const items = [];
    const budgetGap = Math.max(0, estimate.low - state.budget);

    if (answers.massHealth === "yes" || answers.massHealth === "unsure") {
        items.push(
            "Call MassHealth or a SHINE counselor to confirm eligibility paths before assuming private-pay only.",
        );
        items.push(
            "Ask specifically about Frail Elder Waiver, Group Adult Foster Care, PACE availability, and what each program can or cannot cover in assisted living.",
        );
    } else {
        items.push(
            "Even without MassHealth today, ask an elder-law or benefits counselor about spend-down timing and whether a waiver path could become relevant later.",
        );
    }

    if (answers.income === "low" || answers.income === "moderate") {
        items.push(
            "Screen for public and nonprofit help: local ASAP/Area Agency on Aging, Council on Aging, SHINE, veterans benefits, respite grants, and Alzheimer's Association supports.",
        );
    }

    if (answers.driveFlex === "60" || answers.driveFlex === "90") {
        items.push(
            "Compare lower-priced regions within that drive radius. Central or Western Massachusetts may price below Boston/inner-suburb options for similar care needs.",
        );
    } else if (answers.driveFlex === "30") {
        items.push(
            "Compare nearby towns just outside the highest-cost inner-suburb cluster before expanding farther away.",
        );
    } else {
        items.push(
            "If the location cannot change, focus negotiations on room type, included services, move-in fees, and care-level reassessment timing.",
        );
    }

    if (answers.veteran === "yes" || answers.veteran === "unsure") {
        items.push(
            "Check Veterans Aid & Attendance or survivor benefits; eligibility can materially change the monthly budget.",
        );
    }

    if (answers.safety === "yes") {
        items.push(
            "Do not cut secured memory care, overnight supervision, medication management, or transfer support if they are safety needs. Look for lower-cost regions or funding first.",
        );
    } else {
        items.push(
            "Ask whether adult day health, respite, a smaller room, shared suite, family transportation, or pharmacy packaging could safely reduce monthly add-ons.",
        );
    }

    return {
        budgetGap,
        items,
    };
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
    const [lowerCostBotOpen, setLowerCostBotOpen] = useState(false);
    const [lowerCostAnswers, setLowerCostAnswers] = useState({
        massHealth: "",
        income: "",
        assets: "",
        driveFlex: "",
        veteran: "",
        safety: "",
    });
    const [lowerCostStep, setLowerCostStep] = useState(0);
    const [resourceSearch, setResourceSearch] = useState({
        loading: false,
        error: "",
        results: [],
        query: "",
        setupHint: "",
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

    const handleQuestionChoice = (intent) => {
        captureLandingEvent("cost_tool_followup_clicked", {
            tool: "cost_calculator",
            tool_intent: intent,
            care_type: state.careType,
            region: state.region,
            estimate_low: estimate.low,
            estimate_high: estimate.high,
        });
    };

    const handleLowerCostStart = () => {
        setLowerCostBotOpen(true);
        setLowerCostStep(0);
        captureLandingEvent("lower_cost_bot_started", {
            tool: "cost_calculator",
            care_type: state.careType,
            region: state.region,
            estimate_low: estimate.low,
            estimate_high: estimate.high,
        });
    };

    const setLowerCostAnswer = (id, value) => {
        setLowerCostAnswers((current) => ({ ...current, [id]: value }));
        setResourceSearch({
            loading: false,
            error: "",
            results: [],
            query: "",
            setupHint: "",
        });
        captureLandingEvent("lower_cost_bot_answered", {
            question_id: id,
            answer_value: value,
            tool: "cost_calculator",
        });
        setLowerCostStep((current) =>
            Math.min(current + 1, LOWER_COST_QUESTIONS.length),
        );
    };

    const lowerCostComplete = LOWER_COST_QUESTIONS.every(
        (question) => lowerCostAnswers[question.id],
    );
    const currentLowerCostQuestion =
        lowerCostStep < LOWER_COST_QUESTIONS.length
            ? LOWER_COST_QUESTIONS[lowerCostStep]
            : null;
    const lowerCostPlan = buildLowerCostPlan(lowerCostAnswers, state, estimate);
    const showLowerCostBot =
        lowerCostBotOpen ||
        (router.isReady && router.query.lower_cost_bot === "1");
    const shouldOfferResourceSearch = lowerCostPlan.items.some((item) =>
        /public|nonprofit|ASAP|Area Agency|Council on Aging|SHINE|Veterans|Alzheimer/i.test(item),
    );

    const searchLowerCostResources = async () => {
        setResourceSearch((current) => ({
            ...current,
            loading: true,
            error: "",
            setupHint: "",
        }));
        captureLandingEvent("lower_cost_resource_search_started", {
            tool: "cost_calculator",
            masshealth: lowerCostAnswers.massHealth || "unset",
            income: lowerCostAnswers.income || "unset",
            veteran: lowerCostAnswers.veteran || "unset",
        });
        try {
            const response = await fetch("/api/tools/lower-cost-resources", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    region: state.region,
                    careType: state.careType,
                    massHealth: lowerCostAnswers.massHealth,
                    income: lowerCostAnswers.income,
                    veteran: lowerCostAnswers.veteran,
                    driveFlex: lowerCostAnswers.driveFlex,
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                setResourceSearch({
                    loading: false,
                    error: data.error || "Resource search is unavailable right now.",
                    results: [],
                    query: data.query || "",
                    setupHint: data.setup_hint || "",
                });
                return;
            }
            setResourceSearch({
                loading: false,
                error: "",
                results: Array.isArray(data.results) ? data.results : [],
                query: data.query || "",
                setupHint: data.setup_hint || "",
            });
            captureLandingEvent("lower_cost_resource_search_completed", {
                tool: "cost_calculator",
                result_count: Array.isArray(data.results) ? data.results.length : 0,
            });
        } catch {
            setResourceSearch({
                loading: false,
                error: "Resource search failed. Try again in a moment.",
                results: [],
                query: "",
                setupHint: "",
            });
        }
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
                <LandingBanner headlineOverride="Access Exclusive Data to Find Best Massachusetts Assisted Living" />
                <section className={styles.hero}>
                    <p className={styles.kicker}>Free Massachusetts care planning tool</p>
                    <h1>Assisted living and memory care cost calculator</h1>
                    <p className={styles.heroCopy}>
                        Get a practical monthly range, see common add-ons, and use our AI bot to find best assisted living for your family.
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

                <section
                    id="lower-cost-bot"
                    className={styles.assistantPrompt}
                    aria-labelledby="cost-followup-title"
                >
                    <div className={styles.assistantPromptHeader}>
                        <div className={styles.assistantAvatar} aria-hidden="true">AI</div>
                        <div>
                            <p className={styles.resultLabel}>Assistedly Companion</p>
                            <h2 id="cost-followup-title">
                                {showLowerCostBot
                                    ? "Let’s look for safer ways to lower the monthly cost."
                                    : "Want help asking facilities the right cost questions?"}
                            </h2>
                            <p>
                                {showLowerCostBot
                                    ? "Answer one question at a time. I’ll update this window with lower-cost region, care-plan, and funding ideas."
                                    : "I can use your estimate to look for lower-cost care paths, hidden fees to watch for, tour questions to ask, or all three in the homepage assistant."}
                            </p>
                        </div>
                    </div>
                    {showLowerCostBot ? (
                        <div className={styles.lowerCostInline} aria-live="polite">
                            {currentLowerCostQuestion ? (
                                <>
                                    <div className={styles.lowerCostProgress}>
                                        Question {lowerCostStep + 1} of {LOWER_COST_QUESTIONS.length}
                                    </div>
                                    <div className={styles.lowerCostQuestion}>
                                        <p>{currentLowerCostQuestion.question}</p>
                                        <div className={styles.lowerCostOptions}>
                                            {currentLowerCostQuestion.options.map((option) => (
                                                <button
                                                    key={option.value}
                                                    type="button"
                                                    className={
                                                        lowerCostAnswers[currentLowerCostQuestion.id] === option.value
                                                            ? styles.lowerCostOptionActive
                                                            : styles.lowerCostOption
                                                    }
                                                    onClick={() =>
                                                        setLowerCostAnswer(
                                                            currentLowerCostQuestion.id,
                                                            option.value,
                                                        )
                                                    }
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {lowerCostStep > 0 ? (
                                        <button
                                            type="button"
                                            className={styles.lowerCostBack}
                                            onClick={() =>
                                                setLowerCostStep((current) => Math.max(0, current - 1))
                                            }
                                        >
                                            Back
                                        </button>
                                    ) : null}
                                </>
                            ) : (
                                <aside className={styles.lowerCostResult}>
                                    <h3>Preliminary cost-lowering plan</h3>
                                    {lowerCostPlan.budgetGap ? (
                                        <p>
                                            Your selected budget starts about{" "}
                                            <strong>{currency.format(lowerCostPlan.budgetGap)}</strong>{" "}
                                            below the estimated low end. Focus on funding and region
                                            flexibility before cutting safety-related care.
                                        </p>
                                    ) : (
                                        <p>
                                            Your selected budget may fit the lower end of the estimate.
                                            These steps can still reduce surprise fees and preserve options.
                                        </p>
                                    )}
                                    {lowerCostComplete ? (
                                        <ol>
                                            {lowerCostPlan.items.slice(0, 6).map((item) => (
                                                <li key={item}>{item}</li>
                                            ))}
                                        </ol>
                                    ) : (
                                        <p className={styles.muted}>
                                            Answer each question to personalize the plan.
                                        </p>
                                    )}
                                    <button
                                        type="button"
                                        className={styles.lowerCostBack}
                                        onClick={() =>
                                            setLowerCostStep(LOWER_COST_QUESTIONS.length - 1)
                                        }
                                    >
                                        Back to last question
                                    </button>
                                </aside>
                            )}
                        </div>
                    ) : (
                        <div className={styles.assistantChoices}>
                            <button
                                type="button"
                                className={`${styles.assistantChoice} ${styles.assistantChoiceButton}`}
                                onClick={handleLowerCostStart}
                            >
                                <strong>Find lower-cost options</strong>
                                <span>Compare regions, care-plan changes, and funding paths.</span>
                            </button>
                            <Link
                                href={buildQuestionHref(state, estimate, "hidden_fees")}
                                className={styles.assistantChoice}
                                onClick={() => handleQuestionChoice("hidden_fees")}
                            >
                                <strong>Show hidden fees</strong>
                                <span>Ask about care-level increases and add-on charges.</span>
                            </Link>
                            <Link
                                href={buildQuestionHref(state, estimate, "tour_questions")}
                                className={styles.assistantChoice}
                                onClick={() => handleQuestionChoice("tour_questions")}
                            >
                                <strong>Give me tour questions</strong>
                                <span>Get questions to use when calling or touring facilities.</span>
                            </Link>
                            <Link
                                href={buildQuestionHref(state, estimate, "both")}
                                className={styles.assistantChoice}
                                onClick={() => handleQuestionChoice("both")}
                            >
                                <strong>I want all three</strong>
                                <span>Lower-cost options, hidden fees, and tour questions.</span>
                            </Link>
                        </div>
                    )}
                </section>
            </main>
        </>
    );
}
