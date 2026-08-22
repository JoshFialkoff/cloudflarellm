#!/usr/bin/env python3
"""
Scheduler Orchestrator

1.  Pulls free-time blocks from Google Calendar
2.  Pulls prioritized tasks from Plane
3.  Maps highest-urgency tasks into each available block
4.  Emits a recommendation report (console + optional Discord / file)

Usage:
    python3 scheduler.py
    python3 scheduler.py --hours 8 --output json
    python3 scheduler.py --output discord
"""

import os
import sys
import json
import argparse
import warnings
from datetime import datetime, timezone, timedelta

warnings.filterwarnings("ignore", category=UserWarning, module="dotenv")
from typing import List, Dict, Any, Optional

# Env vars are set by run.sh (Infisical + validation).  Local .env overrides.
try:
    from dotenv import load_dotenv
    _local_env = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(_local_env):
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            load_dotenv(_local_env)
except ImportError:
    pass

_SCRIPT_DIR = os.path.dirname(__file__)

# Ensure plane_client import path is available
_PLANE_CLIENT_PATH = os.path.join(_SCRIPT_DIR, "..", "plane-discord-sync")
if _PLANE_CLIENT_PATH not in sys.path:
    sys.path.insert(0, _PLANE_CLIENT_PATH)

import calendar_client
import priority_engine


# ---------------------------------------------------------------------------
# Recommendation model
# ---------------------------------------------------------------------------
def _fmt_time(iso_str: str) -> str:
    dt = datetime.fromisoformat(iso_str)
    return dt.strftime("%I:%M %p")  # e.g. 02:30 PM


def _fmt_duration(minutes: int) -> str:
    if minutes >= 60:
        h = minutes // 60
        m = minutes % 60
        return f"{h}h {m}m" if m else f"{h}h"
    return f"{minutes}m"


def _fmt_date_short(iso_str: str) -> str:
    dt = datetime.fromisoformat(iso_str)
    return dt.strftime("%a %b %-d")


def build_recommendations(
    lookahead_hours: int = 12,
    min_block_minutes: int = 20,
    max_tasks_per_block: int = 2,
) -> Dict[str, Any]:
    """
    Main orchestration:
      - Find free blocks on calendar
      - Rank open Plane tasks
      - Recommend what to do next
    """
    now = datetime.now(timezone.utc)
    window_end = now + timedelta(hours=lookahead_hours)

    # 1. Fetch free blocks
    calendar_error = None
    try:
        free_blocks = calendar_client.get_free_blocks(
            time_min=now,
            time_max=window_end,
            min_block_minutes=min_block_minutes,
            exclude_transparent=True,
        )
    except Exception as e:
        calendar_error = str(e)
        print(f"[Scheduler] Calendar fetch failed: {e}", file=sys.stderr)
        free_blocks = []

    # 2. Fetch prioritized tasks
    plane_error = None
    try:
        tasks = priority_engine.get_prioritized_tasks(limit=30)
    except Exception as e:
        plane_error = str(e)
        print(f"[Scheduler] Plane fetch failed: {e}", file=sys.stderr)
        tasks = []

    if not tasks and not plane_error:
        # API calls completed but returned 401/403 — key or URL issue
        plane_error = "PLANE_API_KEY appears invalid or PLANE_BASE_URL has changed. " \
                      "Check Plane → Settings → API Tokens to confirm the current key and URL."

    # 3. Next upcoming meeting
    next_meeting = None
    try:
        next_meeting = calendar_client.get_next_meeting(now)
    except Exception:
        pass

    # 4. Map blocks → tasks (if blocks exist)
    schedule = []
    consumed_task_ids = set()

    if free_blocks:
        for block in free_blocks:
            block_mins = block["duration_minutes"]
            block_start = block["start"]
            block_end = block["end"]

            # Try to fit the highest remaining priority task that matches duration
            assigned = []
            remaining_minutes = block_mins

            # Get candidates that haven't been consumed
            candidates = [t for t in tasks if t.get("id") not in consumed_task_ids]

            # Primary: best-fitting single task
            pick = priority_engine.find_fitting_task(block_mins, candidates, flex_percent=0.30)
            if pick:
                assigned.append(pick)
                consumed_task_ids.add(pick.get("id"))
                remaining_minutes -= pick["_estimate_minutes"]

                # Secondary: if there's still room, try to stack a small task
                if max_tasks_per_block >= 2 and remaining_minutes >= 15:
                    secondary_candidates = [
                        t for t in candidates
                        if t.get("id") not in consumed_task_ids
                        and t["_estimate_minutes"] <= remaining_minutes + 10
                    ]
                    if secondary_candidates:
                        spill = secondary_candidates[0]
                        assigned.append(spill)
                        consumed_task_ids.add(spill.get("id"))

            schedule.append({
                "block_start": block_start,
                "block_end": block_end,
                "block_duration_minutes": block_mins,
                "tasks": [
                    {
                        "task_id": t.get("id"),
                        "name": t.get("name", t.get("title", "(Untitled)")),
                        "priority": t.get("priority"),
                        "state": t.get("state"),
                        "score": t.get("_score"),
                        "estimate_minutes": t.get("_estimate_minutes"),
                        "due_date": t.get("_due_date"),
                        "plane_url": _build_plane_url(t),
                    }
                    for t in assigned
                ],
            })

    # 5. Overall "next action" recommendation
    next_action = None
    if tasks:
        top = tasks[0]
        next_action = {
            "task_id": top.get("id"),
            "name": top.get("name", top.get("title", "(Untitled)")),
            "priority": top.get("priority"),
            "state": top.get("state"),
            "score": top.get("_score"),
            "estimate_minutes": top.get("_estimate_minutes"),
            "due_date": top.get("_due_date"),
            "plane_url": _build_plane_url(top),
            "rationale": _build_rationale(top),
        }

    return {
        "generated_at": now.isoformat(),
        "lookahead_hours": lookahead_hours,
        "calendar_error": calendar_error,
        "plane_error": plane_error,
        "next_meeting": _serialize_meeting(next_meeting) if next_meeting else None,
        "free_blocks_found": len(free_blocks),
        "tasks_considered": len(tasks),
        "next_action": next_action,
        "time_block_schedule": schedule,
        "top_tasks": [
            {
                "task_id": t.get("id"),
                "name": t.get("name", t.get("title", "(Untitled)")),
                "priority": t.get("priority"),
                "state": t.get("state"),
                "score": t.get("_score"),
                "estimate_minutes": t.get("_estimate_minutes"),
                "due_date": t.get("_due_date"),
                "plane_url": _build_plane_url(t),
            }
            for t in tasks[:10]
        ],
    }


def _build_plane_url(task: Dict[str, Any]) -> Optional[str]:
    base = os.getenv("PLANE_BASE_URL", "http://23.95.189.106").rstrip("/")
    ws = os.getenv("PLANE_WORKSPACE", "executive")
    pid = task.get("_source_project_id")
    if not pid:
        # fallback project id
        pid = "59048c57-f5db-4247-ac61-e6019c012985"
    tid = task.get("id")
    if pid and tid:
        return f"{base}/{ws}/projects/{pid}/issues/{tid}"
    return None


def _build_rationale(task: Dict[str, Any]) -> str:
    parts = []
    p = task.get("priority")
    if p:
        parts.append(f"priority is {p}")
    s = task.get("state")
    if s:
        parts.append(f"state is {s}")
    d = task.get("_due_date")
    if d:
        parts.append(f"due {d[:10]}")
    return (
        "This is your top task because it has the highest urgency score "
        f"({task.get('_score')}) — {', '.join(parts)}."
    )


def _serialize_meeting(meeting: Optional[Dict[str, Any]]) -> Optional[Dict[str, str]]:
    if not meeting:
        return None
    return {
        "summary": meeting.get("summary", "(No title)"),
        "start": meeting["start"].isoformat() if "start" in meeting else None,
        "end": meeting["end"].isoformat() if "end" in meeting else None,
    }


# ---------------------------------------------------------------------------
# Output formatters
# ---------------------------------------------------------------------------
def format_console(report: Dict[str, Any]) -> str:
    lines = []
    na = report.get("next_action")
    top_tasks = report.get("top_tasks", [])
    now = datetime.now(timezone.utc)
    cal_err = report.get("calendar_error")
    plane_err = report.get("plane_error")

    lines.append("=" * 72)
    lines.append("  📅 CALENDAR  ↔  ✅ PLANE  —  Task Recommendation")
    lines.append("=" * 72)
    lines.append("")

    # Calendar warning
    if cal_err:
        lines.append("⚠️  Calendar not connected.")
        lines.append(f"   ({cal_err})")
        lines.append("")

    # Plane warning
    if plane_err:
        lines.append("⚠️  Plane not connected.")
        lines.append(f"   ({plane_err})")
        lines.append("")

    if cal_err and not plane_err:
        lines.append("Showing Plane priorities below.")
        lines.append("")

    # Next meeting
    nm = report.get("next_meeting")
    if nm:
        lines.append(f"🚨 Next meeting: {nm['summary']} at {_fmt_time(nm['start'])}")
        lines.append("")

    # Top recommendation
    if na:
        lines.append("🔥 NEXT ACTION — do this first:")
        lines.append(f"   ➤ {na['name']}")
        lines.append(f"     Priority: {na['priority'] or 'none'} | State: {na['state'] or 'unknown'}")
        lines.append(f"     Estimated: {_fmt_duration(na['estimate_minutes'])}")
        if na['due_date']:
            due_str = na['due_date'][:10]
            try:
                due_dt = datetime.fromisoformat(na['due_date'])
                if due_dt.date() < datetime.now(timezone.utc).date():
                    due_str += " (OVERDUE)"
            except Exception:
                pass
            lines.append(f"     Due: {due_str}")
        if na['plane_url']:
            lines.append(f"     Link: {na['plane_url']}")
        lines.append(f"     Why: {na['rationale']}")
        lines.append("")

    # Schedule (blocks → tasks)
    sched = report.get("time_block_schedule", [])
    if sched:
        lines.append("📋 Suggested schedule for your free blocks:")
        lines.append("-" * 72)
        for block in sched:
            start = _fmt_short(block["block_start"])
            dur = _fmt_duration(block["block_duration_minutes"])
            lines.append(f"\n   {start}  ({dur} free)")
            if block["tasks"]:
                for t in block["tasks"]:
                    est = _fmt_duration(t["estimate_minutes"])
                    lines.append(f"      → {t['name']} [{t['priority']} | est {est}]")
            else:
                lines.append("      (no matching tasks — consider email/review/break)")
        lines.append("")
    elif not cal_err:
        lines.append("📋 No free blocks found in the next window.")
        lines.append("")

    # Standalone plane priority list (shown when calendar is off)
    if cal_err and top_tasks:
        lines.append("📋 Top open tasks (by urgency score):")
        lines.append("-" * 72)
        for i, t in enumerate(top_tasks[:10], 1):
            est = _fmt_duration(t["estimate_minutes"])
            due_raw = t['due_date'][:10] if t['due_date'] else None
            if due_raw:
                try:
                    due_dt = datetime.fromisoformat(t['due_date'])
                    due = f"due {due_raw} (OVERDUE)" if due_dt.date() < datetime.now(timezone.utc).date() else f"due {due_raw}"
                except Exception:
                    due = f"due {due_raw}"
            else:
                due = "no due date"
            lines.append(
                f"  {i:2}. [{t['score']:6.1f}] {t['name'][:48]:<48} "
                f"| {t['priority'] or 'none':<8} | est {est:<6} | {due}"
            )
            if t['plane_url']:
                lines.append(f"      → {t['plane_url']}")
        lines.append("")

    # Free block count summary
    lines.append(f"  Free blocks: {report['free_blocks_found']} | Tasks considered: {report['tasks_considered']}")

    # Connection hints
    if cal_err or plane_err:
        lines.append("")
        lines.append("🛠  To fix:")
    if cal_err:
        lines.append("   • Save Google OAuth client_secret.json next to scheduler.py")
        lines.append("   • Or set GOOGLE_CREDENTIALS_PATH env var")
    if plane_err:
        lines.append("   • Ensure PLANE_API_KEY is valid in the Plane UI (Settings → API Tokens)")
        lines.append("   • Ensure PLANE_BASE_URL is correct for the current Plane instance")

    lines.append("")
    lines.append("=" * 72)
    lines.append(f"Generated: {now.strftime('%Y-%m-%d %H:%M %Z')}")
    lines.append("=" * 72)
    return "\n".join(lines)


def _fmt_short(iso: str) -> str:
    dt = datetime.fromisoformat(iso)
    return dt.strftime("%a %H:%M")


# ---------------------------------------------------------------------------
# Discord poster (optional)
# ---------------------------------------------------------------------------
def post_to_discord(report: Dict[str, Any]) -> bool:
    """Post formatted report to Discord via webhook."""
    webhook_url = os.getenv("DISCORD_CALENDAR_WEBHOOK_URL") or os.getenv("DISCORD_WEBHOOK_URL")
    if not webhook_url:
        print("[Scheduler] No Discord webhook configured; skipping post.")
        return False

    import urllib.request
    import urllib.error

    na = report.get("next_action")
    fields = []
    if na:
        fields.append({
            "name": "🔥 Next Action",
            "value": f"[{na['name']}]({na['plane_url']})\n"
                     f"Priority: {na['priority']} | Est: {na['estimate_minutes']}m\n"
                     f"Due: {na['due_date'][:10] if na['due_date'] else '—'}",
            "inline": False,
        })

    embed = {
        "title": "Calendar ↔ Plane Priority Check",
        "description": f"Lookahead: {report['lookahead_hours']}h | "
                       f"Free blocks: {report['free_blocks_found']} | "
                       f"Tasks considered: {report['tasks_considered']}",
        "color": 0x3366FF,
        "fields": fields,
        "timestamp": report["generated_at"],
    }

    payload = json.dumps({"embeds": [embed]}).encode()
    req = urllib.request.Request(
        webhook_url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "AssistedlyCalendarBot/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.getcode() in (200, 204)
    except urllib.error.HTTPError as e:
        body = e.read().decode()[:200]
        print(f"[Scheduler] Discord post failed: {e.code} {e.reason} — {body}")
        return False


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="Calendar-Plane Task Scheduler")
    parser.add_argument("--hours", type=int, default=12, help="Lookahead window")
    parser.add_argument("--min-minutes", type=int, default=20, help="Minimum free block size")
    parser.add_argument("--output", choices=["console", "json", "discord", "all"], default="console")
    parser.add_argument("--snapshot", default=None, help="Write JSON snapshot to file path")
    args = parser.parse_args()

    report = build_recommendations(
        lookahead_hours=args.hours,
        min_block_minutes=args.min_minutes,
    )

    # Snapshot
    if args.snapshot:
        os.makedirs(os.path.dirname(os.path.abspath(args.snapshot)) or ".", exist_ok=True)
        with open(args.snapshot, "w") as f:
            json.dump(report, f, indent=2, default=str)
        print(f"[Scheduler] Snapshot written to {args.snapshot}")

    # Outputs
    if args.output in ("console", "all"):
        print(format_console(report))

    if args.output in ("json", "all"):
        print(json.dumps(report, indent=2, default=str))

    if args.output in ("discord", "all"):
        ok = post_to_discord(report)
        status = "✅ posted" if ok else "❌ failed"
        print(f"[Scheduler] Discord {status}")


if __name__ == "__main__":
    main()
