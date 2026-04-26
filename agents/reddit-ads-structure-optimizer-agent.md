# Reddit Ads Structure Optimizer Agent

Use this agent to identify winning Reddit ads and enforce targeting best practices at campaign/ad-group level.

## Run

- `npm run agent:reddit:optimize`

## Inputs

- Reddit Ads API inventory:
  - campaigns (`/ad_accounts/{id}/campaigns`)
  - ad groups (`/ad_accounts/{id}/ad_groups`)
  - ads (`/ad_accounts/{id}/ads`)
  - account delivery snapshot (`POST /ad_accounts/{id}/reports`)
- Benchmark winners:
  - default in script (three best CTR ads)
  - optional override via `REDDIT_BENCHMARK_ADS_JSON`

## Best-practice checks

1. Community ad groups should use subreddit/community targeting only.
2. Keyword ad groups should use keyword targeting only.
3. Mixed keyword+community ad groups should be split.
4. Empty ad groups should be paused or populated.

## Output

- `reports/reddit-structure-optimizer-<timestamp>.json`
- `reports/reddit-structure-optimizer-<timestamp>.md`

Each run provides:

- top-performing benchmark ad ranking
- targeting hygiene findings for each ad group
- prioritized actions
- winner-ad variation recommendations for relevant ad groups
