const path = require("path");

function section(title, entries) {
  return { title, entries };
}

function entry(name, value = "") {
  return { name, value };
}

const appSections = [
  section("Canonical app env contract", [
    entry("CHAT_ENGINE", "dify"),
    entry("NEXT_PUBLIC_SITE_URL", "https://assistedly.ai"),
    entry("TEST_SITE_URL", "https://staging.assistedly.ai"),
    entry("SMOKE_BASE_URL", "http://127.0.0.1:3000"),
    entry("PRODUCTION_SMOKE_URL", "https://assistedly.ai/"),
    entry("STATUS_BASE_URL", "https://assistedly.ai"),
  ]),
  section("Public analytics and UX", [
    entry("NEXT_PUBLIC_POSTHOG_KEY"),
    entry("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com"),
    entry("NEXT_PUBLIC_GA_MEASUREMENT_ID"),
    entry("NEXT_PUBLIC_HOMEPAGE_ASSISTANT"),
    entry("NEXT_PUBLIC_STRIPE_UPGRADE_URL", "https://buy.stripe.com/fZubJ02Gd3eKeyV5lm6Ri00"),
    entry("NEXT_PUBLIC_BANNER_USE_PROXY"),
    entry("NEXT_ALLOWED_DEV_ORIGINS"),
  ]),
  section("Auth and email", [
    entry("AUTH_PUBLIC_URL"),
    entry("AUTH_EMAIL_FROM", "Assistedly <hello@assistedly.ai>"),
    entry("AUTH_MAGIC_LINK_SECRET"),
    entry("AUTH_ALLOW_TEST_LINK_FALLBACK"),
    entry("NEXTAUTH_SECRET"),
    entry("RESEND_API_KEY"),
  ]),
  section("Homepage wizard and chat AI", [
    entry("DIFY_API_KEY"),
    entry("DIFY_API_BASE_URL", "https://dify.forwardjump.com/v1"),
    entry("DIFY_APP_KIND"),
    entry("DIFY_WORKFLOW_API_KEY"),
    entry("DIFY_WORKFLOW_INPUT_KEY"),
    entry("DIFY_WORKFLOW_EXTRA_INPUTS_JSON"),
    entry("DIFY_CONSOLE_TOKEN"),
    entry("DIFY_CONSOLE_BASE_URL", "https://dify.forwardjump.com"),
    entry("OPENAI_API_KEY"),
    entry("OPENAI_BASE_URL", "https://api.openai.com/v1"),
    entry("OPENAI_CHAT_MODEL", "gpt-4o-mini"),
    entry("NATIVE_CHAT_USE_LLM"),
  ]),
  section("Facility AI flows", [
    entry("FACILITY_DEEP_DIVE_DIFY_API_KEY"),
    entry("FACILITY_DEEP_DIVE_DIFY_BASE_URL", "https://dify.forwardjump.com/v1"),
    entry("FACILITY_KB_INSIGHT_DIFY_API_KEY"),
    entry("FACILITY_KB_INSIGHT_DIFY_BASE_URL", "https://dify.forwardjump.com/v1"),
  ]),
  section("Business logic and source gating", [
    entry("ASSISTEDLY_ADMIN_EMAILS"),
    entry("ASSISTEDLY_FACILITY_REP_EMAILS"),
    entry("ASSISTEDLY_PREMIUM_EMAILS"),
    entry("NOCODB_DASHBOARD_BASE"),
    entry("NOCODB_PROJECT_ID"),
    entry("NOCODB_DEFAULT_TABLE_ID"),
    entry("NOCODB_DEFAULT_VIEW_ID"),
    entry("SOURCE_LINK_SECRET"),
    entry("MVP_DATA_FILE"),
  ]),
  section("Discord and notifications", [
    entry("DISCORD_SIGNUP_WEBHOOK_URL"),
    entry("DISCORD_CHAT_ALERT_WEBHOOK_URL"),
    entry("DISCORD_DAILY_ANALYTICS_WEBHOOK_URL"),
    entry("DISCORD_SERVER_OPS_WEBHOOK_URL"),
    entry("DISCORD_CONCIERGE_WEBHOOK_URL"),
    entry("DISCORD_WEBHOOK_URL"),
    entry("DISCORD_DEPLOY_WEBHOOK_URL"),
    entry("DISCORD_STATUS_WEBHOOK_URL"),
    entry("DISCORD_POSTHOG_ERRORS_WEBHOOK_URL"),
    entry("DISCORD_GITHUB_UPDATES_WEBHOOK_URL"),
    entry("DISCORD_DEPENDABOT_WEBHOOK_URL"),
    entry("DISCORD_BOT_TOKEN"),
    entry("DISCORD_APPROVAL_CHANNEL_ID"),
  ]),
  section("PostHog and GA4 server jobs", [
    entry("POSTHOG_API_KEY"),
    entry("POSTHOG_PROJECT_ID"),
    entry("POSTHOG_HOST", "https://us.posthog.com"),
    entry("POSTHOG_BASELINE_START_UTC"),
    entry("POSTHOG_ERRORS_DISCORD_SKIP"),
    entry("POSTHOG_ERROR_DIGEST_DAYS"),
    entry("POSTHOG_ERROR_DIGEST_ORG"),
    entry("POSTHOG_ERROR_TOP_N"),
    entry("DAILY_ANALYTICS_DISCORD_SKIP"),
    entry("DAILY_ANALYTICS_LOOKBACK_HOURS"),
    entry("DAILY_ANALYTICS_URGENCY_THRESHOLD"),
    entry("DAILY_ANALYTICS_VIDEO_DURATION_THRESHOLD_SEC"),
    entry("GA4_ACCESS_TOKEN"),
    entry("GA4_PROPERTY_ID"),
  ]),
  section("Cloudflare, tunnels, and deploys", [
    entry("ASSISTEDLY_TUNNEL_TOKEN"),
    entry("CLOUDFLARE_TUNNEL_TOKEN"),
    entry("CLOUDFLARE_TUNNEL_URL"),
    entry("CF_TUNNEL_URL"),
    entry("DEV_PUBLIC_URL"),
    entry("DEV_TUNNEL_BRIDGE_PORTS"),
    entry("AGENT1_BRIDGE_HOST"),
    entry("AGENT1_BRIDGE_PORT"),
    entry("TUNNEL_UPSTREAM_PORT"),
    entry("TUNNEL_URL"),
    entry("CLOUDFLARE_ZONE_ID"),
    entry("CLOUDFLARE_API_TOKEN"),
    entry("CLOUDFLARE_PURGE_REQUIRED"),
    entry("DEPLOY_HOST", "75.127.14.185"),
    entry("DEPLOY_SSH_HOST"),
    entry("DEPLOY_USER", "opencode"),
    entry("DEPLOY_KEY"),
    entry("DEPLOY_REPO_DIR", "/opt/assistedly"),
    entry("DEPLOY_COMPOSE_PROJECT", "assistedlyai"),
    entry("DEPLOY_COMPOSE_FILE", "compose.dify-host.yaml"),
  ]),
  section("Server ops and automation", [
    entry("GOOGLE_SERVICE_ACCOUNT_JSON"),
    entry("GOOGLE_SHEET_TAB", "Server health"),
    entry("GITHUB_TOKEN"),
    entry("SOCIAL_TRACKING_LINK"),
    entry("SOCIAL_ENGAGEMENT_TRACKING_LINK"),
    entry("SOCIAL_REPORT_PATH"),
    entry("SOCIAL_LOOKBACK_DAYS"),
    entry("SOCIAL_MAX_LEADS"),
    entry("SOCIAL_DISCORD_MIN_POSTS"),
    entry("SOCIAL_DISCORD_MAX_POSTS"),
  ]),
];

const dataForSeoSections = [
  section("Canonical DataForSEO local env contract", [
    entry("DATAFORSEO_USERNAME"),
    entry("DATAFORSEO_PASSWORD"),
    entry("DATAFORSEO_LOGIN"),
    entry("DATAFORSEO_API_PASSWORD"),
    entry("DATAFORSEO_LOCATION_CODE", "2840"),
    entry("DATAFORSEO_LANG", "en"),
  ]),
];

const redditAdsSections = [
  section("Canonical Reddit ads and Firecrawl env contract", [
    entry("FIRECRAWL_API_KEY"),
    entry("FIRECRAWL_AGENT_MODEL", "spark-1-mini"),
    entry("FIRECRAWL_ENGAGEMENT_MODE"),
    entry("FIRECRAWL_FOUNDER_MODEL"),
    entry("FIRECRAWL_ORGANIC_MODEL"),
    entry("DISCORD_WEBHOOK_URL"),
    entry("ORGANIC_DISCORD_AUTO_SEND"),
    entry("ORGANIC_DISCORD_MAX_LEADS"),
    entry("ORGANIC_DISCORD_MESSAGE_DELAY_MS", "600"),
    entry("ORGANIC_DISCORD_REPORT_PATH"),
    entry("FOUNDER_DISCORD_AUTO_SEND"),
    entry("FOUNDER_DISCORD_MAX_LEADS"),
    entry("DATAFORSEO_USERNAME"),
    entry("DATAFORSEO_PASSWORD"),
    entry("DATAFORSEO_LOCATION_CODE", "2840"),
    entry("DATAFORSEO_LANG", "en"),
    entry("REDDIT_OAUTH_TOKEN_URL", "https://www.reddit.com/api/v1/access_token"),
    entry("REDDIT_CLIENT_ID"),
    entry("REDDIT_CLIENT_SECRET"),
    entry("REDDIT_OAUTH_REDIRECT_URI", "http://127.0.0.1:8765/reddit/callback"),
    entry("REDDIT_OAUTH_PORT", "8765"),
    entry("REDDIT_OAUTH_CALLBACK_PATH", "/reddit/callback"),
    entry("REDDIT_OAUTH_SCOPE"),
    entry("REDDIT_REFRESH_TOKEN"),
    entry("REDDIT_USER_AGENT", "cursor-ads-oauth/1.0 by /u/YOUR_REDDIT_USERNAME (contact: https://example.com/contact)"),
    entry("REDDIT_ADS_ACCESS_TOKEN"),
    entry("REDDIT_ADS_BASE_URL", "https://ads-api.reddit.com/api/v3"),
    entry("REDDIT_AD_ACCOUNT_ID"),
    entry("REDDIT_SYNC_BASE_URL", "https://assistedly.ai/"),
    entry("REDDIT_SYNC_CAMPAIGN_TAG", "reddit_caregiver_q2_2026"),
    entry("REDDIT_APPROVAL_POLL_SEC"),
    entry("REDDIT_APPROVAL_TIMEOUT_SEC"),
    entry("REDDIT_OPTIMIZER_DAYS"),
    entry("REDDIT_OPTIMIZER_LOOP_SEC"),
    entry("REDDIT_ATTRIBUTION_DAYS"),
    entry("REDDIT_AUTONOMOUS_DRY_RUN"),
    entry("REDDIT_AUTONOMOUS_MAX_CPC_USD"),
    entry("REDDIT_AUTONOMOUS_MAX_PAUSES_PER_CYCLE"),
    entry("REDDIT_AUTONOMOUS_MIN_CTR"),
    entry("REDDIT_AUTONOMOUS_MIN_IMPRESSIONS"),
    entry("REDDIT_BENCHMARK_ADS_JSON"),
    entry("REDDIT_AGENT_TRANSCRIPT_PATH"),
  ]),
];

const ENV_CONTRACT_FILES = [
  {
    profile: "app",
    path: ".env.example",
    intro: [
      "Canonical app env contract for local, staging, and production.",
      "Copy this file to .env.local, .env.production, or another env file for the target environment.",
      "Keep the same keys across environments; only the values should differ.",
      "Never commit real secrets to any tracked env file.",
    ],
    sections: appSections,
  },
  {
    profile: "dataforseo",
    path: ".env.dataforseo.local.example",
    intro: [
      "Canonical DataForSEO env contract.",
      "Copy this file to .env.dataforseo.local and fill values locally.",
      "Do not commit the populated file.",
    ],
    sections: dataForSeoSections,
  },
  {
    profile: "reddit-ads",
    path: ".env.reddit-ads.example",
    intro: [
      "Canonical Reddit ads and Firecrawl env contract.",
      "Copy the keys you need into .env.local for local runs.",
      "Keep the key names in sync with this file even when values differ by environment.",
    ],
    sections: redditAdsSections,
  },
];

function renderEnvFile(fileSpec) {
  const lines = [];
  for (const line of fileSpec.intro) lines.push(`# ${line}`);
  lines.push("");
  for (const currentSection of fileSpec.sections) {
    lines.push(`# ${currentSection.title}`);
    for (const currentEntry of currentSection.entries) {
      lines.push(`${currentEntry.name}=${currentEntry.value}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

function resolveContractFile(repoRoot, profileOrPath) {
  return ENV_CONTRACT_FILES.find(
    (fileSpec) =>
      fileSpec.profile === profileOrPath ||
      path.resolve(repoRoot, fileSpec.path) === path.resolve(repoRoot, profileOrPath),
  );
}

module.exports = {
  ENV_CONTRACT_FILES,
  renderEnvFile,
  resolveContractFile,
};
