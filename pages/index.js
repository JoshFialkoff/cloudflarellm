import { useEffect, useState } from "react";
import Head from "next/head";
import styles from "../styles/Home.module.css";
import LandingBanner from "../components/LandingBanner";
import HeroYouTubeFacade from "../components/HeroYouTubeFacade";
import { useTypebotAnalytics } from "../hooks/useTypebotAnalytics";
import { useTypebotStandardLoader } from "../hooks/useTypebotStandardLoader";
import { TYPEBOT_DEFAULT_VIEWER_HOST } from "../lib/typebotEnv";
import {
    getTypebotReactModulePromise,
    prefetchTypebotViewerNetwork,
} from "../lib/typebotReactClient";

const TYPEBOT_PUBLIC_ID =
    process.env.NEXT_PUBLIC_TYPEBOT_ID ||
    "1-31-26-working-thio-ass-living-k3253lu";
const TYPEBOT_API_HOST =
    process.env.NEXT_PUBLIC_TYPEBOT_API_HOST || TYPEBOT_DEFAULT_VIEWER_HOST;
const TYPEBOT_API_ORIGIN = (() => {
    try {
        return new URL(TYPEBOT_API_HOST).origin;
    } catch {
        return TYPEBOT_API_HOST;
    }
})();

if (typeof window !== "undefined") {
    prefetchTypebotViewerNetwork();
    const narrow =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(max-width: 900px)").matches;
    if (!narrow) {
        void getTypebotReactModulePromise();
    }
}

export default function Home() {
    const [email, setEmail] = useState("");
    const [signupThanksOpen, setSignupThanksOpen] = useState(false);
    const [ctaSubmitting, setCtaSubmitting] = useState(false);
    const [ctaError, setCtaError] = useState("");
    const typebotAnalytics = useTypebotAnalytics();
    const { typebotSectionRef, TypebotStandard } = useTypebotStandardLoader();

    const handleTypebotInit = () => {
        typebotAnalytics.onInit?.();
    };

    const handleTypebotNewInputBlock = (input) => {
        typebotAnalytics.onNewInputBlock?.(input);
    };

    const handleCta = async (e) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (!trimmed) return;
        setCtaError("");
        setCtaSubmitting(true);
        try {
            const r = await fetch("/api/signup-discord", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: trimmed }),
            });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) {
                setCtaError(
                    typeof data.error === "string"
                        ? data.error
                        : "Something went wrong. Please try again.",
                );
                return;
            }
            if (typeof window !== "undefined") {
                window.dataLayer = window.dataLayer || [];
                window.dataLayer.push({ event: "generate_lead" });
            }
            setSignupThanksOpen(true);
            setEmail("");
        } catch {
            setCtaError("Network error. Please try again.");
        } finally {
            setCtaSubmitting(false);
        }
    };

    useEffect(() => {
        if (!signupThanksOpen) return;
        const onKey = (ev) => {
            if (ev.key === "Escape") setSignupThanksOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [signupThanksOpen]);

    return (
        <>
            <Head>
                <title>
                    Exclusive Data Help Families Find Assisted Living in
                    Massachusetts
                </title>
                <meta
                    name="description"
                    content="AI-powered assisted living finder for Massachusetts. Find the perfect community with compliance tracking and AI matching."
                />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <meta name="app-shell" content="no-global-navbar" />
                <link rel="dns-prefetch" href={TYPEBOT_API_ORIGIN} />
                <link
                    rel="preconnect"
                    href={TYPEBOT_API_ORIGIN}
                    crossOrigin="anonymous"
                />
            </Head>

            <LandingBanner />

            {/* Hero Section */}
            <section className={styles.hero}>
                <div className={styles.heroInner}>
                    <div
                        className={`${styles.heroContent} ${styles.heroHomeContent}`}
                    >
                        <h1 className={styles.heroTitle}>
                        In 2 minutes, find the best assisted living communitiy based on your loved one&apos;s medical needs, budget, and location.
                        </h1>
                        <div className={styles.heroHomeVideo}>
                            <HeroYouTubeFacade />
                        </div>
                    </div>
                    <div className={styles.heroVideoSlot}>
                        <section
                            ref={typebotSectionRef}
                            className={`${styles.typebotEmbed} ${styles.heroTypebotAside}`}
                            id="assistant"
                            aria-label="AI assistant chat"
                        >
                            <div className={styles.heroTypebotFrame}>
                                {TypebotStandard ? (
                                    <div
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                        }}
                                    >
                                        <TypebotStandard
                                            typebot={TYPEBOT_PUBLIC_ID}
                                            apiHost={TYPEBOT_API_HOST}
                                            style={{
                                                display: "block",
                                                width: "100%",
                                                height: "100%",
                                                border: 0,
                                            }}
                                            onInit={handleTypebotInit}
                                            onNewInputBlock={
                                                handleTypebotNewInputBlock
                                            }
                                            onAnswer={typebotAnalytics.onAnswer}
                                        />
                                    </div>
                                ) : (
                                    <div
                                        className={styles.typebotLoadingRoot}
                                        role="status"
                                        aria-live="polite"
                                        aria-label="AI assistant is loading"
                                    >
                                        <span
                                            className={
                                                styles.typebotLoadingSpinner
                                            }
                                            aria-hidden
                                        />
                                        Loading assistant…
                                    </div>
                                )}
                            </div>
                        </section>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section className={styles.howItWorks} id="how-it-works">
                <div className="container">
                    <h2 className={styles.sectionTitle}>How It Works</h2>
                    <p className={styles.sectionSubtitle}>
                        Finding the right assisted living community has never
                        been easier
                    </p>
                    <div className={styles.stepsGrid}>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIcon}>📋</div>
                            <h3 className={styles.stepTitle}>
                                Tell Us Your Needs
                            </h3>
                            <p className={styles.stepDesc}>
                                Share your loved one&apos;s care requirements,
                                budget, and location preferences. Our smart form
                                guides you through every important decision you
                                need to make.
                            </p>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIcon}>🤖</div>
                            <h3 className={styles.stepTitle}>
                                AI-Powered Matching
                            </h3>
                            <p className={styles.stepDesc}>
                                Our AI analyzes hundreds of data points —
                                compliance records, amenities, staffing ratios,
                                and resident reviews — to find your best
                                matches.
                            </p>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIcon}>✅</div>
                            <h3 className={styles.stepTitle}>
                                Make an Informed Choice
                            </h3>
                            <p className={styles.stepDesc}>
                                Compare communities side-by-side with full
                                compliance history, pricing transparency, and
                                real family reviews to make the best decision.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Trust Section */}
            <section className={styles.trustSection} id="for-families">
                <div className="container">
                    <h2 className={styles.sectionTitle}>
                        Why Families Trust Us
                    </h2>
                    <p className={styles.sectionSubtitle}>
                        We provide the most comprehensive assisted living data
                        in Massachusetts
                    </p>
                    <div className={styles.trustGrid}>
                        <div className={styles.trustCard}>
                            <div className={styles.trustCardIcon}>🔍</div>
                            <h3 className={styles.trustCardTitle}>
                                Compliance Tracking
                            </h3>
                            <p className={styles.trustCardDesc}>
                                Access full inspection histories, violation
                                records, and compliance ratings for every
                                licensed community in Massachusetts.
                            </p>
                        </div>
                        <div className={styles.trustCard}>
                            <div className={styles.trustCardIcon}>🤖</div>
                            <h3 className={styles.trustCardTitle}>
                                AI-Powered Matching
                            </h3>
                            <p className={styles.trustCardDesc}>
                                Our machine learning algorithms consider 50+
                                factors to match your loved one with communities
                                that truly meet their needs.
                            </p>
                        </div>
                        <div className={styles.trustCard}>
                            <div className={styles.trustCardIcon}>📊</div>
                            <h3 className={styles.trustCardTitle}>
                                Transparent Data
                            </h3>
                            <p className={styles.trustCardDesc}>
                                No hidden fees or pay-to-rank communities. All
                                data is sourced from official Massachusetts DPH
                                records and direct facility reporting.
                            </p>
                        </div>
                        <div className={styles.trustCard}>
                            <div className={styles.trustCardIcon}>📍</div>
                            <h3 className={styles.trustCardTitle}>
                                Local Expertise
                            </h3>
                            <p className={styles.trustCardDesc}>
                                Dedicated to Massachusetts, we have deep
                                knowledge of local regulations, regional care
                                standards, and community resources.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Stats Bar */}
            <div className={styles.statsBar}>
                <div className={styles.statItem}>
                    <div className={styles.statNumber}>500+</div>
                    <div className={styles.statLabel}>Communities Listed</div>
                </div>
                <div className={styles.statItem}>
                    <div className={styles.statNumber}>MA</div>
                    <div className={styles.statLabel}>
                        Massachusetts-Focused
                    </div>
                </div>
                <div className={styles.statItem}>
                    <div className={styles.statNumber}>100%</div>
                    <div className={styles.statLabel}>Compliance Verified</div>
                </div>
                <div className={styles.statItem}>
                    <div className={styles.statNumber}>AI</div>
                    <div className={styles.statLabel}>AI-Powered Matching</div>
                </div>
            </div>

            {/* CTA Section */}
            <section className={styles.ctaSection} id="contact">
                <h2 className={styles.ctaTitle}>Start Your Search Today</h2>
                <p className={styles.ctaSubtitle}>
                    Find the right assisted living communitiy for your loved one
                    with AI Assisted Living Companion.
                </p>
                <form className={styles.ctaForm} onSubmit={handleCta}>
                    <input
                        type="email"
                        className={styles.ctaInput}
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoComplete="email"
                        disabled={ctaSubmitting}
                        aria-invalid={ctaError ? "true" : "false"}
                        aria-describedby={
                            ctaError ? "cta-signup-error" : undefined
                        }
                    />
                    <button
                        type="submit"
                        className={styles.ctaBtn}
                        disabled={ctaSubmitting}
                    >
                        {ctaSubmitting ? "Sending…" : "Get Started Free"}
                    </button>
                </form>
                {ctaError ? (
                    <p id="cta-signup-error" className={styles.ctaError}>
                        {ctaError}
                    </p>
                ) : null}
            </section>

            {/* Footer */}
            <footer className={styles.footer}>
                <div className={styles.footerContent}>
                    <div>
                        <div className={styles.footerLogo}>
                            🏠 AI Assisted Living Companion
                        </div>
                        <p className={styles.footerDesc}>
                            Massachusetts&apos;s most trusted AI-powered
                            assisted living finder. Helping families make
                            informed decisions.
                        </p>
                    </div>
                    <div className={styles.footerLinks}></div>
                </div>
                <div className={styles.footerBottom}>
                    <p className={styles.footerCopyright}>
                        © 2026 Massachusetts AI Assisted Living Finder. All rights reserved.
                    </p>
                </div>
            </footer>

            {signupThanksOpen ? (
                <div
                    className={styles.thanksOverlay}
                    role="presentation"
                    onClick={() => setSignupThanksOpen(false)}
                >
                    <div
                        className={styles.thanksDialog}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="signup-thanks-title"
                        onClick={(ev) => ev.stopPropagation()}
                    >
                        <p
                            id="signup-thanks-title"
                            className={styles.thanksMessage}
                        >
                            Thank you for signing up for updates!
                        </p>
                        <button
                            type="button"
                            className={styles.thanksClose}
                            onClick={() => setSignupThanksOpen(false)}
                        >
                            OK
                        </button>
                    </div>
                </div>
            ) : null}
        </>
    );
}
