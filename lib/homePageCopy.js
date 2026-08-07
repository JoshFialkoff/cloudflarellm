/**
 * Single source for homepage marketing copy shared by `/` and `/index-video`.
 * Edit here to update both pages (hero variants below only affect `/index-video`).
 */

export const metaDescription =
    "AI-powered assisted living finder for Massachusetts. Find the perfect facility with compliance tracking and AI matching.";

export const metaDescriptionPrivacy =
    "Keep your family's questions private. AI-powered assisted living finder for Massachusetts using private AI which NEVER sends your data to companies or people.";

/** Top strip banner (`LandingBanner`) — separate from main hero `<h1>`. */
const bannerHeadline =
    "Find Assisted Living in Massachusetts without Spam";

const bannerHeadlinePrivacy =
    "Keep Your Assisted Living Questions Private";

/** Main hero headline on `/` (`pages/index.js`). */
const defaultHeroTitle =
    "In 2 minutes, find the best assisted living community based on your loved one's medical needs, budget, and location.";

const defaultHeroTitlePrivacy =
    "Keep Your Assisted Living Questions Private";

/** Top-of-page HTML banner (logo, headline over full-bleed rotating photos). */
export const landingBanner = {
    headline: bannerHeadline,
};

export const landingBannerPrivacy = {
    headline: bannerHeadlinePrivacy,
};

export const homePageDefault = {
    headTitle: "Best Massachusetts Assisted Living | Exclusive Data",
    heroTitle: defaultHeroTitle,
};

export const homePageDefaultPrivacy = {
    headTitle: "Keep Your Assisted Living Questions Private | Massachusetts Care Finder",
    heroTitle: defaultHeroTitlePrivacy,
};

/** Video-layout experiment route (`pages/index-video.js`) */
export const homePageVideoVariant = {
    headTitle:
        "Get AI-Powered Answers to Find Assisted Living Near You for Free",
    heroTitle:
        "Find Massachusetts assisted living options in about 2 minutes",
    heroSubtitle:
        "Answer a few guided questions and get AI-matched facilities based on care needs, budget, and location. No signup required.",
    heroVideoInviteTitle: "How Assistedly works",
};

export const footerCopyright =
    "© 2026 Assistedly. All rights reserved.";
