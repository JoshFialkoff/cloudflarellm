/**
 * Primary navigation and tools directory — one place to add new tools so the
 * sticky nav and /tools hub stay in sync.
 */

/** Shown in the sticky bar under the site banner (all pages). */
export const SITE_PRIMARY_NAV = [
    { href: "/tools", label: "Tools" },
    { href: "/find-safest", label: "Safest Places" },
    /** Facility search stays distinct from partner-introduction workflows. */
    { href: "/search", label: "Find Help" },
    { href: "/tools/cost-calculator", label: "Compare Costs" },
];

/**
 * Cards on /tools — extend when you ship new flows.
 * @type {Array<{ href: string; title: string; description: string; tag?: string; displayHref?: string }>}
 */
export const SITE_TOOL_ENTRIES = [
    {
        href: "/find-safest",
        title: "Find safest assisted living",
        description:
            "Compare Massachusetts communities with safety-focused signals before you share contact information.",
        tag: "Research",
    },
    {
        href: "/partner-introductions",
        title: "Partner introductions",
        description:
            "Request an introduction to placement agencies, care advisors, or Medicaid planners — no obligation.",
        tag: "Platform",
    },
    {
        href: "/concierge",
        title: "Concierge shortlist",
        description:
            "Private-pay shortlist workflow for families who want hands-on comparison, fee-risk review, and move support.",
        tag: "Platform",
    },
    {
        href: "/tools/cost-calculator",
        title: "Care cost calculator",
        description:
            "Estimate assisted living and memory care monthly costs by region and care type.",
        tag: "Planning",
        displayHref: "/cost-calculator",
    },
    {
        href: "/search",
        title: "Search facilities",
        description:
            "Search Massachusetts assisted living by city or zip and filter by budget.",
        tag: "Explore",
    },
    {
        href: "/tools/memory-care-readiness",
        title: "Memory care readiness checklist",
        description:
            "Answer a few questions to see whether memory care timing is coming into view.",
        tag: "Assessment",
    },
    {
        href: "/bots/lowest-cost-assisted-living-finder",
        title: "AI placement assistant",
        description:
            "Guided chat to narrow options, budgets, and sensible next steps.",
        tag: "Assistant",
    },
];

/**
 * @param {string} pathname — Next.js `router.pathname` (dynamic segments as patterns).
 * @param {string} href
 */
export function siteNavItemIsActive(pathname, href) {
    if (href === "/tools") {
        return pathname === "/tools" || pathname.startsWith("/tools/");
    }
    if (href === "/tools/cost-calculator") {
        return (
            pathname === "/tools/cost-calculator" ||
            pathname === "/budget"
        );
    }
    return pathname === href;
}
