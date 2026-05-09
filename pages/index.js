import { useEffect, useState } from "react";
import Head from "next/head";
import styles from "../styles/Home.module.css";
import LandingBanner from "../components/LandingBanner";
import HeroYouTubeFacade from "../components/HeroYouTubeFacade";
import HomeBelowHero from "../components/HomeBelowHero";
import HomeTypebotHeroEmbed from "../components/HomeTypebotHeroEmbed";
import { useTypebotAnalytics } from "../hooks/useTypebotAnalytics";
import { HOMEPAGE_LAYOUT, captureLandingEvent } from "../lib/landingAnalytics";
import { useTypebotStandardLoader } from "../hooks/useTypebotStandardLoader";
import { TYPEBOT_API_ORIGIN } from "../lib/homeTypebotBootstrap";
import {
    homePageDefault,
    metaDescription,
} from "../lib/homePageCopy";
import { pushConversionDataLayer } from "../lib/conversionDataLayer";
import { resolveLandingPersonalization } from "../lib/landingPersonalization";
import {
    hasReferralHeadlineHint,
    shouldUseDementiaHeadline,
} from "../lib/homepageHeadlineVariant";

const DEFAULT_HEADLINE = "Unbiased AI Finds Best Assisted Living in Massachusetts";
const MEMORY_CARE_HEADLINE = "Unbiased AI Finds Best Memory Care in Massachusetts";
const DEMENTIA_HEADLINE =
    "Unbiased AI Finds Best Memory Care for Dementia in Massachusetts";
const FALLBACK_ROTATION_MS = 6000;

export default function Home() {
    const [email, setEmail] = useState("");
    const [signupThanksOpen, setSignupThanksOpen] = useState(false);
    const [ctaSubmitting, setCtaSubmitting] = useState(false);
    const [ctaError, setCtaError] = useState("");
    const [personalization, setPersonalization] = useState(() => ({
        key: "default",
        heroTitle: homePageDefault.heroTitle,
        bannerHeadline: "",
        kicker: "",
        videoInviteTitle: "Watch why I created this service.",
        adGraphic: "",
        adText: "",
        community: "",
        source: "init",
        typebotPrefill: {},
    }));
    const [useDementiaHeadline, setUseDementiaHeadline] = useState(false);
    const [useFallbackRotation, setUseFallbackRotation] = useState(false);
    const [rotationStep, setRotationStep] = useState(0);
    const homepage_layout = HOMEPAGE_LAYOUT.youtube_facade;
    const typebotAnalytics = useTypebotAnalytics({ homepage_layout });
    const {
        typebotSectionRef,
        TypebotStandard,
        typebotImportError,
        retryTypebotImport,
    } = useTypebotStandardLoader({
        onImportStarted: typebotAnalytics.onImportStarted,
        onImportSucceeded: typebotAnalytics.onImportSucceeded,
        onImportFailed: typebotAnalytics.onImportFailed,
    });

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
            captureLandingEvent("generate_lead", {
                homepage_layout,
                lead_source: "email_signup",
            });
            pushConversionDataLayer({
                event: "generate_lead",
                lead_source: "email_signup",
            });
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

    useEffect(() => {
        const sp = new URLSearchParams(window.location.search);
        if (sp.get("typebot_entry") === "lowest_cost_assisted_living_finder") {
            sp.set("lower_cost_bot", "1");
            window.location.replace(`/tools/cost-calculator?${sp.toString()}#lower-cost-bot`);
            return;
        }

        const next = resolveLandingPersonalization();
        queueMicrotask(() => {
            setPersonalization(next);
        });
        captureLandingEvent("hero_variant_shown", {
            homepage_layout,
            hero_variant: next.key,
            ad_text_present: Boolean(next.adText),
            ad_graphic_present: Boolean(next.adGraphic),
            ad_community: next.community || undefined,
            personalization_source: next.source,
        });
    }, [homepage_layout]);

    useEffect(() => {
        const hasHint = hasReferralHeadlineHint();
        const useDementia = shouldUseDementiaHeadline();
        setUseDementiaHeadline(useDementia);
        setUseFallbackRotation(!hasHint && !useDementia);
    }, []);

    useEffect(() => {
        if (!useFallbackRotation) return;

        const intervalId = window.setInterval(() => {
            setRotationStep((step) => (step + 1) % 2);
        }, FALLBACK_ROTATION_MS);

        return () => window.clearInterval(intervalId);
    }, [useFallbackRotation]);

    const activeHeadline = useDementiaHeadline
        ? DEMENTIA_HEADLINE
        : useFallbackRotation
          ? rotationStep === 0
              ? DEFAULT_HEADLINE
              : MEMORY_CARE_HEADLINE
          : DEFAULT_HEADLINE;

    return (
        <>
            <Head>
                <title>{activeHeadline}</title>
                <meta name="description" content={metaDescription} />
                <meta
                    name="viewport"
                    content="width=device-width, initial-scale=1"
                />
                <meta name="app-shell" content="site-tools-nav" />
                <link rel="dns-prefetch" href={TYPEBOT_API_ORIGIN} />
                <link
                    rel="preconnect"
                    href={TYPEBOT_API_ORIGIN}
                    crossOrigin="anonymous"
                />
            </Head>

            <LandingBanner
                headlineOverride={personalization.bannerHeadline}
                kickerOverride={personalization.kicker}
                bannerAdCreativeUrl={personalization.adGraphic}
            />

            <section className={styles.hero}>
                <div className={styles.heroInner}>
                    <div
                        className={`${styles.heroContent} ${styles.heroHomeContent}`}
                    >
                        <h1 className={styles.heroTitle}>{activeHeadline}</h1>
                        {personalization.kicker ? (
                            <p className={styles.heroProof}>
                                {personalization.kicker}
                            </p>
                        ) : null}
                        <div className={styles.heroHomeVideo}>
                            <HeroYouTubeFacade
                                inviteTitle={personalization.videoInviteTitle}
                            />
                        </div>
                    </div>
                    <HomeTypebotHeroEmbed
                        typebotSectionRef={typebotSectionRef}
                        TypebotStandard={TypebotStandard}
                        typebotImportError={typebotImportError}
                        onRetryTypebotImport={retryTypebotImport}
                        prefilledVariables={personalization.typebotPrefill}
                        onInit={typebotAnalytics.onInit}
                        onNewInputBlock={typebotAnalytics.onNewInputBlock}
                        onAnswer={typebotAnalytics.onAnswer}
                        onEnd={typebotAnalytics.onEnd}
                        onEmbedMount={typebotAnalytics.onEmbedMount}
                        onEmbedTimeout={typebotAnalytics.onEmbedTimeout}
                    />
                </div>
            </section>

            <HomeBelowHero
                email={email}
                onEmailChange={(e) => setEmail(e.target.value)}
                onCtaSubmit={handleCta}
                ctaSubmitting={ctaSubmitting}
                ctaError={ctaError}
            />

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
