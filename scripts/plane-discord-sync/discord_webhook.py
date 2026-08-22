#!/usr/bin/env python3
"""
Discord Webhook Client for Assistedly.ai project management updates.

Posts formatted status updates to a Discord channel via webhook.
"""

import os
import json
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

# Only fall back to local .env if running outside an Infisical-managed shell.
# Infisical Agent already populates environment variables when running on macOS.
try:
    from dotenv import load_dotenv
    _local_env = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(_local_env):
        load_dotenv(_local_env)
except ImportError:
    pass

DISCORD_WEBHOOK_URL = os.getenv(
    "DISCORD_WEBHOOK_URL",
    "https://discord.com/api/webhooks/1518331460631789652/FN7tZzGXQpNPykeWZExVfFBYwz-9r171tNkXqKUHn7Sel4sXx8x1OCDkG77wVPIrgz-yJ"
)


def post_to_discord(
    content: Optional[str] = None,
    embeds: Optional[List[Dict]] = None,
    username: str = "Project Manager Bot",
    avatar_url: Optional[str] = None,
    timeout: int = 30,
) -> Optional[Dict]:
    """
    Post a message or rich embed(s) to the configured Discord webhook.
    
    Args:
        content: Plain text message (max 2000 chars).
        embeds: List of Discord embed dicts for rich formatting.
    Returns:
        Parsed JSON response from Discord on success, None on failure.
    """
    payload = {"username": username}
    if avatar_url:
        payload["avatar_url"] = avatar_url
    if content:
        payload["content"] = content
    if embeds:
        payload["embeds"] = embeds

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        DISCORD_WEBHOOK_URL,
        data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "Assistedly.ai-PM-Bot/1.0",
            "Accept": "*/*",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read()
            if body:
                return json.loads(body.decode())
            return {"success": True, "status": resp.status}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"[Discord POST failed] {e.code}: {err_body}", flush=True)
        return {"error": err_body, "status": e.code}
    except Exception as e:
        print(f"[Discord POST exception] {e}", flush=True)
        return {"error": str(e)}


def build_status_embed(
    tasks: List[Dict],
    goals: List[Dict],
    section_title: str = "📋 Project Status Update",
) -> List[Dict]:
    """
    Build Discord embeds for a project status update.

    Args:
        tasks: List of Plane issue dicts.
        goals: List of Plane cycle / module dicts.
    Returns:
        List of Discord embed dicts.
    """
    # timestamp in NYC (Eastern)
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Summary field
    total_tasks = len(tasks)
    in_progress = sum(1 for t in tasks if (t.get("state") or "").lower() in {"started", "in progress"})
    backlog = sum(1 for t in tasks if (t.get("state") or "").lower() in {"backlog", "todo", "unstarted"})

    embed = {
        "title": section_title,
        "color": 0x4A7C7E,  # Assistedly.ai teal
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "fields": [
            {
                "name": "📊 Quick Stats",
                "value": (
                    f"**{total_tasks}** open next-action tasks\n"
                    f"🔄 **{in_progress}** in progress\n"
                    f"📥 **{backlog}** in backlog\n"
                    f"🎯 **{len(goals)}** active cycles/milestones"
                ),
                "inline": True,
            },
        ],
    }

    # Next Action Tasks field (first 10)
    if tasks:
        task_lines = []
        for t in tasks[:10]:
            title = t.get("name", "Untitled")
            priority = (t.get("priority") or "").lower()
            state = (t.get("state") or "").lower()
            priority_emoji = {
                "urgent": "🔴", "high": "🟠",
                "medium": "🟡", "low": "🟢",
                "none": "⚪",
            }.get(priority, "⚪")

            # Truncate title if too long
            display = title if len(title) <= 60 else title[:57] + "..."
            task_lines.append(f"{priority_emoji} [{state}] {display}")

        embed["fields"].append({
            "name": "🚀 Next Actions",
            "value": "\n".join(task_lines) or "No next action tasks.",
            "inline": False,
        })
        if total_tasks > 10:
            embed["fields"][-1]["value"] += f"\n_...and {total_tasks - 10} more_"

    # Goals / Cycles field
    if goals:
        goal_lines = []
        for g in goals[:5]:
            gname = g.get("name", "Untitled Cycle")
            gstatus = "🟢 Active" if g.get("status", "active") == "active" else "⚪ Other"
            goal_lines.append(f"{gstatus} {gname}")
        embed["fields"].append({
            "name": "🎯 Active Goals / Cycles",
            "value": "\n".join(goal_lines),
            "inline": False,
        })

    # Footer with assistively.ai branding
    embed["footer"] = {
        "text": f"Assistedly.ai Project Management • {ts}",
    }

    return [embed]


def post_next_actions_update(
    tasks: List[Dict],
    goals: List[Dict],
    content_prefix: Optional[str] = "",
) -> Optional[Dict]:
    """Convenience wrapper: build status embed and post to Discord."""
    embeds = build_status_embed(tasks, goals)
    content = content_prefix or None
    result = post_to_discord(content=content, embeds=embeds)
    print(f"[Discord] Posted status update. Response: {result}", flush=True)
    return result


# ---------------------------------------------------------------------------
# CLI test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Discord Webhook CLI")
    parser.add_argument("action", choices=["test", "post_raw"])
    parser.add_argument("--message", default="Test message from Project Manager Bot")
    args = parser.parse_args()

    if args.action == "test":
        # Minimal test with a simple message + embed
        test_embed = [
            {
                "title": "🔌 Webhook Test",
                "description": "If you see this, the Project Manager Bot is connected and ready.",
                "color": 0x00FF00,
            }
        ]
        print(post_to_discord(content=args.message, embeds=test_embed))
    elif args.action == "post_raw":
        print(post_to_discord(content=args.message))
