#!/usr/bin/env python3
"""
Discord bot for interactive Calendar ↔ Plane task queries.
Responds to messages like "what should I work on" or "!next" with
your top priority task and free calendar time.

Requires:
  pip install discord.py
  DISCORD_BOT_TOKEN in env
  DISCORD_CHANNEL_ID to restrict responses to one channel
"""
import os
import sys
import asyncio
from datetime import datetime, timezone
from typing import Optional

# Add script directory to path for imports
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SCRIPT_DIR)

import discord
from discord import Message

# Try importing our own modules
from scheduler import build_recommendations

# ---------------------------------------------------------------------------
# Config from env
# ---------------------------------------------------------------------------
TOKEN = os.getenv("DISCORD_BOT_TOKEN")
CHANNEL_ID_STR = os.getenv("DISCORD_CHANNEL_ID")
CHANNEL_ID = int(CHANNEL_ID_STR) if CHANNEL_ID_STR else None
LOOKAHEAD_HOURS = int(os.getenv("BOT_LOOKAHEAD_HOURS", "12"))

# ---------------------------------------------------------------------------
# Bot setup
# ---------------------------------------------------------------------------
intents = discord.Intents.default()
intents.message_content = True
client = discord.Client(intents=intents)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def fetch_top_task():
    """Run the same logic as the scheduler and return next_action + free blocks."""
    try:
        report = build_recommendations(lookahead_hours=LOOKAHEAD_HOURS)
        return report
    except Exception as e:
        return {"error": str(e)}


def format_next_task_embed(report: dict) -> discord.Embed:
    """Turn a report into a concise Discord embed."""
    na = report.get("next_action")
    free_blocks = report.get("free_blocks_found", 0)
    tasks_considered = report.get("tasks_considered", 0)

    embed = discord.Embed(
        title="📅 Calendar ↔ ✅ Plane",
        color=0x3366FF,
        timestamp=datetime.now(timezone.utc),
    )
    embed.set_footer(text=f"Lookahead: {report.get('lookahead_hours', LOOKAHEAD_HOURS)}h | Free blocks: {free_blocks} | Tasks: {tasks_considered}")

    if not na:
        embed.description = "No open tasks found in Plane."
        return embed

    name = na.get("name", "Unknown task")
    priority = na.get("priority", "—")
    state = na.get("state", "—")
    est = na.get("estimate_minutes", 0)
    due = na.get("due_date")
    url = na.get("plane_url", "")

    due_str = f"{due[:10]} (OVERDUE)" if due and datetime.fromisoformat(due).date() < datetime.now(timezone.utc).date() else (due[:10] if due else "—")

    description = (
        f"**{name}**\n"
        f"Priority: `{priority}` | State: `{state}` | Est: `{est}m`\n"
        f"Due: `{due_str}`\n"
    )
    if url:
        description += f"[Open in Plane]({url})\n"

    embed.description = description
    embed.add_field(
        name="🔥 Recommendation",
        value=na.get("rationale", "Highest urgency score — tackle this first."),
        inline=False,
    )

    # Top 3 tasks
    top_tasks = report.get("top_tasks", [])
    if top_tasks:
        task_lines = []
        for t in top_tasks[:3]:
            tn = t.get("name", "?")
            tp = t.get("priority", "?")
            td = t.get("due_date", "")
            td_str = td[:10] if td else "—"
            t_url = t.get("plane_url", "")
            line = f"• [{tn}]({t_url}) — `{tp}` due `{td_str}`" if t_url else f"• {tn} — `{tp}` due `{td_str}`"
            task_lines.append(line)
        embed.add_field(
            name="📋 Top open tasks",
            value="\n".join(task_lines),
            inline=False,
        )

    return embed


# ---------------------------------------------------------------------------
# Message detection
# ---------------------------------------------------------------------------

QUESTION_KEYWORDS = (
    "what should i work on",
    "what's the next task",
    "what is the next task",
    "next task",
    "what to work on",
    "priority task",
    "what task",
    "what do i do",
)

COMMAND_TRIGGERS = ("!next", "!tasks", "!priority", "!work")


def is_task_query(msg: str) -> bool:
    lowered = msg.lower().strip()
    if any(lowered.startswith(cmd) for cmd in COMMAND_TRIGGERS):
        return True
    return any(kw in lowered for kw in QUESTION_KEYWORDS)


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------

@client.event
async def on_ready():
    print(f"[DiscordBot] Logged in as {client.user} (ID: {client.user.id})")
    print(f"[DiscordBot] Guilds: {[g.name for g in client.guilds]}")
    if CHANNEL_ID:
        ch = client.get_channel(CHANNEL_ID)
        ch_name = ch.name if ch else "unknown"
        print(f"[DiscordBot] Listening in channel #{ch_name} (ID: {CHANNEL_ID})")
        if ch is None:
            print(f"[DiscordBot] WARNING: Cannot access channel {CHANNEL_ID}. Check bot permissions / guild membership.")
    else:
        print("[DiscordBot] WARNING: DISCORD_CHANNEL_ID not set; bot will respond in ALL channels.")


@client.event
async def on_message(message: Message):
    if message.author.bot:
        return
    if CHANNEL_ID and message.channel.id != CHANNEL_ID:
        return
    if not is_task_query(message.content):
        return

    # Show typing indicator
    async with message.channel.typing():
        report = await asyncio.to_thread(fetch_top_task)

    if "error" in report:
        await message.channel.send(f"⚠️ Error fetching priorities: {report['error']}")
        return

    embed = format_next_task_embed(report)
    await message.channel.send(embed=embed)


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

def main():
    if not TOKEN:
        print("[DiscordBot] ERROR: DISCORD_BOT_TOKEN not set.")
        sys.exit(1)

    print("[DiscordBot] Starting...")
    client.run(TOKEN)


if __name__ == "__main__":
    main()
