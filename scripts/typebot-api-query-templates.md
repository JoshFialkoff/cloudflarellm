# Typebot Analytics API Query Templates

Use these templates in daily automation to track Typebot usage and dropoff across paid channels.

## 1) PostHog HogQL template (question-level dropoff + paid source split)

Use with PostHog Query API (`/api/projects/{project_id}/query/`) or MCP `query-run` (`DataVisualizationNode` + `HogQLQuery`).

```sql
SELECT
  multiIf(
    lower(coalesce(properties.utm_source, '')) = 'reddit'
      OR lower(coalesce(properties.$current_url, '')) LIKE '%rdt_cid=%',
    'reddit',
    lower(coalesce(properties.utm_source, '')) = 'google'
      OR lower(coalesce(properties.$current_url, '')) LIKE '%gclid=%',
    'google',
    lower(coalesce(properties.utm_source, '')) = 'quantcast'
      OR lower(coalesce(properties.$current_url, '')) LIKE '%qcclkid=%',
    'quantcast',
    'other'
  ) AS paid_source,
  coalesce(nullIf(properties.question_id, ''), nullIf(properties.blockId, ''), nullIf(properties.id, ''), 'unknown') AS question_id,
  coalesce(nullIf(properties.question_type, ''), nullIf(properties.type, ''), 'unknown') AS question_type,
  countIf(event = 'typebot_question_viewed') AS viewed,
  countIf(event = 'typebot_answer_submitted') AS answered,
  countIf(event = 'typebot_step_completed') AS step_completed,
  countIf(event = 'typebot_started') AS started,
  countIf(event = 'typebot_completed') AS completed,
  countIf(event = 'typebot_abandoned') AS abandoned,
  viewed - answered AS dropoff_count,
  (viewed - answered) / nullIf(viewed, 0) AS dropoff_rate
FROM events
WHERE timestamp > now() - INTERVAL {{LOOKBACK_DAYS}} DAY
  AND event IN (
    'typebot_started',
    'typebot_question_viewed',
    'typebot_answer_submitted',
    'typebot_step_completed',
    'typebot_completed',
    'typebot_abandoned'
  )
GROUP BY paid_source, question_id, question_type
HAVING paid_source IN ('reddit', 'google', 'quantcast')
ORDER BY dropoff_count DESC
LIMIT 200
```

Example API JSON body:

```json
{
  "query": {
    "kind": "HogQLQuery",
    "query": "/* paste SQL above with {{LOOKBACK_DAYS}} replaced */"
  }
}
```

---

## 2) GA4 Data API `run_report` template (paid source + Typebot events)

Use with GA4 Data API or MCP `run_report`.

```json
{
  "property_id": "properties/470773585",
  "date_ranges": [
    {
      "start_date": "30daysAgo",
      "end_date": "yesterday",
      "name": "last30"
    }
  ],
  "dimensions": ["sessionSource", "eventName", "landingPagePlusQueryString"],
  "metrics": ["eventCount", "sessions", "screenPageViews", "engagedSessions", "userEngagementDuration"],
  "dimension_filter": {
    "and_group": {
      "expressions": [
        {
          "filter": {
            "field_name": "sessionSource",
            "in_list_filter": {
              "values": ["reddit", "google", "quantcast"],
              "case_sensitive": false
            }
          }
        },
        {
          "filter": {
            "field_name": "eventName",
            "in_list_filter": {
              "values": [
                "typebot_started",
                "typebot_question_viewed",
                "typebot_answer_submitted",
                "typebot_step_completed",
                "typebot_completed",
                "typebot_abandoned",
                "facility_contact_clicked"
              ],
              "case_sensitive": false
            }
          }
        }
      ]
    }
  },
  "order_bys": [
    {
      "metric": { "metric_name": "eventCount" },
      "desc": true
    }
  ],
  "limit": 5000
}
```

---

## 3) Reddit Ads API endpoint pattern (campaign delivery + cost)

Use this endpoint pattern to fetch campaign-level delivery for the same date range as analytics:

```text
GET https://ads-api.reddit.com/api/v3/ad_accounts/{AD_ACCOUNT_ID}/reports
  ?entity=CAMPAIGN
  &time_unit=DAY
  &start_time={{YYYY-MM-DD}}
  &end_time={{YYYY-MM-DD}}
  &metrics=impressions,clicks,spend
  &breakdowns=campaign_id
```

Headers:

```text
Authorization: Bearer {REDDIT_ADS_ACCESS_TOKEN}
User-Agent: aiassistliving-reddit-ads-sync/1.0
```

Fallback discovery flow:

1. `GET /api/v3/me/businesses`
2. `GET /api/v3/businesses/{business_id}/ad_accounts`
3. report endpoint above

Join key strategy:

- Join Reddit campaign rows to PostHog/GA via `campaign_id` and URL params (`rdt_cid`, `utm_campaign`, `utm_id`).
- If no explicit key is available, aggregate at source/day first, then backfill campaign mapping from ad URL exports.
