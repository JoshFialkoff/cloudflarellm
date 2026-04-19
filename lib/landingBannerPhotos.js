/** Lifestyle photos for the top banner rail under the headline (`public/banner/*`). */
export const LANDING_BANNER_CAROUSEL_INTERVAL_MS = 5500;

/** When a slide omits `objectPosition`, `object-fit: cover` uses this anchor (Y = % from image top). */
export const LANDING_BANNER_DEFAULT_OBJECT_POSITION = "center 40%";

/**
 * @typedef {{ src: string, alt: string, objectPosition?: string }} LandingBannerSlide
 */

/** @type {LandingBannerSlide[]} */
export const LANDING_BANNER_CAROUSEL_SLIDES = [
    {
        src: "/banner/banner-1.png",
        alt: "Senior couple smiling while taking a selfie together indoors",
        objectPosition: "center 38%",
    },
    {
        src: "/banner/banner-2.png",
        alt: "Two women talking over coffee by a bright window",
        objectPosition: "center 36%",
    },
    {
        src: "/banner/banner-3.png",
        alt: "Care advisor listening to an older adult in a consultation",
        objectPosition: "center 34%",
    },
    {
        src: "/banner/banner-4.png",
        alt: "Adult helping a senior explore options on a laptop together",
        objectPosition: "center 46%",
    },
    {
        src: "/banner/banner-5.png",
        alt: "Older adult smiling while holding flowers",
        objectPosition: "center 44%",
    },
];
