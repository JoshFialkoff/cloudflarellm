#!/usr/bin/env python3
"""
Plane ↔ Discord Sync Runner

Scheduled script that:
1. Fetches next-action tasks and goals from Plane
2. Posts a formatted status update to Discord
3. Optionally writes a local JSON snapshot for historical tracking

Usage:
    # Post update to Discord
    python3 sync_runner.py

    # Show what would be posted (dry-run)
    python3 sync_runner.py --dry-run

    # Local snapshot only
    python3 sync_runner.py --local-only
"""

import os
import sys
import json
import argparse
import urllib.error
from datetime import datetime, timezone

# Only fall back to local .env if running outside an Infisical-managed shell.
# Infisical Agent already populates environment variables when running on macOS.
try:
    from dotenv import load_dotenv
    _local_env = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(_local_env):
        load_dotenv(_local_env)
except ImportError:
    pass

from plane_client import get_next_action_tasks, get_goals
from discord_webhook import post_next_actions_update

SNAPSHOT_FILE = os.path.join(
    os.path.dirname(__file__), "data", "last_sync_snapshot.json"
)


def load_snapshot() -> dict:
    if os.path.exists(SNAPSHOT_FILE):
        with open(SNAPSHOT_FILE, "r") as f:
            return json.load(f)
    return {}


def save_snapshot(data: dict):
    os.makedirs(os.path.dirname(SNAPSHOT_FILE), exist_ok=True)
    with open(SNAPSHOT_FILE, "w") as f:
        json.dump(data, f, indent=2)


def run_sync(dry_run: bool = False, local_only: bool = False):
    # 1. Fetch data from Plane
    print("[Sync] Fetching next action tasks from Plane...", flush=True)
    try:
        tasks = get_next_action_tasks()
        print(f"[Sync] Found {len(tasks)} next-action task(s)", flush=True)

        print("[Sync] Fetching goals / cycles from Plane...", flush=True)
        goals = get_goals()
        print(f"[Sync] Found {len(goals)} active goal/cycle(s)", flush=True)

        plane_connected = True
    except urllib.error.HTTPError as e:
        print(f"[Sync] Plane API connection failed: HTTP {e.code} — {e.reason}", flush=True)
        tasks, goals = [], []
        plane_connected = False
    except Exception as e:
        print(f"[Sync] Plane API connection failed: {e}", flush=True)
        tasks, goals = [], []
        plane_connected = False

    # 2. Build snapshot
    snapshot = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "task_count": len(tasks),
        "goal_count": len(goals),
        "tasks": tasks,
        "goals": goals,
        "plane_connected": plane_connected,
    }
    save_snapshot(snapshot)

    # 3. Post to Discord (unless skipped)
    if not local_only:
        if not dry_run:
            print("[Sync] Posting to Discord...", flush=True)
            if plane_connected:
                result = post_next_actions_update(
                    tasks=tasks,
                    goals=goals,
                    content_prefix="📋 **Next Actions & Goals Update** — Powered by Plane",
                )
            else:
                # Post connectivity issue notice
                from discord_webhook import post_to_discord
                result = post_to_discord(
                    content="📋 **Project Status Update**",
                    embeds=[{
                        "title": "⚠️ Plane Connection Issue",
                        "description": "Could not connect to Plane at http://23.95.189.106.\n\nThe API key may need to be regenerated from Plane Settings → API Tokens.",
                        "color": 0xFF9900,
                        "fields": [
                            {"name": "🔄 Next Run", "value": "Next scheduled sync will retry automatically.", "inline": False},
                        ],
                        "footer": {"text": "Assistedly.ai Project Management"},
                    }],
                )

            if result and result.get("error"):
                print(f"[Sync] Discord post failed: {result['error']}", file=sys.stderr)
                return 1
            else:
                print("[Sync] Discord post succeeded.", flush=True)
        else:
            print("[Sync] --- DRY RUN: would post the following embeds ---", flush=True)
            from discord_webhook import build_status_embed
            embeds = build_status_embed(tasks, goals)
            print(json.dumps(embeds, indent=2), flush=True)
    else:
        print("[Sync] --local-only: skipping Discord post", flush=True)

    return 0


def main():
    parser = argparse.ArgumentParser(description="Plane ↔ Discord sync runner")
    parser.add_argument("--dry-run", action="store_true", help="Show what would be posted")
    parser.add_argument("--local-only", action="store_true", help="Skip Discord, only snapshot locally")
    args = parser.parse_args()

    exit_code = run_sync(dry_run=args.dry_run, local_only=args.local_only)
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
