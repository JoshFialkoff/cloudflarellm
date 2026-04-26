#!/usr/bin/env node
/**
 * Founder-only Firecrawl run (wrapper).
 * Full implementation: scripts/firecrawl-social-engagement.cjs (FIRECRAWL_ENGAGEMENT_MODE=founder)
 */
process.env.FIRECRAWL_ENGAGEMENT_MODE = "founder";
require("./firecrawl-social-engagement.cjs")
    .main()
    .catch((e) => {
        // eslint-disable-next-line no-console
        console.error(e.message || e);
        process.exit(1);
    });
