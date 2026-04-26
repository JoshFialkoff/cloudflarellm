import { homePageDefault, landingBanner } from "./homePageCopy";
import { getSessionMarketingAttribution } from "./marketingAttribution";
import { HOMEPAGE_LAYOUT } from "./landingAnalytics";

const REALTIME_OVERRIDE_PATH = "/realtime/reddit-landing-override.json";

function cleanText(value, limit = 180) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    return raw.replace(/\s+/g, " ").slice(0, limit);
}

function parseCommunityLabel(rawValue) {
    const raw = cleanText(rawValue, 80);
    if (!raw) return "";
    if (raw.startsWith("r/")) return raw;
    if (raw.startsWith("r_")) return `r/${raw.slice(2)}`;
    return raw;
}

function chooseCommunityVariant(community) {
    const c = String(community || "").toLowerCase();
    if (!c) {
        return {
            key: "default",
            heroTitle: homePageDefault.heroTitle,
            bannerHeadline: landingBanner.headline,
            kicker: "AI-assisted matching for Massachusetts families",
            videoInviteTitle: "See how Assistedly finds the best-fit options.",
        };
    }
    if (/(dementia|alzheim|memory)/.test(c)) {
        return {
            key: "memory-care",
            heroTitle:
                "Find Massachusetts memory care options matched to your loved one's needs in about 2 minutes.",
            bannerHeadline: "Compare dementia and memory care options with AI-assisted guidance",
            kicker: "Built for families navigating dementia care decisions",
            videoInviteTitle: "Watch how Assistedly narrows memory care options fast.",
        };
    }
    if (/(caregiver|agingparents|eldercare)/.test(c)) {
        return {
            key: "caregiver",
            heroTitle:
                "Get caregiver-focused assisted living matches for Massachusetts in about 2 minutes.",
            bannerHeadline: "Caregiver-first assisted living matching for Massachusetts",
            kicker: "Designed for overwhelmed family caregivers",
            videoInviteTitle: "See how caregivers quickly shortlist the right communities.",
        };
    }
    if (/(personalfinance|legaladvice|cost|budget)/.test(c)) {
        return {
            key: "cost-planning",
            heroTitle:
                "Compare Massachusetts assisted living by care fit, pricing, and location in about 2 minutes.",
            bannerHeadline: "Make smarter assisted living decisions with transparent cost context",
            kicker: "Compare care quality and affordability in one flow",
            videoInviteTitle: "Watch how Assistedly helps families evaluate price vs care needs.",
        };
    }
    return {
        key: "community-general",
        heroTitle:
            "Find Massachusetts assisted living options tailored to your care priorities in about 2 minutes.",
        bannerHeadline: "AI-assisted Massachusetts assisted living matching",
        kicker: "Personalized to your community and care context",
        videoInviteTitle: "Watch how Assistedly personalizes recommendations.",
    };
}

export function resolveLandingPersonalization() {
    if (typeof window === "undefined") {
        return {
            key: "default",
            heroTitle: homePageDefault.heroTitle,
            bannerHeadline: landingBanner.headline,
            kicker: "",
            videoInviteTitle: "Watch why I created this service.",
            adGraphic: "",
            adText: "",
            community: "",
            source: "server",
        };
    }

    const sp = new URLSearchParams(window.location.search);
    const attribution = getSessionMarketingAttribution();
    const adText = cleanText(
        sp.get("ad_text") || sp.get("ad_headline") || sp.get("creative_text") || attribution.utm_content,
    );
    const adGraphic = cleanText(
        sp.get("ad_graphic") || sp.get("ad_image") || sp.get("creative_image"),
        500,
    );
    const community = parseCommunityLabel(
        sp.get("ad_community") || sp.get("community") || attribution.utm_term,
    );
    const baseVariant = chooseCommunityVariant(community);
    let realtimeOverride = null;
    try {
        const raw = localStorage.getItem("reddit_realtime_landing_override");
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === "object") {
                const maxAgeMs = Number(parsed.maxAgeMs || 0);
                const updatedAtMs = Number(parsed.updatedAtMs || 0);
                if (
                    Number.isFinite(maxAgeMs) &&
                    Number.isFinite(updatedAtMs) &&
                    Date.now() - updatedAtMs <= maxAgeMs
                ) {
                    realtimeOverride = parsed;
                }
            }
        }
    } catch {
        realtimeOverride = null;
    }

    // Async refresh of override blob for near-real-time tuning.
    void fetch(REALTIME_OVERRIDE_PATH, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
    })
        .then((r) => (r.ok ? r.json() : null))
        .then((payload) => {
            if (!payload || typeof payload !== "object") return;
            const next = {
                ...payload,
                updatedAtMs: Date.now(),
                maxAgeMs: Number(payload.maxAgeMs || 5 * 60 * 1000),
            };
            localStorage.setItem(
                "reddit_realtime_landing_override",
                JSON.stringify(next),
            );
        })
        .catch(() => {});

    const overrideMatch =
        realtimeOverride &&
        (
            (!realtimeOverride.segmentKey || realtimeOverride.segmentKey === baseVariant.key) &&
            (!realtimeOverride.community || String(realtimeOverride.community).toLowerCase() === String(community).toLowerCase())
        )
            ? realtimeOverride
            : null;
    const overrideLayout = overrideMatch?.homepage_layout;

    return {
        key: overrideMatch?.key || baseVariant.key,
        heroTitle: adText || cleanText(overrideMatch?.heroTitle) || baseVariant.heroTitle,
        bannerHeadline: cleanText(overrideMatch?.bannerHeadline) || baseVariant.bannerHeadline,
        kicker: cleanText(overrideMatch?.kicker) || baseVariant.kicker,
        videoInviteTitle:
            cleanText(overrideMatch?.videoInviteTitle) || baseVariant.videoInviteTitle,
        homepageLayout:
            overrideLayout === HOMEPAGE_LAYOUT.youtube_inline
                ? HOMEPAGE_LAYOUT.youtube_inline
                : HOMEPAGE_LAYOUT.youtube_facade,
        adGraphic:
            /^https?:\/\//i.test(adGraphic) && !/[\s"'<>]/.test(adGraphic)
                ? adGraphic
                : "",
        adText,
        community,
        source: "url+session",
    };
}
