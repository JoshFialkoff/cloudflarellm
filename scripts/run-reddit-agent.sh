#!/bin/bash
set -euo pipefail
cd "/Users/joshfialkoff/Documents/Cursor Workspaces/AI-Assist-Living-Finder"

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
from pathlib import Path

p = Path(sys.argv[1])
data = json.loads(p.read_text())
metrics = data.get("metrics", {})
ranking = data.get("questionUrgencyRanking", []) or []

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

lines.append("")
lines.append("Priority Alerts")
lines.extend([f"- {x}" for x in urgency[:3]])

if top:
    lines.append("")
    lines.append("Top Question Risk")
    lines.append(
        f"- {top.get('questionId','unknown')} ({top.get('questionType','unknown')}): "
        f"drop-off {float(top.get('dropOffRate',0))*100:.1f}%, "
        f"est recoverable conversions {float(top.get('recoverableConversions',0)):.2f}"
    )

payload = {"content": "\n".join(lines)[:1900]}
print(json.dumps(payload))
PY
  fi
fi
