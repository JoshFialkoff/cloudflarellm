/**
 * Single source for homepage marketing copy shared by `/` and `/index-video`.
 * Edit here to update both pages (hero variants below only affect `/index-video`).
 */

export const metaDescription =
    "AI-powered assisted living finder for Massachusetts. Find the perfect facility with compliance tracking and AI matching.";

/** Top strip banner (`LandingBanner`) — separate from main hero `<h1>`. */
const bannerHeadline =
    "Access Exclusive Data to Find Best Massachusetts Assisted Living";

/** Main hero headline on `/` (`pages/index.js`). */
const defaultHeroTitle =
    "In 2 minutes, find the best assisted living community based on your loved one's medical needs, budget, and location.";

/** Top-of-page HTML banner (logo, headline, photo carousel). */
export const landingBanner = {
    headline: bannerHeadline,
};

export const homePageDefault = {
    headTitle: "Best Massachusetts Assisted Living | Exclusive Data",
    heroTitle: defaultHeroTitle,
};

/** Video-layout experiment route (`pages/index-video.js`) */
export const homePageVideoVariant = {
    headTitle:
        "Get AI-Powered Answers to Find Assisted Living Near You for Free",
    heroTitle:
        "Find Massachusetts assisted living options in about 2 minutes",
    heroSubtitle:
        "Answer a few guided questions and get AI-matched facilities based on care needs, budget, and location. No signup required.",
    heroVideoInviteTitle: "How AI Assisted Living Companion works",
};

export const footerCopyright =
    "© 2026 Massachusetts AI Assisted Living Finder. All rights reserved.";
