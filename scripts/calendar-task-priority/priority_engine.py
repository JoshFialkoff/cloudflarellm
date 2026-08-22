#!/usr/bin/env python3
"""
Priority Engine

Scores Plane issues by:
1.  Priority level (urgent > high > medium > low)
2.  Due-date proximity (overdue / today / this week / later)
3.  State bonus (started / in-progress gets a boost)
4.  Estimated effort alignment with available time blocks
"""

import os
import json
import math
import sys
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

# Env vars are set by run.sh. Local .env overrides.
try:
    from dotenv import load_dotenv
    _local_env = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(_local_env):
        load_dotenv(_local_env)
except ImportError:
    pass

# Re-use existing plane client
_SCRIPT_DIR = os.path.dirname(__file__)
_PLANE_CLIENT_PATH = os.path.join(_SCRIPT_DIR, "..", "plane-discord-sync")
if _PLANE_CLIENT_PATH not in sys.path:
    sys.path.insert(0, _PLANE_CLIENT_PATH)

import plane_client

# Fallback project IDs if PLANE_PROJECT_IDS env var is not set
_DEFAULT_PROJECT_IDS = [
    "64a3045d-76e5-4501-a943-11e5fd8718f6",
    "59048c57-f5db-4247-ac61-e6019c012985",
]

_STATE_NAME_CACHE: Dict[str, str] = {}


def _build_state_map(project_ids: List[str]) -> Dict[str, str]:
    """Fetch Plane workflow states and map UUID -> human-readable name."""
    global _STATE_NAME_CACHE
    if _STATE_NAME_CACHE:
        return _STATE_NAME_CACHE
    for pid in project_ids:
        if not pid:
            continue
        try:
            for s in plane_client.list_states(project_id=pid):
                sid = s.get("id")
                sname = s.get("name", s.get("group", "unknown"))
                if sid:
                    _STATE_NAME_CACHE[sid] = sname
        except Exception:
            pass
    return _STATE_NAME_CACHE


# ---------------------------------------------------------------------------
# Priority scoring
# ---------------------------------------------------------------------------
_PRIORITY_WEIGHTS = {
    "urgent": 100,
    "high": 75,
    "medium": 50,
    "low": 25,
    None: 20,
    "none": 20,
}

_STATE_BONUS = {
    "started": 15,
    "in_progress": 15,
    "todo": 5,
    "backlog": 0,
    None: 0,
}

# Estimate mapping (very rough — can be overridden by labels)
_DEFAULT_ESTIMATES = {
    "urgent": 120,
    "high": 90,
    "medium": 60,
    "low": 30,
    None: 45,
}


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str or date_str in ("null", "None"):
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
        try:
            if "Z" in date_str:
                date_str = date_str.replace("Z", "+00:00")
            dt = datetime.fromisoformat(date_str)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


def _due_score(target_date: Optional[datetime], now: datetime) -> float:
    """
    Return 0-100 score based on due-date proximity.
    Overdue → 100, today → 90, this week → 70, next week → 40, later → 10.
    """
    if target_date is None:
        return 30  # No due date = moderate uncertainty

    delta = target_date - now
    days = delta.total_seconds() / 86400

    if days < 0:
        return 100  # Overdue
    if days < 1:
        return 90   # Due today
    if days < 2:
        return 80   # Tomorrow
    if days < 7:
        return 50 + (7 - days) * 4  # 50 → 78 sliding scale
    return max(10, 50 - days * 2)


def _estimate_minutes(task: Dict[str, Any]) -> int:
    """Extract or infer estimated minutes for a task."""
    labels = task.get("labels", [])
    for label in labels:
        name = (label.get("name") if isinstance(label, dict) else str(label)).lower()
        if "quick" in name or "15min" in name:
            return 15
        if "medium" in name or "1h" in name:
            return 60
        if "deep" in name or "2h" in name or "halfday" in name:
            return 120
        if "full" in name or "4h" in name or "day" in name:
            return 240

    raw_est = task.get("estimate_point")
    if raw_est is not None:
        try:
            return int(raw_est)
        except (ValueError, TypeError):
            pass

    priority = (task.get("priority") or "medium").lower()
    return _DEFAULT_ESTIMATES.get(priority, 45)


def score_task(task: Dict[str, Any], now: Optional[datetime] = None) -> Dict[str, Any]:
    """
    Return a scored task dict with composite priority score.
    """
    now = now or datetime.now(timezone.utc)

    priority = (task.get("priority") or "medium").lower()
    state = (task.get("state") or task.get("state_name") or "backlog").lower().replace(" ", "_")
    target_date = _parse_date(task.get("target_date"))

    p_score = _PRIORITY_WEIGHTS.get(priority, _PRIORITY_WEIGHTS[None])
    d_score = _due_score(target_date, now)
    s_bonus = _STATE_BONUS.get(state, 0)

    # Composite: 50% priority + 30% due-date + 20% state
    composite = (p_score * 0.50) + (d_score * 0.30) + (s_bonus * 0.20)

    # Small random tie-breaker (deterministic per-task-id)
    tid = task.get("id", "")
    tie = (hash(tid) % 100) / 1000.0

    enriched = dict(task)
    enriched["_score"] = round(composite + tie, 2)
    enriched["_priority_score"] = round(p_score, 2)
    enriched["_due_score"] = round(d_score, 2)
    enriched["_state_bonus"] = s_bonus
    enriched["_estimate_minutes"] = _estimate_minutes(task)
    enriched["_due_date"] = target_date.isoformat() if target_date else None

    return enriched


def get_prioritized_tasks(
    limit: int = 20,
    include_states: Optional[List[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch open tasks from Plane, score them, and return top N sorted by urgency.
    """
    now = datetime.now(timezone.utc)
    include_states = include_states or ["backlog", "started", "todo", "unstarted"]

    # Use fallback project IDs if env var is missing/empty
    project_ids = [p for p in plane_client.PLANE_PROJECT_IDS if p]
    if not project_ids:
        project_ids = _DEFAULT_PROJECT_IDS

    raw_tasks = []
    for pid in project_ids:
        if not pid:
            continue
        for state in include_states:
            try:
                found = plane_client.list_issues(
                    project_id=pid,
                    state=state,
                    limit=50,
                )
                for t in found:
                    t["_source_project_id"] = pid
                raw_tasks.extend(found)
            except Exception as e:
                print(f"[PriorityEngine] Failed to fetch {state} for {pid}: {e}", file=sys.stderr)

    # Build state name map and deduplicate
    state_map = _build_state_map(project_ids)
    seen = set()
    unique = []
    for t in raw_tasks:
        tid = t.get("id")
        if tid and tid not in seen:
            seen.add(tid)
            # Resolve state UUID to human-readable name
            raw_state = t.get("state") or t.get("state_name")
            if raw_state and raw_state in state_map:
                t["state"] = state_map[raw_state]
            unique.append(t)

    # Score & sort
    scored = [score_task(t, now) for t in unique]
    scored.sort(key=lambda x: x["_score"], reverse=True)
    return scored[:limit]


def find_fitting_task(
    available_minutes: int,
    prior_tasks: List[Dict[str, Any]],
    flex_percent: float = 0.25,
) -> Optional[Dict[str, Any]]:
    """
    Given a time block of N minutes, return the highest-priority task
    whose estimated duration fits within that block (+/- flex).
    """
    min_mins = available_minutes * (1 - flex_percent)
    max_mins = available_minutes * (1 + flex_percent)

    candidates = [t for t in prior_tasks if min_mins <= t["_estimate_minutes"] <= max_mins]
    if candidates:
        return candidates[0]

    # Fallback: any task that fits at all
    fits = [t for t in prior_tasks if t["_estimate_minutes"] <= available_minutes]
    return fits[0] if fits else None


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Task Priority Engine")
    parser.add_argument("--limit", type=int, default=10)
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    args = parser.parse_args()

    tasks = get_prioritized_tasks(limit=args.limit)

    if args.json:
        print(json.dumps(tasks, indent=2, default=str))
    else:
        print(f"{'Score':<6} {'Mins':<5} {'Priority':<8} {'State':<12} {'Name'}")
        print("-" * 80)
        for t in tasks:
            print(
                f"{t['_score']:<6} {t['_estimate_minutes']:<5} "
                f"{(t.get('priority') or 'none'):<8} "
                f"{(t.get('state') or 'backlog'):<12} "
                f"{t.get('name', t.get('title', '(No title)')[:60])}"
            )
