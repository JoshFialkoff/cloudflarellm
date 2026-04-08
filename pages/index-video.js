import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Image from "next/image";
import styles from "../styles/Home.module.css";
import { useTypebotAnalytics } from "../hooks/useTypebotAnalytics";

const TYPEBOT_PUBLIC_ID =
    process.env.NEXT_PUBLIC_TYPEBOT_ID ||
    "1-31-26-working-thio-ass-living-k3253lu";
const TYPEBOT_API_HOST =
    process.env.NEXT_PUBLIC_TYPEBOT_API_HOST ||
    "https://bot-typebot-viewer.dqwglw.easypanel.host";
const TYPEBOT_API_ORIGIN = (() => {
    try {
        return new URL(TYPEBOT_API_HOST).origin;
    } catch {
        return TYPEBOT_API_HOST;
    }
})();

export default function HomeVideoVariant() {
    const [email, setEmail] = useState("");
    const [TypebotStandard, setTypebotStandard] = useState(null);
    const [showTypebot, setShowTypebot] = useState(false);
    const [showPlaceholder, setShowPlaceholder] = useState(true);
    const router = useRouter();
    const typebotAnalytics = useTypebotAnalytics();

    useEffect(() => {
        let isMounted = true;
        void import("@typebot.io/react")
            .then((mod) => {
                if (isMounted) {
                    setTypebotStandard(() => mod.Standard);
                }
            })
            .catch(() => undefined);

        void fetch(`${TYPEBOT_API_ORIGIN}/`, {
            mode: "no-cors",
            credentials: "omit",
        }).catch(() => undefined);

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!TypebotStandard) return undefined;

        const raf = window.requestAnimationFrame(() => {
            setShowTypebot(true);
        });
        const timeout = window.setTimeout(() => {
            setShowPlaceholder(false);
        }, 300);

        return () => {
            window.cancelAnimationFrame(raf);
            window.clearTimeout(timeout);
        };
    }, [TypebotStandard]);

    const handleCta = (e) => {
        e.preventDefault();
        router.push(
            `/search${email ? `?email=${encodeURIComponent(email)}` : ""}`,
        );
    };

    return (
        <>
            <Head>
                <title>
                    Compare Massachusetts assisted living options in 2
                    minutes
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
                <link
                    rel="prefetch"
                    href={`${TYPEBOT_API_ORIGIN}/`}
                    crossOrigin="anonymous"
                />
            </Head>

            <div className={styles.landingBanner} role="banner">
                <Image
                    src="/aialc-hero-banner.png"
                    alt="AI Assisted Living Companion — use exclusive data to find the best assisted living in Massachusetts"
                    className={styles.landingBannerImg}
                    width={1024}
                    height={268}
                    priority
                    sizes="(max-width: 768px) 100vw, 1024px"
                />
            </div>

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
                            <a href="#assistant" className={styles.searchBtn}>
                                Start 2-Minute Match
                            </a>
                            <a href="#how-it-works" className={styles.heroLinkBtn}>
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
                            className={`${styles.typebotEmbed} ${styles.heroTypebotAside}`}
                            id="assistant"
                            aria-label="AI assistant chat"
                        >
                            <div
                                style={{
                                    position: "relative",
                                    width: "100%",
                                    height: "min(600px, 70vh)",
                                    borderRadius: "12px",
                                    overflow: "hidden",
                                }}
                            >
                                {TypebotStandard ? (
                                    <div
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            opacity: showTypebot ? 1 : 0,
                                            transition: "opacity 300ms ease",
                                        }}
                                    >
                                        <TypebotStandard
                                            typebot={TYPEBOT_PUBLIC_ID}
                                            apiHost={TYPEBOT_API_HOST}
                                            style={{
                                                width: "100%",
                                                height: "min(600px, 70vh)",
                                                border: 0,
                                            }}
                                            onInit={typebotAnalytics.onInit}
                                            onNewInputBlock={
                                                typebotAnalytics.onNewInputBlock
                                            }
                                            onAnswer={typebotAnalytics.onAnswer}
                                        />
                                    </div>
                                ) : null}
                                {showPlaceholder ? (
                                    <div
                                        style={{
                                            position: "absolute",
                                            inset: 0,
                                            opacity: showTypebot ? 0 : 1,
                                            transition: "opacity 300ms ease",
                                            pointerEvents: "none",
                                        }}
                                    >
                                    <Image
                                        src="/typebot-placeholder.png"
                                        alt="AI assistant is loading"
                                        fill
                                        sizes="(max-width: 768px) 100vw, 40vw"
                                        style={{ objectFit: "cover" }}
                                    />
                                    </div>
                                ) : null}
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
