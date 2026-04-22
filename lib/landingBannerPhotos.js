/** Lifestyle photos for the top banner rail under the headline (`public/banner/*`). */
export const LANDING_BANNER_CAROUSEL_INTERVAL_MS = 5500;

/** When a slide omits `objectPosition`, `object-fit: cover` uses this anchor (Y = % from image top). */
export const LANDING_BANNER_DEFAULT_OBJECT_POSITION = "center 24%";

/**
 * @typedef {{
 *   src: string,
 *   alt: string,
 *   objectPosition?: string,
 *   objectPositionMobile?: string,
 *   proxyPaths?: string[]
 * }} LandingBannerSlide
 */

/**
 * Build `/api/image-proxy` URL with one or more candidate paths.
 * The proxy returns the first available match, which helps keep hero crops stable.
 * @param {string[] | string} paths
 * @param {"wide"|"portrait"|"square"} ratio
 */
export function buildBannerProxyUrl(paths, ratio = "wide") {
    const list = Array.isArray(paths) ? paths : [paths];
    const cleaned = list.map((p) => String(p || "").trim()).filter(Boolean);
    if (!cleaned.length) return "";
    const params = new URLSearchParams();
    params.set("ratio", ratio);
    cleaned.forEach((p) => params.append("path", p.replace(/^\/+/, "")));
    return `/api/image-proxy?${params.toString()}`;
}

/** @type {LandingBannerSlide[]} */
export const LANDING_BANNER_CAROUSEL_SLIDES = [
    {
        src: "/banner/banner-1.png",
        alt: "Senior couple smiling while taking a selfie together indoors",
        /* First slide comp is lower in source; shift focal point downward. */
        objectPosition: "center 56%",
        objectPositionMobile: "center 52%",
        proxyPaths: ["2026/02/banner-1.png", "2026/01/banner-1.png"],
    },
    {
        src: "/banner/banner-2.png",
        alt: "Two women talking over coffee by a bright window",
        objectPosition: "center 24%",
        objectPositionMobile: "center 20%",
        proxyPaths: ["2026/02/banner-2.png", "2026/01/banner-2.png"],
    },
    {
        src: "/banner/banner-3.png",
        alt: "Care advisor listening to an older adult in a consultation",
        objectPosition: "center 20%",
        objectPositionMobile: "center 16%",
        proxyPaths: ["2026/02/banner-3.png", "2026/01/banner-3.png"],
    },
    {
        src: "/banner/banner-4.png",
        alt: "Adult helping a senior explore options on a laptop together",
        /* Seated/laptop composition still needs faces preserved above center */
        objectPosition: "center 28%",
        objectPositionMobile: "center 24%",
        proxyPaths: ["2026/02/banner-4.png", "2026/01/banner-4.png"],
    },
    {
        src: "/banner/banner-5.png",
        alt: "Older adult smiling while holding flowers",
        /* Overhead angle; keep face near upper-middle without clipping */
        objectPosition: "center 30%",
        objectPositionMobile: "center 26%",
        proxyPaths: ["2026/02/banner-5.png", "2026/01/banner-5.png"],
    },
];
