#!/usr/bin/env python3
"""
Bot Fleet Commander — Meta-bot that audits, optimizes, and triages Goose scheduled jobs.

Usage:
    source /Users/joshdev/.infisical/rendered/.env
    python3 fleet_commander.py [--auto-trigger] [--discord] [--plane]

Reads GOOSE_SCHEDULED_JOBS via `goose schedule list`, evaluates health,
compares against the Optimal Revenue Schedule, and acts on gaps.
"""

import json
import os
import subprocess
import sys
import re
import time
from datetime import datetime, timezone
from typing import Any

# === CONFIGURATION ===
PLANE_BASE_URL = os.getenv("PLANE_BASE_URL", "http://23.95.189.106")
PLANE_API_KEY = os.getenv("PLANE_API_KEY")
PLANE_WORKSPACE = os.getenv("PLANE_WORKSPACE", "executive")
PLANE_PROJECT_IDS = os.getenv("PLANE_PROJECT_IDS", "").split(",")
PLANE_PROJECT_CODING = "64a3045d-76e5-4501-a943-11e5fd8718f6"
PLANE_PROJECT_BIZDEV = "59048c57-f5db-4247-ac61-e6019c012985"
PLANE_PROJECT_EXECUTIVE = os.getenv("PLANE_PROJECT_EXECUTIVE", PLANE_PROJECT_BIZDEV)

DISCORD_FLEET_WEBHOOK = os.getenv("DISCORD_FLEET_WEBHOOK_URL", os.getenv("DISCORD_WEBHOOK_URL", os.getenv("DISCORD_DAILY_ANALYTICS_WEBHOOK_URL")))

FLEET_COMMANDER_STATE_FILE = os.getenv("FLEET_COMMANDER_STATE", "/Users/joshdev/Assistedly.ai/scripts/bot-fleet-commander/data/fleet_state.json")

# Revenue impact tiers (includes wrapper name/title fragments and source path fragments)
TIER_REVENUE_CRITICAL = {
    "agetech-strategy-agent", "analytics-insight-monitor",
    "firecrawl-discord-outreach", "firecrawl-outreach-daily",
    "competitor-analysis-biweekly", "marketing-strategy-optimizer",
    "Firecrawl", "Senior Health Monitor", "outreach",
}
TIER_INFRASTRUCTURE = {
    "bot-health-daily", "fleet-health-monitor", "daily-swap-memory-check",
    "racknerd-health-check", "server-cleanup", "server-smoke-tests",
    "nodejs-version-check", "Server Health",
}
TIER_ANALYTICS = {"analytics-insight-monitor", "competitor-analysis-biweekly", "daily-mcp-insights", "Analytics Insight"}
TIER_SYNC = {"plane-discord-sync", "bookkeeping-agent", "Plane Discord", "bookkeeping"}
TIER_SECURITY = {"dependabot-monitor", "dependabot-auto-merge", "infisical-bootstrap", "dependabot"}

# Optimal daily revenue schedule (hour, job_name or id fragment)
OPTIMAL_SCHEDULE = [
    (5, "bot-health-daily", "infra-ops-insight", "PostHog + RackNerd morning health check"),
    (6, "bot-fleet-commander", "fleet-audit", "Meta-bot audit + optimization"),
    (7, "agetech-strategy-agent", "revenue-outreach", "AgeTech partner pipeline + Twenty contacts"),
    (8, "analytics-insight-monitor", "revenue-analytics", "Morning analytics + funnel health"),
    (9, "firecrawl-outreach-daily", "revenue-discovery", "Firecrawl senior health outreach"),
    (9, "plane-discord-sync", "ops-sync", "Morning Plane status sync"),
    (9, "competitor-analysis-biweekly", "revenue-intel", "Competitor intel (Mon/Thu only)"),
    (10, "firecrawl-partner-finder", "revenue-discovery", "AgeTech partner discovery via Firecrawl agent"),
    (13, "analytics-insight-monitor", "revenue-analytics", "Midday analytics check"),
    (17, "plane-discord-sync", "ops-sync", "Evening Plane status sync (weekdays)"),
    (20, "analytics-insight-monitor", "revenue-analytics", "Evening analytics check"),
]


def run_goose(argv: list[str]) -> str:
    """Run a goose CLI command and return stdout text."""
    full = ["goose", "schedule"] + argv
    try:
        result = subprocess.run(full, capture_output=True, text=True, timeout=60)
        return result.stdout + result.stderr
    except Exception as e:
        print(f"[WARN] Failed to run goose {' '.join(argv)}: {e}")
        return ""


def parse_schedule_list(text: str) -> list[dict]:
    """Parse text output of `goose schedule list`."""
    jobs = []
    # Pattern: - ID: <id>
    #   Status: <status>
    #   Cron: <cron>
    #   Recipe Source (in store): <path>
    #   Last Run: <iso>
    blocks = re.split(r'\n(?=- ID:)', text)
    for block in blocks:
        block = block.strip()
        if not block or "Scheduled Jobs:" in block:
            continue
        jid = re.search(r'- ID:\s*(\S+)', block)
        status = re.search(r'Status:\s*(.+)', block)
        cron = re.search(r'Cron:\s*(.+)', block)
        source = re.search(r'Recipe Source \(in store\):\s*(.+)', block)
        last_run = re.search(r'Last Run:\s*(.+)', block)
        jobs.append({
            "id": jid.group(1).strip() if jid else "unknown",
            "status": status.group(1).strip() if status else "",
            "cron_expression": cron.group(1).strip() if cron else "",
            "source": source.group(1).strip() if source else "",
            "last_run": last_run.group(1).strip() if last_run else "",
            "paused": "paused" in block.lower(),
            "currently_running": "running" in block.lower(),
        })
    return jobs


def read_wrapper_name(source_path: str) -> str:
    """Read the 'name' or 'title' field from the scheduled recipe wrapper YAML."""
    try:
        with open(source_path, "r") as f:
            name = ""
            title = ""
            for line in f:
                if line.startswith("name:") and not name:
                    name = line.split(":", 1)[1].strip().strip('"').strip("'")
                if line.startswith("title:") and not title:
                    title = line.split(":", 1)[1].strip().strip('"').strip("'")
                if name and title:
                    break
            return name or title
    except Exception:
        pass
    return ""


def parse_cron_next_run_hours(cron_expr: str) -> float:
    """Rough estimate: how many hours until next expected run based on cron."""
    if not cron_expr:
        return 24
    parts = cron_expr.split()
    if len(parts) == 6:
        # 6-field cron with seconds
        second, minute, hour, dom, month, dow = parts
    elif len(parts) == 5:
        minute, hour, dom, month, dow = parts
    else:
        return 24

    # Every N minutes
    if "*/" in minute and hour == "*" and dom == "*":
        return int(minute.split("*/")[1]) / 60.0
    # Every N hours
    if minute != "*" and "*/" in hour:
        return int(hour.split("*/")[1])
    # Daily at specific hour
    if dom == "*" and month == "*" and (dow == "*" or "," in dow or "-" in dow):
        return 24
    # Weekly (specific day)
    if dow != "*" and "," not in dow and "-" not in dow:
        return 24 * 7
    # Monthly (specific day)
    if dom != "*" and dom != "?":
        return 24 * 30
    return 24


def job_to_info(job: dict) -> dict:
    """Enrich a scheduled job with health classification."""
    jid = job.get("id", "unknown")
    source = job.get("source", "")
    cron = job.get("cron_expression", "")
    last_run_str = job.get("last_run", "")
    paused = job.get("paused", False)
    running = job.get("currently_running", False)

    # Determine friendly name from wrapper YAML first, then source path
    name = read_wrapper_name(source) if source else ""
    if not name:
        name = jid
    if source:
        basename = os.path.basename(source).replace(".yaml", "").replace(".yml", "")
        if basename and basename != jid and not name:
            name = basename

    # Categorize
    category = "other"
    if any(x in name or x in source for x in TIER_REVENUE_CRITICAL):
        category = "🔥 revenue"
    elif any(x in name or x in source for x in TIER_INFRASTRUCTURE):
        category = "🔧 infra"
    elif any(x in name or x in source for x in TIER_ANALYTICS):
        category = "📊 analytics"
    elif any(x in name or x in source for x in TIER_SYNC):
        category = "🔄 sync"
    elif any(x in name or x in source for x in TIER_SECURITY):
        category = "🔒 security"

    # Health assessment — compare against expected cron frequency
    hours_since_last = 9999
    health = "unknown"
    if last_run_str and last_run_str != "Never":
        try:
            lr = last_run_str.strip().replace("Z", "+00:00")
            last_dt = datetime.fromisoformat(lr)
            if last_dt.tzinfo is None:
                last_dt = last_dt.replace(tzinfo=timezone.utc)
            hours_since_last = (datetime.now(timezone.utc) - last_dt).total_seconds() / 3600
        except Exception:
            pass

    expected_period = parse_cron_next_run_hours(cron)
    # Thresholds scaled to cron frequency
    stale_threshold = max(expected_period * 1.5, 6)
    dead_threshold = max(expected_period * 3, 24)

    if paused:
        health = "⏸️ paused"
    elif running:
        health = "🏃 running"
    elif hours_since_last < expected_period * 1.2:
        health = "✅ healthy"
    elif hours_since_last < stale_threshold:
        health = "🟡 stale"
    elif hours_since_last < dead_threshold:
        health = "🟠 very stale"
    else:
        health = "🔴 dead"

    return {
        "id": jid,
        "name": name,
        "source": source,
        "cron": cron,
        "last_run": last_run_str,
        "hours_since_last": round(hours_since_last, 1),
        "paused": paused,
        "running": running,
        "health": health,
        "category": category,
    }


def fetch_sessions(job_id: str, limit: int = 3) -> list[dict]:
    """Fetch recent sessions for a job to detect success/failure."""
    text = run_goose(["sessions", "--schedule-id", job_id, "--limit", str(limit)])
    sessions = []
    if "No sessions found" in text:
        return sessions
    # Parse text: Sessions for schedule '...':
    # - session_id: <sid>
    #   started_at: <ts>
    #   finished_at: <ts>
    #   status: <status>
    lines = text.splitlines()
    current = {}
    for line in lines:
        s = line.strip()
        if s.startswith("- session_id:"):
            if current:
                sessions.append(current)
            current = {"session_id": s.split(":", 1)[1].strip()}
        elif s.startswith("started_at:") and current:
            current["started_at"] = s.split(":", 1)[1].strip()
        elif s.startswith("finished_at:") and current:
            current["finished_at"] = s.split(":", 1)[1].strip()
        elif s.startswith("status:") and current:
            current["status"] = s.split(":", 1)[1].strip()
    if current:
        sessions.append(current)
    return sessions


def build_optimal_gap_report(jobs: list[dict]) -> list[dict]:
    """Compare actual jobs against optimal schedule. Return gaps."""
    gaps = []
    for hour, name_fragment, purpose, description in OPTIMAL_SCHEDULE:
        found = False
        for j in jobs:
            jname = j["name"]
            jsource = os.path.basename(j.get("source", "")).replace(".yaml", "")
            if name_fragment in jname or name_fragment in jsource:
                found = True
                break
        if not found:
            gaps.append({
                "hour": hour,
                "name_fragment": name_fragment,
                "purpose": purpose,
                "description": description,
                "severity": "critical" if purpose.startswith("revenue") else "medium",
            })
    return gaps


def build_overlap_report(jobs: list[dict]) -> list[dict]:
    """Find jobs scheduled at the same time."""
    cron_map = {}
    for j in jobs:
        cron = j.get("cron", "")
        if cron:
            if cron not in cron_map:
                cron_map[cron] = []
            cron_map[cron].append(j)
    overlaps = []
    for cron, joblist in cron_map.items():
        if len(joblist) > 1:
            overlap_names = [j["name"] for j in joblist]
            overlaps.append({"cron": cron, "count": len(joblist), "jobs": overlap_names})
    return overlaps


def post_discord(title: str, description: str, fields: list[dict], color: int = 0x5865F2) -> bool:
    """Post an embed to Discord via webhook."""
    if not DISCORD_FLEET_WEBHOOK:
        print("[WARN] No DISCORD_FLEET_WEBHOOK_URL configured; skipping Discord post.")
        return False

    embed = {
        "title": title,
        "description": description,
        "color": color,
        "fields": fields,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "footer": {"text": "Bot Fleet Commander"},
    }
    payload = {"embeds": [embed]}

    import urllib.request
    req = urllib.request.Request(
        DISCORD_FLEET_WEBHOOK,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return resp.status in (200, 201, 204)
    except Exception as e:
        print(f"[WARN] Discord post failed: {e}")
        return False


def create_plane_task(title: str, description: str, priority: str = "medium", project_id: str = None) -> bool:
    """Create a Plane issue via REST API."""
    if not PLANE_API_KEY:
        print("[WARN] No PLANE_API_KEY; skipping Plane task creation.")
        return False

    pid = project_id or PLANE_PROJECT_CODING
    url = f"{PLANE_BASE_URL}/api/v1/workspaces/{PLANE_WORKSPACE}/projects/{pid}/issues/"
    headers = {
        "X-API-Key": PLANE_API_KEY,
        "Content-Type": "application/json",
    }
    payload = {
        "name": title,
        "description_html": f"<p>{description}</p>",
        "priority": priority,
    }

    import urllib.request
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read().decode("utf-8")
            print(f"[OK] Created Plane task: {title} → {body[:200]}")
            return True
    except Exception as e:
        print(f"[WARN] Plane task creation failed: {e}")
        return False


def trigger_job_now(job_id: str) -> bool:
    """Trigger a scheduled job immediately via goose CLI."""
    print(f"[ACTION] Triggering job now: {job_id}")
    try:
        result = subprocess.run(
            ["goose", "schedule", "run-now", "--schedule-id", job_id],
            capture_output=True,
            text=True,
            timeout=120,
        )
        if result.returncode == 0:
            print(f"[OK] Triggered {job_id}")
            return True
        else:
            print(f"[WARN] Trigger failed for {job_id}: {result.stderr.strip() or result.stdout.strip()}")
            return False
    except Exception as e:
        print(f"[WARN] Exception triggering {job_id}: {e}")
        return False


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Bot Fleet Commander")
    parser.add_argument("--auto-trigger", action="store_true", help="Auto-trigger missing critical revenue bots")
    parser.add_argument("--discord", action="store_true", help="Post report to Discord")
    parser.add_argument("--plane", action="store_true", help="Create Plane tasks for gaps")
    parser.add_argument("--quiet", action="store_true", help="Minimal stdout")
    args = parser.parse_args()

    state_dir = os.path.dirname(FLEET_COMMANDER_STATE_FILE)
    if state_dir:
        os.makedirs(state_dir, exist_ok=True)

    # --- STEP 1: Fetch fleet ---
    print("[INFO] Fetching Goose scheduled jobs...")
    raw_text = run_goose(["list"])
    raw_jobs = parse_schedule_list(raw_text)
    if not raw_jobs:
        print("[FATAL] Cannot fetch or parse scheduled jobs.")
        sys.exit(1)

    jobs = [job_to_info(j) for j in raw_jobs]

    # --- STEP 2: Fetch session health for revenue-critical bots ---
    print("[INFO] Checking recent session health for revenue-critical bots...")
    for j in jobs:
        if j["category"] == "🔥 revenue":
            sessions = fetch_sessions(j["id"], limit=2)
            j["recent_sessions"] = sessions
            if sessions:
                latest = sessions[0]
                if latest.get("status") == "error":
                    j["health"] += " (last session ERROR)"
                elif latest.get("status") == "completed":
                    j["health"] += " (last session OK)"
            time.sleep(0.5)

    # --- STEP 3: Build gap analysis ---
    gaps = build_optimal_gap_report(jobs)
    overlaps = build_overlap_report(jobs)

    revenue_gaps = [g for g in gaps if g["severity"] == "critical"]
    infra_gaps = [g for g in gaps if g["severity"] != "critical"]

    dead_bots = [j for j in jobs if j["health"].startswith("🔴") or j["health"].startswith("🟠")]
    paused_bots = [j for j in jobs if j["paused"]]
    revenue_bots = [j for j in jobs if j["category"] == "🔥 revenue"]

    # --- STEP 4: Console report ---
    if not args.quiet:
        print("\n" + "=" * 70)
        print("  🤖 BOT FLEET COMMANDER REPORT")
        print(f"  Generated: {datetime.now(timezone.utc).isoformat()}")
        print("=" * 70)
        print(f"\n📊 Fleet Size: {len(jobs)} scheduled jobs | {len(revenue_bots)} revenue-critical")

        print("\n📋 JOBS BY CATEGORY")
        for cat in ("🔥 revenue", "📊 analytics", "🔧 infra", "🔄 sync", "🔒 security", "other"):
            cat_jobs = [j for j in jobs if j["category"] == cat]
            if cat_jobs:
                print(f"\n  {cat} ({len(cat_jobs)}):")
                for j in cat_jobs:
                    print(f"    {j['health']} {j['name']:35s} last={j['hours_since_last']:>6}h  cron={j['cron']}")

        if dead_bots:
            print(f"\n🔴 DEAD/STALE BOTS ({len(dead_bots)}):")
            for j in dead_bots:
                print(f"    {j['name']:35s} last run {j['hours_since_last']:>6}h ago  cron={j['cron']}")

        if paused_bots:
            print(f"\n⏸️ PAUSED BOTS ({len(paused_bots)}):")
            for j in paused_bots:
                print(f"    {j['name']}")

        if revenue_gaps:
            print(f"\n🚨 CRITICAL REVENUE GAPS ({len(revenue_gaps)}):")
            for g in revenue_gaps:
                print(f"    {g['hour']:02d}:00  {g['name_fragment']:25s} — {g['description']}")
        else:
            print("\n✅ No critical revenue gaps detected")

        if infra_gaps:
            print(f"\n⚠️ INFRA/SYNC GAPS ({len(infra_gaps)}):")
            for g in infra_gaps:
                print(f"    {g['hour']:02d}:00  {g['name_fragment']:25s} — {g['description']}")

        if overlaps:
            print(f"\n⚡ SCHEDULE OVERLAPS ({len(overlaps)}):")
            for o in overlaps:
                print(f"    Cron '{o['cron']}' has {o['count']} jobs: {', '.join(o['jobs'])}")

    # --- STEP 5: Auto-trigger critical gaps ---
    triggered = []
    if args.auto_trigger:
        for g in revenue_gaps:
            name_frag = g["name_fragment"]
            matched = False
            for j in jobs:
                if name_frag in j["name"] or name_frag in os.path.basename(j.get("source", "")):
                    if trigger_job_now(j["id"]):
                        triggered.append(j["name"])
                    matched = True
                    break
            if not matched:
                print(f"[ACTION] No scheduled job found for '{name_frag}'; consider scheduling it.")

    # --- STEP 6: Discord report ---
    if args.discord and DISCORD_FLEET_WEBHOOK:
        fields = [
            {"name": "Fleet Size", "value": f"{len(jobs)} scheduled", "inline": True},
            {"name": "Revenue Critical", "value": f"{len(revenue_bots)} jobs", "inline": True},
            {"name": "Dead/Stale", "value": f"{len(dead_bots)} bots need attention", "inline": True},
        ]

        if revenue_gaps:
            gap_text = "\n".join([
                f"• {g['hour']:02d}:00 — {g['description']}" for g in revenue_gaps[:5]
            ])
            fields.append({"name": "🚨 Critical Revenue Gaps", "value": gap_text or "None", "inline": False})

        if dead_bots:
            dead_text = "\n".join([
                f"• {j['name']} ({j['hours_since_last']}h stale)" for j in dead_bots[:5]
            ])
            fields.append({"name": "🔴 Dead/Stale Bots", "value": dead_text or "None", "inline": False})

        overlap_text = "\n".join([
            f"• {o['cron']}: {', '.join(o['jobs'])[:200]}" for o in overlaps[:3]
        ]) or "None"
        fields.append({"name": "⚡ Overlaps", "value": overlap_text, "inline": False})

        if triggered:
            fields.append({"name": "🚀 Auto-triggered", "value": ", ".join(triggered), "inline": False})

        color = 0xED4245 if revenue_gaps or dead_bots else 0x57F287
        post_discord(
            "🤖 Bot Fleet Commander — Daily Audit",
            f"Fleet audit at {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
            fields,
            color=color,
        )

    # --- STEP 7: Plane tasks for human decisions ---
    if args.plane and PLANE_API_KEY:
        for g in revenue_gaps[:3]:
            create_plane_task(
                title=f"[Fleet] Revenue gap: {g['description']}",
                description=f"Optimal schedule slot: {g['hour']:02d}:00. Missing bot: {g['name_fragment']}. Purpose: {g['purpose']}. The fleet commander detected this revenue-critical bot is not scheduled. Action: schedule via `goose schedule add --recipe ... --cron '0 {g['hour']} * * *'`.",
                priority="urgent" if g["severity"] == "critical" else "high",
                project_id=PLANE_PROJECT_BIZDEV,
            )
        for j in dead_bots[:3]:
            create_plane_task(
                title=f"[Fleet] Dead bot: {j['name']} ({j['hours_since_last']}h stale)",
                description=f"Bot '{j['name']}' has not run in {j['hours_since_last']} hours. Cron: {j['cron']}. Source: {j['source']}. Investigate why it stopped and resume or reschedule. Try: `goose schedule run-now --schedule-id {j['id']}`",
                priority="high",
                project_id=PLANE_PROJECT_CODING,
            )

    # --- STEP 8: Persist fleet state ---
    state = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "fleet_size": len(jobs),
        "jobs": jobs,
        "gaps": gaps,
        "overlaps": overlaps,
        "dead_bots": dead_bots,
        "paused_bots": paused_bots,
        "triggered_now": triggered,
        "revenue_gaps_count": len(revenue_gaps),
    }
    with open(FLEET_COMMANDER_STATE_FILE, "w") as f:
        json.dump(state, f, indent=2, default=str)
    print(f"[INFO] Fleet state persisted to {FLEET_COMMANDER_STATE_FILE}")

    # --- STEP 9: Exit code based on health ---
    if revenue_gaps or dead_bots:
        print("\n[STATUS] Fleet has issues requiring attention.")
        sys.exit(2)
    else:
        print("\n[STATUS] Fleet is healthy. All revenue-critical bots operational.")
        sys.exit(0)


if __name__ == "__main__":
    main()
