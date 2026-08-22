#!/usr/bin/env python3
"""
Plane API Client for Assistedly.ai project management integration.

Interacts with self-hosted Plane instance to:
- List workspaces, projects, and issues (work-items)
- Create, update, and archive tasks
- Fetch tasks by status, assignee, or labels
"""

import os
import json
import sys
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

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PLANE_BASE_URL = os.getenv("PLANE_BASE_URL", "http://23.95.189.106")
PLANE_API_KEY = os.getenv("PLANE_API_KEY", "")
PLANE_WORKSPACE = os.getenv("PLANE_WORKSPACE", "executive")
PLANE_PROJECT_IDS = os.getenv("PLANE_PROJECT_IDS", "").split(",")

# Allow empty key; sync_runner handles auth failures gracefully.

HEADERS = {
    "X-API-Key": PLANE_API_KEY,
    "Content-Type": "application/json",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _url(path: str) -> str:
    """Build absolute URL."""
    # Ensure v1 API prefix is present
    if not path.startswith("api/v1/"):
        path = path.replace("api/", "api/v1/", 1) if path.startswith("api/") else f"api/v1/{path}"
    return f"{PLANE_BASE_URL.rstrip('/')}/{path.lstrip('/')}/"


def _fetch(url: str, method: str = "GET", payload: Optional[Dict] = None) -> Any:
    """Make authenticated HTTP request to Plane."""
    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(
        url, data=data, headers=HEADERS, method=method
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read()
            return json.loads(body.decode()) if body else {}
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        print(f"[{e.code}] {e.url}: {err_body}", file=sys.stderr)
        raise


# ---------------------------------------------------------------------------
# Core API Wrappers
# ---------------------------------------------------------------------------
def list_workspaces() -> List[Dict]:
    """List all accessible workspaces."""
    url = _url("workspaces")
    result = _fetch(url)
    # Plane returns {count, next, previous, results: [...]}
    if isinstance(result, dict) and "results" in result:
        return result["results"]
    return result if isinstance(result, list) else []


def list_projects(workspace_slug: Optional[str] = None) -> List[Dict]:
    """List projects in a workspace."""
    slug = workspace_slug or PLANE_WORKSPACE
    url = _url(f"workspaces/{slug}/projects")
    result = _fetch(url)
    if isinstance(result, dict) and "results" in result:
        return result["results"]
    return result if isinstance(result, list) else []


def list_issues(
    workspace_slug: Optional[str] = None,
    project_id: Optional[str] = None,
    state: Optional[str] = None,       # e.g. "backlog", "started", "completed", "cancelled"
    priority: Optional[str] = None,    # "urgent", "high", "medium", "low", "none"
    target_date_after: Optional[str] = None,
    assignee: Optional[str] = None,
    limit: int = 100,
) -> List[Dict]:
    """List issues filtered by criteria."""
    slug = workspace_slug or PLANE_WORKSPACE
    params = [f"per_page={limit}"]
    if state:
        params.append(f"state_name={state}")
    if priority:
        params.append(f"priority={priority}")
    if target_date_after:
        params.append(f"target_date__gt={target_date_after}")
    if assignee:
        params.append(f"assignees__id={assignee}")
    query = "&".join(params)

    # Without project_id we search across projects
    if project_id:
        url = _url(f"workspaces/{slug}/projects/{project_id}/issues?{query}")
    else:
        url = _url(f"workspaces/{slug}/issues?{query}")

    result = _fetch(url)
    if isinstance(result, dict) and "results" in result:
        return result["results"]
    return result if isinstance(result, list) else []


def create_issue(
    title: str,
    description_html: str = "",
    state_name: str = "backlog",
    priority: str = "medium",
    project_id: Optional[str] = None,
    workspace_slug: Optional[str] = None,
    labels: Optional[List[str]] = None,
) -> Dict:
    """Create a new issue in Plane."""
    slug = workspace_slug or PLANE_WORKSPACE
    pid = project_id or (PLANE_PROJECT_IDS[0] if PLANE_PROJECT_IDS else None)
    if not pid:
        raise ValueError("project_id is required; set PLANE_PROJECT_IDS env var.")

    payload = {
        "name": title,
        "description_html": description_html,
        "state": state_name,
        "priority": priority,
    }
    if labels:
        payload["labels_list"] = labels

    url = _url(f"workspaces/{slug}/projects/{pid}/issues")
    return _fetch(url, method="POST", payload=payload)


def update_issue(
    issue_id: str,
    updates: Dict,
    project_id: Optional[str] = None,
    workspace_slug: Optional[str] = None,
) -> Dict:
    """Update an existing issue."""
    slug = workspace_slug or PLANE_WORKSPACE
    pid = project_id or (PLANE_PROJECT_IDS[0] if PLANE_PROJECT_IDS else None)
    if not pid:
        raise ValueError("project_id is required.")

    url = _url(f"workspaces/{slug}/projects/{pid}/issues/{issue_id}")
    return _fetch(url, method="PATCH", payload=updates)


def archive_issue(
    issue_id: str,
    project_id: Optional[str] = None,
    workspace_slug: Optional[str] = None,
) -> Dict:
    """Archive an issue. In Plane, archiving is done by moving to cancelled state."""
    return update_issue(
        issue_id,
        {"state": "cancelled"},  # or appropriate archive state
        project_id=project_id,
        workspace_slug=workspace_slug,
    )


def list_states(
    workspace_slug: Optional[str] = None,
    project_id: Optional[str] = None,
) -> List[Dict]:
    """List available workflow states in a project."""
    slug = workspace_slug or PLANE_WORKSPACE
    pid = project_id or (PLANE_PROJECT_IDS[0] if PLANE_PROJECT_IDS else None)
    if not pid:
        raise ValueError("project_id is required.")

    url = _url(f"workspaces/{slug}/projects/{pid}/states")
    result = _fetch(url)
    if isinstance(result, dict) and "results" in result:
        return result["results"]
    return result if isinstance(result, list) else []


# ---------------------------------------------------------------------------
# High-level helpers for the recipe
# ---------------------------------------------------------------------------
def get_next_action_tasks() -> List[Dict]:
    """
    Fetch tasks that are:
    - In 'started' or 'unstarted/backlog' state (next actions)
    - Due soon or high priority
    """
    today_iso = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tasks = []

    for pid in PLANE_PROJECT_IDS:
        if not pid:
            continue
        for state in ["backlog", "started", "todo"]:
            found = list_issues(
                project_id=pid,
                state=state,
                limit=50,
            )
            for t in found:
                t["_source_project_id"] = pid
            tasks.extend(found)

    # Deduplicate by id
    seen = set()
    unique = []
    for t in tasks:
        iid = t.get("id")
        if iid and iid not in seen:
            seen.add(iid)
            unique.append(t)

    return unique


def get_goals() -> List[Dict]:
    """
    Fetch project goals / milestones. Plane calls these Cycles or Modules.
    For now, we return cycles from each project.
    """
    cycles = []
    for pid in PLANE_PROJECT_IDS:
        if not pid:
            continue
        url = _url(f"workspaces/{PLANE_WORKSPACE}/projects/{pid}/cycles")
        result = _fetch(url)
        items = result.get("results", []) if isinstance(result, dict) else []
        for c in items:
            c["_source_project_id"] = pid
        cycles.extend(items)
    return cycles


# ---------------------------------------------------------------------------
# CLI entrypoints for testing
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Plane API CLI")
    parser.add_argument("action", choices=[
        "workspaces", "projects", "issues", "states",
        "create_issue", "update_issue", "next_actions", "goals",
    ])
    parser.add_argument("--project-id", default=None)
    parser.add_argument("--title", default="Test task")
    parser.add_argument("--desc", default="")
    parser.add_argument("--state", default="backlog")
    parser.add_argument("--priority", default="medium")
    parser.add_argument("--issue-id", default=None)
    parser.add_argument("--updates", default="{}", help="JSON string of updates")
    args = parser.parse_args()

    if args.action == "workspaces":
        print(json.dumps(list_workspaces(), indent=2))
    elif args.action == "projects":
        print(json.dumps(list_projects(), indent=2))
    elif args.action == "issues":
        print(json.dumps(list_issues(project_id=args.project_id), indent=2))
    elif args.action == "states":
        print(json.dumps(list_states(project_id=args.project_id), indent=2))
    elif args.action == "next_actions":
        print(json.dumps(get_next_action_tasks(), indent=2))
    elif args.action == "goals":
        print(json.dumps(get_goals(), indent=2))
    elif args.action == "create_issue":
        print(json.dumps(create_issue(
            title=args.title,
            description_html=args.desc,
            state_name=args.state,
            priority=args.priority,
            project_id=args.project_id,
        ), indent=2))
    elif args.action == "update_issue":
        print(json.dumps(update_issue(
            issue_id=args.issue_id,
            updates=json.loads(args.updates),
            project_id=args.project_id,
        ), indent=2))
