import { useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import styles from "../styles/Home.module.css";
import LandingBanner from "../components/LandingBanner";
import { useTypebotAnalytics } from "../hooks/useTypebotAnalytics";
import {
    HOMEPAGE_LAYOUT,
    captureLandingEvent,
} from "../lib/landingAnalytics";
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

export default function HomeVideoVariant() {
    const [email, setEmail] = useState("");
    const router = useRouter();
    const homepage_layout = HOMEPAGE_LAYOUT.youtube_inline;
    const typebotAnalytics = useTypebotAnalytics({ homepage_layout });
    const { typebotSectionRef, TypebotStandard } = useTypebotStandardLoader();

    const handleTypebotInit = () => {
        typebotAnalytics.onInit?.();
    };

    const handleTypebotNewInputBlock = (input) => {
        typebotAnalytics.onNewInputBlock?.(input);
    };

    const handleCta = (e) => {
        e.preventDefault();
        captureLandingEvent("landing_footer_get_started", {
            homepage_layout,
            has_email: Boolean(email && email.trim()),
        });
        router.push(
            `/search${email ? `?email=${encodeURIComponent(email)}` : ""}`,
        );
    };

    return (
        <>
            <Head>
                <title>
                Get AI-Powered Answers to Find Assisted Living Near You for Free
                </title>
                <meta
                    name="description"
                    content="AI-powered assisted living finder for Massachusetts. Find the perfect facility with compliance tracking and AI matching."
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
                    <div className={styles.heroContent}>
                        <h1 className={styles.heroTitle}>
                            Find Massachusetts assisted living options in about 2
                            minutes
                        </h1>
                        <p className={styles.heroSubtitle}>
                            Answer a few guided questions and get AI-matched
                            facilities based on care needs, budget, and
                            location. No signup required.
                        </p>
                        <div className={styles.heroActions}>
                            <a
                                href="#assistant"
                                className={styles.searchBtn}
                                onClick={() =>
                                    captureLandingEvent(
                                        "landing_hero_link_click",
                                        {
                                            homepage_layout,
                                            cta_id: "start_match",
                                        },
                                    )
                                }
                            >
                                Start 2-Minute Match
                            </a>
                            <a
                                href="#how-it-works"
                                className={styles.heroLinkBtn}
                                onClick={() =>
                                    captureLandingEvent(
                                        "landing_hero_link_click",
                                        {
                                            homepage_layout,
                                            cta_id: "see_how_it_works",
                                        },
                                    )
                                }
                            >
                                See How It Works
                            </a>
                        </div>
                        <div
                            style={{
                                marginTop: "16px",
                                width: "100%",
                                maxWidth: "560px",
                                borderRadius: "12px",
                                overflow: "hidden",
                                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.12)",
                            }}
                        >
                            <iframe
                                width="560"
                                height="315"
                                src="https://www.youtube.com/embed/6f4i0VEgFWI"
                                title="How AI Assisted Living Companion works"
                                style={{
                                    border: 0,
                                    width: "100%",
                                    aspectRatio: "16 / 9",
                                    height: "auto",
                                    display: "block",
                                }}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                referrerPolicy="strict-origin-when-cross-origin"
                                allowFullScreen
                            />
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
                                            onNewInputBlock={handleTypebotNewInputBlock}
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
                        Finding the right assisted living facility has never
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
                                guides you through every important decision you need to make.
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
                                Compare facilities side-by-side with full
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
                                licensed facility in Massachusetts.
                            </p>
                        </div>
                        <div className={styles.trustCard}>
                            <div className={styles.trustCardIcon}>🤖</div>
                            <h3 className={styles.trustCardTitle}>
                                AI-Powered Matching
                            </h3>
                            <p className={styles.trustCardDesc}>
                                Our machine learning algorithms consider 50+
                                factors to match your loved one with facilities
                                that truly meet their needs.
                            </p>
                        </div>
                        <div className={styles.trustCard}>
                            <div className={styles.trustCardIcon}>📊</div>
                            <h3 className={styles.trustCardTitle}>
                                Transparent Data
                            </h3>
                            <p className={styles.trustCardDesc}>
                                No hidden fees or pay-to-rank facilities. All
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
                    <div className={styles.statLabel}>Facilities Listed</div>
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
                    Find the right assisted living facility for your loved one
                    with AI Assisted Living Companion.
                </p>
                <form className={styles.ctaForm} onSubmit={handleCta}>
                    <input
                        type="email"
                        className={styles.ctaInput}
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />
                    <button type="submit" className={styles.ctaBtn}>
                        Get Started Free
                    </button>
                </form>
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
                    <div className={styles.footerLinks}>
                    </div>
                </div>
                <div className={styles.footerBottom}>
                    <p className={styles.footerCopyright}>
                        © 2026 AI Assisted Living Finder. All rights reserved.
                        Focused on Massachusetts assisted living.
                    </p>
                </div>
            </footer>
        </>
    );
}
