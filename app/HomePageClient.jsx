'use client'

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "../styles/Home.module.css";
import LandingBanner from "../components/LandingBanner";
import HomeBelowHero from "../components/HomeBelowHero";
import AIReferrerBanner from "../components/AIReferrerBanner";
import HomeScoresTabs from "../components/HomeScoresTabs";
import HomeHeroBlock from "../components/HomeHeroBlock";
import HomeFreeTextHero from "../components/HomeFreeTextHero";
import ConsumerLeadCapture from "../components/ConsumerLeadCapture";
import {
    homePageDefault,
    metaDescription,
    homePageDefaultPrivacy,
    metaDescriptionPrivacy,
} from "../lib/homePageCopy";
import { useFeatureFlagVariantKey } from "posthog-js/react";
import { HOMEPAGE_PRIVACY_EXPERIMENT_FLAG, HOMEPAGE_FREE_TEXT_ENTRY_FLAG } from "../lib/posthogClient";
import { pushConversionDataLayer } from "../lib/conversionDataLayer";
import {
    emailLengthBucket,
    trackEmailSignupFailed,
    trackEmailSignupSubmitted,
} from "../lib/authAnalytics";
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

export default function HomePageClient() {
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
    const router = useRouter();
    const heroVariantCapturedRef = useRef(false);

    const handleCta = async (e) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (!trimmed) return;
        setCtaError("");
        setCtaSubmitting(true);
        trackEmailSignupSubmitted({
            auth_surface: "homepage_email_signup",
            email_length_bucket: emailLengthBucket(trimmed.length),
        });
        try {
            const r = await fetch("/api/signup-discord", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: trimmed }),
            });
            const data = await r.json().catch(() => ({}));
            if (!r.ok) {
                trackEmailSignupFailed({
                    auth_surface: "homepage_email_signup",
                    error_message:
                        typeof data.error === "string"
                            ? data.error
                            : "signup_failed",
                });
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
            trackEmailSignupFailed({
                auth_surface: "homepage_email_signup",
                error_message: "network_error",
            });
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
        if (heroVariantCapturedRef.current) return;
        heroVariantCapturedRef.current = true;
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
        if (useDementia !== useDementiaHeadline) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setUseDementiaHeadline(useDementia);
        }
        if ((!hasHint && !useDementia) !== useFallbackRotation) {
            setUseFallbackRotation(!hasHint && !useDementia);
        }
         
    }, [useDementiaHeadline, useFallbackRotation]);

    useEffect(() => {
        if (!useFallbackRotation) return;
        const intervalId = window.setInterval(() => {
            setRotationStep((step) => (step + 1) % 2);
        }, FALLBACK_ROTATION_MS);
        return () => window.clearInterval(intervalId);
    }, [useFallbackRotation]);

    const privacyVariant = useFeatureFlagVariantKey(HOMEPAGE_PRIVACY_EXPERIMENT_FLAG);
    const isPrivacyMessaging = privacyVariant === 'privacy' || privacyVariant === true;

    const freeTextVariant = useFeatureFlagVariantKey(HOMEPAGE_FREE_TEXT_ENTRY_FLAG);
    const [urlFreeText, setUrlFreeText] = useState(null);
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUrlFreeText(new URLSearchParams(window.location.search).get('free_text'));
    }, []);
    const isFreeTextEntry = urlFreeText === '1';

    // Redirect variant traffic to /asks for 50/50 A/B test (URL override ?free_text=1 stays inline)
    useEffect(() => {
        if (urlFreeText === '1') return;
        if (freeTextVariant === undefined) return;
        if (freeTextVariant === 'free_text' || freeTextVariant === true) {
            router.replace('/asks');
        }
    }, [freeTextVariant, urlFreeText, router]);

    const activeHeadline = isPrivacyMessaging
        ? homePageDefaultPrivacy.heroTitle
        : useDementiaHeadline
          ? DEMENTIA_HEADLINE
          : useFallbackRotation
            ? rotationStep === 0
                ? DEFAULT_HEADLINE
                : MEMORY_CARE_HEADLINE
            : DEFAULT_HEADLINE;

    // Sync client-side dynamic title
    useEffect(() => {
        document.title = activeHeadline;
    }, [activeHeadline]);

    return (
        <>
            <AIReferrerBanner />

            <LandingBanner
                headlineOverride={isPrivacyMessaging && !personalization.bannerHeadline ? "Keep Your Assisted Living Questions Private" : personalization.bannerHeadline}
                kickerOverride={personalization.kicker}
                bannerAdCreativeUrl={personalization.adGraphic}
            />

            {isFreeTextEntry ? (
                <HomeFreeTextHero
                    useDementiaHeadline={useDementiaHeadline}
                    useFallbackRotation={useFallbackRotation}
                    rotationStep={rotationStep}
                    kicker={personalization.kicker}
                    videoInviteTitle={personalization.videoInviteTitle}
                    homepage_layout={homepage_layout}
                />
            ) : (
                <HomeHeroBlock
                    useDementiaHeadline={useDementiaHeadline}
                    useFallbackRotation={useFallbackRotation}
                    rotationStep={rotationStep}
                    kicker={personalization.kicker}
                    videoInviteTitle={personalization.videoInviteTitle}
                    typebotPrefill={personalization.typebotPrefill}
                    homepage_layout={homepage_layout}
                    useChart={false}
                    scoresTab={<HomeScoresTabs dataUrl="/data/chart-facilities.json" />}
                />
            )}

            <HomeBelowHero
                email={email}
                onEmailChange={(e) => setEmail(e.target.value)}
                onCtaSubmit={handleCta}
                ctaSubmitting={ctaSubmitting}
                ctaError={ctaError}
                privacyMessaging={isPrivacyMessaging}
            />

            <section style={{ maxWidth: "1100px", margin: "1.5rem auto 0", padding: "0 1.5rem 2rem" }}>
                <ConsumerLeadCapture
                    page="/"
                    leadMagnet="massachusetts-guide"
                    title="Get the Massachusetts assisted living starter kit"
                    description="Capture the transparency guide, tour checklist, town planning notes, and comparison prompts."
                />
            </section>

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
