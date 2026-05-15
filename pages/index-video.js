import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import styles from "../styles/Home.module.css";
import LandingBanner from "../components/LandingBanner";
import HeroYouTubeFacade from "../components/HeroYouTubeFacade";
import HomeBelowHero from "../components/HomeBelowHero";
import HomeAssistantShell from "../components/HomeAssistantShell";
import HomeHeroActions from "../components/HomeHeroActions";
import {
    homePageVideoVariant,
    metaDescription,
} from "../lib/homePageCopy";
import { resolveLandingPersonalization } from "../lib/landingPersonalization";
import {
    HOMEPAGE_LAYOUT,
    captureLandingEvent,
} from "../lib/landingAnalytics";
import {
    hasReferralHeadlineHint,
    shouldUseDementiaHeadline,
} from "../lib/homepageHeadlineVariant";

const DEFAULT_HEADLINE = "Unbiased AI Finds Best Assisted Living in Massachusetts";
const MEMORY_CARE_HEADLINE = "Unbiased AI Finds Best Memory Care in Massachusetts";
const DEMENTIA_HEADLINE =
    "Unbiased AI Finds Best Memory Care for Dementia in Massachusetts";
const FALLBACK_ROTATION_MS = 6000;

export default function HomeVideoVariant() {
    const [email, setEmail] = useState("");
    const [personalization, setPersonalization] = useState(() => ({
        key: "default",
        heroTitle: homePageVideoVariant.heroTitle,
        bannerHeadline: "",
        kicker: "",
        videoInviteTitle: homePageVideoVariant.heroVideoInviteTitle,
        adGraphic: "",
        adText: "",
        community: "",
        source: "init",
        typebotPrefill: {},
    }));
    const router = useRouter();
    const [useDementiaHeadline, setUseDementiaHeadline] = useState(false);
    const [useFallbackRotation, setUseFallbackRotation] = useState(false);
    const [rotationStep, setRotationStep] = useState(0);
    const homepage_layout = HOMEPAGE_LAYOUT.youtube_inline;

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

    useEffect(() => {
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
        if (!router.isReady) return;
        const hasHint = hasReferralHeadlineHint();
        const useDementia = shouldUseDementiaHeadline();
        queueMicrotask(() => {
            setUseDementiaHeadline(useDementia);
            setUseFallbackRotation(!hasHint && !useDementia);
        });
    }, [router.isReady]);

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
                        <p className={styles.heroSubtitle}>
                            {homePageVideoVariant.heroSubtitle}
                        </p>
                        <HomeHeroActions homepage_layout={homepage_layout} />
                        <div className={styles.heroHomeVideo}>
                            <HeroYouTubeFacade
                                homepageLayout={homepage_layout}
                                inviteTitle={
                                    personalization.videoInviteTitle ||
                                    homePageVideoVariant.heroVideoInviteTitle
                                }
                                iframeTitle={
                                    personalization.videoInviteTitle ||
                                    homePageVideoVariant.heroVideoInviteTitle
                                }
                            />
                        </div>
                    </div>
                    <HomeAssistantShell
                        prefilledVariables={personalization.typebotPrefill}
                        homepage_layout={homepage_layout}
                    />
                </div>
            </section>

            <HomeBelowHero
                email={email}
                onEmailChange={(e) => setEmail(e.target.value)}
                onCtaSubmit={handleCta}
            />
        </>
    );
}
