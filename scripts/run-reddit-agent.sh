#!/bin/bash
set -euo pipefail

REPO_DIR="${REPO_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
cd "$REPO_DIR"

# Load local secrets/config for scheduled runs.
[ -f ".env.local" ] && set -a && source ".env.local" && set +a

npm run agent:reddit

# Send concise urgent/important summary to Discord when configured.
if [ -n "${DISCORD_WEBHOOK_URL:-}" ]; then
  LATEST_JSON="$(ls -t ./reports/reddit-agent-*.json 2>/dev/null | head -n 1 || true)"
  if [ -n "$LATEST_JSON" ] && [ -f "$LATEST_JSON" ]; then
    python3 - "$LATEST_JSON" <<'PY' | curl -sS -H "Content-Type: application/json" -X POST --data-binary @- "$DISCORD_WEBHOOK_URL" >/dev/null
import json
import sys
from datetime import datetime
from pathlib import Path

p = Path(sys.argv[1])
data = json.loads(p.read_text())
metrics = data.get("metrics", {})
baseline = data.get("baseline", {}) or {}
ranking = data.get("questionUrgencyRanking", []) or []
paid = data.get("paidAds", {}) or {}
ga4 = data.get("ga4", {}) or {}
reddit_ads = data.get("redditAds", {}) or {}
report_dir = p.parent

CPA_ALERT_USD = float((__import__("os").environ.get("REDDIT_CPA_ALERT_USD") or "150").strip() or "150")
NO_CONTACTS_SPEND_ALERT_USD = float((__import__("os").environ.get("REDDIT_SPEND_ALERT_NO_CONTACTS_USD") or "100").strip() or "100")

reddit_contact = float(metrics.get("redditContactRate", 0) or 0)
sitewide_contact = float(metrics.get("sitewideContactRate", 0) or 0)
gap = sitewide_contact - reddit_contact

top = ranking[0] if ranking else None
lines = [
    "Reddit Daily Conversion Monitor",
    f"- Window: {metrics.get('windowDays', 'n/a')} days",
    f"- Reddit pageviews: {metrics.get('redditPageviews', 0)}",
    f"- Reddit contact rate: {reddit_contact*100:.2f}%",
    f"- Sitewide contact rate: {sitewide_contact*100:.2f}%",
]

lines.append("")
lines.append("Data Reliability")
lines.append(f"- mode: {baseline.get('mode', 'unknown')}")
if baseline.get("baselineStartUtc"):
    lines.append(f"- baseline start: {baseline.get('baselineStartUtc')}")
if baseline.get("daysSinceBaselineStart") is not None:
    lines.append(f"- days since baseline: {baseline.get('daysSinceBaselineStart')}")
if baseline.get("daysRemainingUntilReliable") not in (None, 0):
    lines.append(f"- days until reliable: {baseline.get('daysRemainingUntilReliable')}")
if baseline.get("note"):
    lines.append(f"- note: {baseline.get('note')}")

def paid_line(name):
    row = paid.get(name, {}) or {}
    starts = int(row.get("typebotStarts", 0) or 0)
    done = int(row.get("typebotCompletions", 0) or 0)
    views = int(row.get("pageviews", 0) or 0)
    contacts = int(row.get("contacts", 0) or 0)
    return views, f"- {name}: views={views}, starts={starts}, completions={done}, contacts={contacts}"

paid_lines = []
active_paid = []
for source in ("reddit", "google", "quantcast"):
    views, line = paid_line(source)
    paid_lines.append(line)
    if views > 0:
        active_paid.append(source)

urgency = []
if reddit_contact < 0.01:
    urgency.append("URGENT: Reddit contact rate is below 1.00%.")
if gap > 0.01:
    urgency.append(f"IMPORTANT: Reddit trails sitewide by {gap*100:.2f}pp.")
if top and float(top.get("dropOffRate", 0) or 0) >= 0.35:
    urgency.append(
        "IMPORTANT: Top question drop-off is high "
        f"({top.get('questionId','unknown')} at {float(top.get('dropOffRate',0))*100:.1f}%)."
    )

if not urgency:
    urgency.append("No urgent regression detected today.")

reddit_contacts = int((paid.get("reddit", {}) or {}).get("contacts", 0) or 0)
if reddit_ads.get("available"):
    totals = reddit_ads.get("totals", {}) or {}
    spend = float(totals.get("spend", 0) or 0)
    cpa = (spend / reddit_contacts) if reddit_contacts > 0 else None
    if cpa is not None and cpa > CPA_ALERT_USD:
        urgency.insert(0, f"URGENT: Reddit CPA is high (${cpa:.2f} > ${CPA_ALERT_USD:.2f}).")
    if reddit_contacts == 0 and spend >= NO_CONTACTS_SPEND_ALERT_USD:
        urgency.insert(0, f"URGENT: ${spend:.2f} spend with 0 Reddit contacts.")

lines.append("")
lines.append("Priority Alerts")
lines.extend([f"- {x}" for x in urgency[:3]])

lines.append("")
lines.append("Paid Ads Typebot Daily")
lines.extend(paid_lines)
if active_paid:
    lines.append(f"- Active paid sources today: {', '.join(active_paid)}")
else:
    lines.append("- No paid-source traffic detected today.")

lines.append("")
lines.append("GA4 Paid Event Snapshot")
if ga4.get("available"):
    ga4_sources = ga4.get("bySource", {}) or {}
    for source in ("reddit", "google", "quantcast"):
        row = ga4_sources.get(source, {}) or {}
        lines.append(
            f"- {source}: starts={int(row.get('typebotStarted', 0) or 0)}, "
            f"completions={int(row.get('typebotCompleted', 0) or 0)}, "
            f"abandoned={int(row.get('typebotAbandoned', 0) or 0)}, "
            f"contacts={int(row.get('contacts', 0) or 0)}"
        )
else:
    lines.append(f"- unavailable: {ga4.get('reason', 'no GA4 data')}")

lines.append("")
lines.append("Reddit Ads Delivery")
if reddit_ads.get("available"):
    totals = reddit_ads.get("totals", {}) or {}
    lines.append(
        f"- impressions={int(totals.get('impressions', 0) or 0)}, "
        f"clicks={int(totals.get('clicks', 0) or 0)}, "
        f"spend={float(totals.get('spend', 0) or 0):.2f}, "
        f"ctr={float(totals.get('ctr', 0) or 0)*100:.2f}%, "
        f"cpc={float(totals.get('cpc', 0) or 0):.4f}"
    )
else:
    lines.append(f"- unavailable: {reddit_ads.get('reason', 'no Reddit Ads data')}")

# Health transition marker: detect false -> true from previous report.
prev_report = None
for candidate in sorted(report_dir.glob("reddit-agent-*.json"), key=lambda x: x.stat().st_mtime, reverse=True):
    if candidate != p:
        prev_report = candidate
        break

if prev_report:
    try:
        prev_data = json.loads(prev_report.read_text())
        prev_available = bool((prev_data.get("redditAds", {}) or {}).get("available"))
        curr_available = bool(reddit_ads.get("available"))
        if (not prev_available) and curr_available:
            lines.append("")
            lines.append("Reddit API Health")
            lines.append("- RECOVERED: Reddit Ads API is now healthy (available=true).")
    except Exception:
        pass

if top:
    lines.append("")
    lines.append("Top Question Risk")
    lines.append(
        f"- {top.get('questionId','unknown')} ({top.get('questionType','unknown')}): "
        f"drop-off {float(top.get('dropOffRate',0))*100:.1f}%, "
        f"est recoverable conversions {float(top.get('recoverableConversions',0)):.2f}"
    )

# Weekly digest section on Saturdays (weekday=5 in Python).
today = datetime.now()
if today.weekday() == 5:
    lines.append("")
    lines.append("Weekly Digest")
    lines.append(f"- Generated on Saturday: {today.date().isoformat()}")
    lines.append(f"- 7d Reddit pageviews: {int(metrics.get('redditPageviews', 0) or 0)}")
    lines.append(f"- 7d Reddit contact rate: {reddit_contact*100:.2f}%")
    if reddit_ads.get("available"):
        totals = reddit_ads.get("totals", {}) or {}
        lines.append(
            f"- 7d Reddit delivery: impressions={int(totals.get('impressions',0) or 0)}, "
            f"clicks={int(totals.get('clicks',0) or 0)}, spend={float(totals.get('spend',0) or 0):.2f}"
        )
    # Compare with nearest report that is at least 6 days older.
    reports = sorted(report_dir.glob("reddit-agent-*.json"), key=lambda x: x.stat().st_mtime)
    baseline = None
    for rp in reversed(reports):
        age_days = (today.timestamp() - rp.stat().st_mtime) / 86400
        if age_days >= 6:
            baseline = rp
            break
    if baseline and baseline != p:
        try:
            b = json.loads(baseline.read_text())
            b_metrics = b.get("metrics", {}) or {}
            b_rate = float(b_metrics.get("redditContactRate", 0) or 0)
            delta = (reddit_contact - b_rate) * 100
            lines.append(f"- vs prior week report: contact-rate delta {delta:+.2f}pp")
        except Exception:
            lines.append("- prior-week comparison unavailable (parse error)")
    else:
        lines.append("- prior-week comparison unavailable (not enough history)")

payload = {"content": "\n".join(lines)[:1900]}
print(json.dumps(payload))
PY
  fi
fi
