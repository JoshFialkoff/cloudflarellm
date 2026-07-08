import { useMemo, useState } from "react";
import Link from "next/link";
import styles from "../styles/Tools.module.css";
import { captureLandingEvent } from "../lib/landingAnalytics";
import { MA_FINANCIAL_PROGRAMS, MA_SUPPORT_ALLIES } from "../lib/massachusettsBudgetResources";

const KEY_MESSAGING = [
    "Don't pay for care out-of-pocket: Use MassHealth GAFC to cover personal care while using SSI-G for your room and board.",
    "Veterans: Your 'Aid and Attendance' benefit is like a secret $2,000+ monthly subsidy—apply before you spend down your savings.",
    "Your local ASAP (Aging Services Access Point) is your free personal navigator for the Massachusetts elder care system.",
    "Section 202 housing is the 'Gold Standard' for low-income seniors—get on a waitlist today to lock in rent at 30% of your income.",
];

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
            { value: "moderate", label: "$1,500–$3,000/month" },
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

const ITEM_DETAILS = {
    "Call MassHealth or a SHINE counselor": {
        title: "MassHealth & SHINE guidance",
        detail:
            "MassHealth is Massachusetts Medicaid. A SHINE counselor provides free, unbiased Medicare/Medicaid counseling. Call 1-800-243-4636 (Elder Helpline) or visit mass.gov/masshealth to find your local SHINE program. Ask about the Frail Elder Waiver, Group Adult Foster Care (GAFC), and PACE programs — each covers different services in different settings.",
    },
    "Frail Elder Waiver": {
        title: "Frail Elder Waiver, GAFC & PACE",
        detail:
            "The Frail Elder Waiver (FEW) pays for home and community services for people who meet nursing-facility level of care. Group Adult Foster Care (GAFC) pays a daily rate for personal care and supervision in certain settings. PACE (Program of All-Inclusive Care for the Elderly) provides full medical and long-term care for eligible adults who agree to use PACE providers. None pay traditional assisted living room and board directly, but can offset a large portion of total cost.",
    },
    "elder-law or benefits counselor": {
        title: "Spend-down & elder-law planning",
        detail:
            "Even if MassHealth is not available today, an elder-law attorney or benefits counselor can explain Medicaid spend-down timing, asset protection strategies, and whether a waiver path becomes relevant as savings decline. Look for attorneys through the National Academy of Elder Law Attorneys (naela.org) or ask your local Council on Aging for referrals.",
    },
    "ASAP/Area Agency on Aging": {
        title: "ASAP, Area Agency on Aging & nonprofits",
        detail:
            "Aging Services Access Points (ASAPs) are the entry point for Massachusetts long-term care programs. Contact your ASAP to request a needs assessment and learn which state-funded programs may apply. Your local Council on Aging can also connect you with respite grants, caregiver support, volunteer programs, and local nonprofits that supplement or delay facility placement.",
    },
    "Central or Western Massachusetts": {
        title: "Lower-cost Massachusetts regions",
        detail:
            "Boston and inner suburbs (Newton, Brookline, Cambridge) typically run $8,000–$14,000+/month for memory care. MetroWest, North Shore, and South Shore generally range $7,000–$11,000. Central Massachusetts (Worcester area) and Western Massachusetts (Springfield area) often price $1,000–$3,000/month less for comparable care. Ask each facility whether they accept MassHealth and under what conditions — lower-cost regions have more MassHealth-accepting beds.",
    },
    "Compare nearby towns": {
        title: "Towns just outside the high-cost cluster",
        detail:
            "Even within a 30-minute drive, moving from a high-demand town (Newton, Brookline, Wellesley) to a neighboring town (Waltham, Dedham, Norwood) can reduce rates by $500–$1,500/month. Ask facilities in adjacent towns whether they have availability — many are less full and more willing to negotiate move-in fees.",
    },
    "room type, included services, move-in fees": {
        title: "Negotiating terms when location is fixed",
        detail:
            "Most facilities have unpublished flexibility: smaller or shared rooms ($300–$800 less/month), waived or reduced community/move-in fees ($2,000–$5,000 savings), locked-in rates for 12 months, and bundled service packages. Ask for a line-item fee schedule and explicitly ask whether any of these are negotiable. Request to speak with the administrator rather than the admissions director.",
    },
    "Veterans Aid & Attendance": {
        title: "Veterans Aid & Attendance",
        detail:
            "Veterans Aid & Attendance (A&A) is a VA pension enhancement for veterans (or surviving spouses) who need help with daily activities. It can provide $1,000–$2,300/month toward care costs including assisted living. Apply through a VA regional office or a VA-accredited claims agent (free service). Allow 6–12 months for approval. Visit va.gov/pension/aid-attendance-housebound/ or call 1-800-827-1000.",
    },
    "adult day health, respite": {
        title: "Care-plan changes that may lower cost",
        detail:
            "Adult day health centers provide medically supervised day programs ($75–$120/day) that can delay or supplement residential placement. Respite programs give family caregivers short breaks without full facility admission. Smaller room types, shared suites, and family-provided transportation can each reduce monthly bills by hundreds of dollars. Ask the facility which services are optional add-ons versus included — and which ones could be adjusted without affecting required care.",
    },
    "Do not cut secured memory care": {
        title: "Safety first: what not to reduce",
        detail:
            "Secured memory care units, overnight supervision, medication management, and transfer support are safety needs — not optional extras. Cutting these to save money can lead to unsafe incidents, emergency hospitalizations, and higher total costs. Focus on region flexibility, funding programs, and room/service negotiations rather than reducing clinical supervision or safety infrastructure.",
    },
};

function getDetailForItem(item) {
    for (const [key, value] of Object.entries(ITEM_DETAILS)) {
        if (item.includes(key)) return value;
    }
    return null;
}

const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
});

function buildPlan(answers, careType, region, budget, estimateLow, estimateHigh) {
    const items = [];
    const budgetGap = Math.max(0, estimateLow - budget);

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

    return { budgetGap, items };
}

function PlanItem({ index, item }) {
    const [open, setOpen] = useState(false);
    const detail = getDetailForItem(item);

    return (
        <li className={styles.planItem}>
            <div className={styles.planItemRow}>
                <span>{item}</span>
                {detail ? (
                    <button
                        type="button"
                        className={styles.planItemExpand}
                        aria-expanded={open}
                        onClick={() => {
                            setOpen((v) => !v);
                            if (!open) {
                                captureLandingEvent("lower_cost_plan_item_expanded", {
                                    item_index: index,
                                });
                            }
                        }}
                    >
                        {open ? (
                            <span className={styles.planExpandBtn} aria-label="Hide detail">
                                <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
                                    <path fill="currentColor" d="M19 13H5v-2h14v2z"/>
                                </svg>
                            </span>
                        ) : (
                            <span className={styles.planExpandBtn} aria-label="Tell me more">
                                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
                                    <path fill="currentColor" d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                    <path fill="white" d="M12 8v8M8 12h8" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                            </span>
                        )}
                    </button>
                ) : null}
            </div>
            {open && detail ? (
                <div className={styles.planItemDetail}>
                    <strong>{detail.title}</strong>
                    <p>{detail.detail}</p>
                </div>
            ) : null}
        </li>
    );
}

/**
 * Fully self-contained lower-cost companion bot.
 * Receives only primitive props from the parent so parent re-renders
 * don't touch this component's state.
 */
export default function LowerCostCompanion({
    initialOpen = false,
    careType,
    region,
    budget,
    estimateLow,
    estimateHigh,
}) {
    const [open, setOpen] = useState(initialOpen);
    const [answers, setAnswers] = useState({
        massHealth: "", income: "", assets: "", driveFlex: "", veteran: "", safety: "",
    });
    const [step, setStep] = useState(0);
    const [resourceSearch, setResourceSearch] = useState({
        loading: false, error: "", results: [], query: "", setupHint: "", fromFallback: false,
    });

    const complete = LOWER_COST_QUESTIONS.every((q) => answers[q.id]);
    const currentQuestion = step < LOWER_COST_QUESTIONS.length
        ? LOWER_COST_QUESTIONS[step] : null;
    const plan = useMemo(
        () => buildPlan(answers, careType, region, budget, estimateLow, estimateHigh),
        [answers, careType, region, budget, estimateLow, estimateHigh],
    );
    const shouldOfferResourceSearch = plan.items.some((item) =>
        /public|nonprofit|ASAP|Area Agency|Council on Aging|SHINE|Veterans|Alzheimer/i.test(item),
    );

    const answerQuestion = (id, value) => {
        setAnswers((prev) => ({ ...prev, [id]: value }));
        captureLandingEvent("lower_cost_bot_answered", { question_id: id, answer_value: value });
        setStep((s) => Math.min(s + 1, LOWER_COST_QUESTIONS.length));
    };

    const handleStart = () => {
        setOpen(true);
        setStep(0);
        captureLandingEvent("lower_cost_bot_started", { care_type: careType, region });
    };

    const searchResources = async () => {
        setResourceSearch((s) => ({ ...s, loading: true, error: "", setupHint: "" }));
        captureLandingEvent("lower_cost_resource_search_started", {
            masshealth: answers.massHealth || "unset",
            income: answers.income || "unset",
            veteran: answers.veteran || "unset",
        });
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), 12_000);
        try {
            const res = await fetch("/api/tools/lower-cost-resources", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ region, careType, massHealth: answers.massHealth, income: answers.income, veteran: answers.veteran, driveFlex: answers.driveFlex }),
                signal: controller.signal,
            });
            const data = await res.json().catch(() => ({}));
            setResourceSearch({
                loading: false,
                error: res.ok ? "" : (data.error || "Resource search unavailable."),
                results: Array.isArray(data.results) ? data.results : [],
                query: data.query || "",
                setupHint: data.setup_hint || "",
                fromFallback: Boolean(data.from_fallback),
            });
            if (res.ok) {
                captureLandingEvent("lower_cost_resource_search_completed", {
                    result_count: Array.isArray(data.results) ? data.results.length : 0,
                });
            }
        } catch (error) {
            setResourceSearch({
                loading: false,
                error: error?.name === "AbortError"
                    ? "Resource search timed out. Please use the curated questions above and try again later."
                    : "Resource search failed.",
                results: [],
                query: "",
                setupHint: "",
                fromFallback: false,
            });
        } finally {
            window.clearTimeout(timeoutId);
        }
    };

    return (
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
                        {open
                            ? "Let\u2019s look for safer ways to lower the monthly cost."
                            : "Want help asking facilities the right cost questions?"}
                    </h2>
                    <p>
                        {open
                            ? "Answer one question at a time. I\u2019ll update this window with lower-cost region, care-plan, and funding ideas."
                            : "I can use your estimate to look for lower-cost care paths, hidden fees to watch for, tour questions to ask, or all three in the homepage assistant."}
                    </p>

                </div>
            </div>

            {open ? (
                <div className={styles.lowerCostInline} aria-live="polite">
                    {currentQuestion ? (
                        <>
                            <div className={styles.lowerCostProgress}>
                                Question {step + 1} of {LOWER_COST_QUESTIONS.length}
                            </div>
                            <div className={styles.messagingCarousel} style={{ marginBottom: '1rem', padding: '0.8rem', background: '#f9f6f2', borderRadius: '8px', fontSize: '0.9rem', borderLeft: '4px solid #4a7c7e' }}>
                                <strong>Tip:</strong> {KEY_MESSAGING[step % KEY_MESSAGING.length]}
                            </div>
                            <div className={styles.lowerCostQuestion}>
                                <p>{currentQuestion.question}</p>
                                <div className={styles.lowerCostOptions}>
                                    {currentQuestion.options.map((opt) => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            className={
                                                answers[currentQuestion.id] === opt.value
                                                    ? styles.lowerCostOptionActive
                                                    : styles.lowerCostOption
                                            }
                                            onClick={() => answerQuestion(currentQuestion.id, opt.value)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {step > 0 ? (
                                <button
                                    type="button"
                                    className={styles.lowerCostBack}
                                    onClick={() => setStep((s) => Math.max(0, s - 1))}
                                >
                                    Back
                                </button>
                            ) : null}
                        </>
                    ) : (
                        <aside className={styles.lowerCostResult}>
                            <h3>Your Potential Savings</h3>
                            <div style={{ background: '#e8f5e9', padding: '1rem', borderRadius: '12px', marginBottom: '1rem', textAlign: 'center' }}>
                                <p style={{ fontSize: '0.85rem', margin: 0, color: '#2e7d32' }}>Estimated monthly savings you may qualify for</p>
                                <p style={{ fontSize: '2.5rem', fontWeight: 700, margin: '0.25rem 0', color: '#1b5e20' }}>up to {currency.format(Math.round(estimateLow * 0.55))}</p>
                            </div>

                            <div style={{ background: '#fff8e1', border: '2px solid #ffc107', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
                                <p style={{ margin: 0, fontWeight: 600, fontSize: '1rem' }}>
                                    🎖️ <strong>Veterans:</strong> You or your spouse may qualify for <strong>VA Aid &amp; Attendance</strong> — up to <strong>$2,431/month</strong> to cover assisted living costs.
                                </p>
                                <p style={{ margin: '0.75rem 0 0.5rem', fontSize: '0.9rem' }}>Are you or your loved one a veteran or veteran's spouse?</p>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="button" className={answers.veteran === 'yes' ? styles.lowerCostOptionActive : styles.lowerCostOption} onClick={() => answerQuestion('veteran', 'yes')}>Yes</button>
                                    <button type="button" className={answers.veteran === 'no' ? styles.lowerCostOptionActive : styles.lowerCostOption} onClick={() => answerQuestion('veteran', 'no')}>No</button>
                                    <button type="button" className={answers.veteran === 'unsure' ? styles.lowerCostOptionActive : styles.lowerCostOption} onClick={() => answerQuestion('veteran', 'unsure')}>Not sure</button>
                                </div>
                            </div>

                            <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
                                <p style={{ margin: 0, fontWeight: 600 }}>
                                    🏥 <strong>MassHealth GAFC:</strong> Covers personal care costs at participating assisted living — up to <strong>$3,000+/month</strong> in savings.
                                </p>
                                <p style={{ margin: '0.75rem 0 0.5rem', fontSize: '0.9rem' }}>Do you currently have MassHealth (Medicaid)?</p>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="button" className={answers.massHealth === 'yes' ? styles.lowerCostOptionActive : styles.lowerCostOption} onClick={() => answerQuestion('massHealth', 'yes')}>Yes</button>
                                    <button type="button" className={answers.massHealth === 'no' ? styles.lowerCostOptionActive : styles.lowerCostOption} onClick={() => answerQuestion('massHealth', 'no')}>No</button>
                                    <button type="button" className={answers.massHealth === 'unsure' ? styles.lowerCostOptionActive : styles.lowerCostOption} onClick={() => answerQuestion('massHealth', 'unsure')}>Not sure</button>
                                </div>
                            </div>

                            <div style={{ background: '#fce4ec', border: '1px solid #f48fb1', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
                                <p style={{ margin: 0, fontWeight: 600 }}>
                                    🏠 <strong>SSI-G + Section 202:</strong> Pays room &amp; board at $1,215/month — combine with GAFC for nearly full coverage.
                                </p>
                                <p style={{ margin: '0.75rem 0 0.5rem', fontSize: '0.9rem' }}>Is monthly income under $1,500?</p>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button type="button" className={answers.income === 'low' ? styles.lowerCostOptionActive : styles.lowerCostOption} onClick={() => answerQuestion('income', 'low')}>Under $1,500</button>
                                    <button type="button" className={answers.income === 'medium' ? styles.lowerCostOptionActive : styles.lowerCostOption} onClick={() => answerQuestion('income', 'medium')}>$1,500–$3,000</button>
                                    <button type="button" className={answers.income === 'high' ? styles.lowerCostOptionActive : styles.lowerCostOption} onClick={() => answerQuestion('income', 'high')}>Over $3,000</button>
                                </div>
                            </div>

                            {complete && (
                                <>
                                    <h4 style={{ marginTop: '1.5rem' }}>Your Personalized Plan</h4>
                                    <ol className={styles.planList}>
                                        {plan.items.slice(0, 6).map((item, i) => (
                                            <PlanItem key={item} index={i} item={item} />
                                        ))}
                                    </ol>
                                </>
                            )}
                            {shouldOfferResourceSearch && complete ? (
                                <div className={styles.resourceSearchWrap}>
                                    <button
                                        type="button"
                                        className={styles.lowerCostBack}
                                        disabled={resourceSearch.loading}
                                        onClick={searchResources}
                                    >
                                        {resourceSearch.loading ? "Searching…" : "Search public/nonprofit resources"}
                                    </button>
                                    {resourceSearch.error ? (
                                        <p className={styles.muted}>{resourceSearch.error}</p>
                                    ) : null}
                                    {resourceSearch.setupHint ? (
                                        <p className={styles.muted}>{resourceSearch.setupHint}</p>
                                    ) : null}
                                    {resourceSearch.results.length > 0 ? (
                                        <>
                                            <p className={styles.resourceListLabel}>
                                                {resourceSearch.fromFallback
                                                    ? "Curated Massachusetts elder-care resources:"
                                                    : "Public/nonprofit resources:"}
                                            </p>
                                            <ul className={styles.resourceList}>
                                                {resourceSearch.results.map((r) => (
                                                    <li key={r.url}>
                                                        <a href={r.url} target="_blank" rel="noopener noreferrer">
                                                            {r.title}
                                                        </a>
                                                        {r.description ? <p>{r.description.slice(0, 200)}</p> : null}
                                                    </li>
                                                ))}
                                            </ul>
                                        </>
                                    ) : null}
                                </div>
                            ) : null}
                            <button
                                type="button"
                                className={styles.lowerCostBack}
                                onClick={() => setStep(LOWER_COST_QUESTIONS.length - 1)}
                            >
                                Back to last question
                            </button>
                        </aside>
                    )}
                </div>
            ) : (
                <LowerCostChoices
                    onStart={handleStart}
                    careType={careType}
                    region={region}
                    budget={budget}
                    estimateLow={estimateLow}
                    estimateHigh={estimateHigh}
                />
            )}
        </section>
    );
}

function LowerCostChoices({ onStart, careType, region, budget, estimateLow, estimateHigh }) {
    function buildQuestionHref(intent) {
        const params = new URLSearchParams({
            typebot_entry: intent === "lower_cost_options" ? "lowest_cost_assisted_living_finder" : "cost_followup_questions",
            campaign_segment: "cost-planning",
            care_type: careType,
            region,
            monthly_budget: String(budget),
            estimated_low: String(estimateLow),
            estimated_high: String(estimateHigh),
            tool_intent: intent,
            wants_hidden_fees: intent === "hidden_fees" || intent === "both" ? "yes" : "no",
            wants_tour_questions: intent === "tour_questions" || intent === "both" ? "yes" : "no",
            wants_lower_cost_options: intent === "lower_cost_options" || intent === "both" ? "yes" : "no",
            utm_source: "cost_calculator",
            utm_medium: "tool",
            utm_campaign: intent === "lower_cost_options" ? "lowest_cost_assisted_living" : "hidden_fees_tour_questions",
        });
        return `/?${params.toString()}#assistant`;
    }

    const handleClick = (intent) => {
        captureLandingEvent("cost_tool_followup_clicked", { tool: "cost_calculator", tool_intent: intent });
    };

    return (
        <div className={styles.assistantChoices}>
            <button
                type="button"
                className={`${styles.assistantChoice} ${styles.assistantChoiceButton}`}
                onClick={onStart}
            >
                <strong>Find lower-cost options</strong>
                <span>Compare regions, care-plan changes, and funding paths.</span>
            </button>
            <Link href={buildQuestionHref("hidden_fees")} className={styles.assistantChoice} onClick={() => handleClick("hidden_fees")}>
                <strong>Show hidden fees</strong>
                <span>Ask about care-level increases and add-on charges.</span>
            </Link>
            <Link href={buildQuestionHref("tour_questions")} className={styles.assistantChoice} onClick={() => handleClick("tour_questions")}>
                <strong>Give me tour questions</strong>
                <span>Get questions to use when calling or touring facilities.</span>
            </Link>
            <Link href={buildQuestionHref("both")} className={styles.assistantChoice} onClick={() => handleClick("both")}>
                <strong>I want all three</strong>
                <span>Lower-cost options, hidden fees, and tour questions.</span>
            </Link>
        </div>
    );
}
