#!/usr/bin/env python3
"""
Programmatic Plane Task Audit
==============================
Tests open Plane tasks that can be verified programmatically and updates
their status in Plane based on outcomes.

Requires PLANE_API_KEY env var to be set.
"""

import json
import urllib.request
import urllib.error
import subprocess
import os
import re
import base64
from datetime import datetime, timezone, timedelta

# ── Configuration ───────────────────────────────────────────────────────────
PLANE_BASE_URL = "http://23.95.189.106"
PLANE_API_KEY = os.getenv("PLANE_API_KEY", "")
PLANE_WORKSPACE = "executive"

PROJECTS = {
    "Executive": "1eb938ee-35dc-4c86-93e0-eef03d8912b5",
    "Coding": "64a3045d-76e5-4501-a943-11e5fd8718f6",
    "Business Development": "59048c57-f5db-4247-ac61-e6019c012985",
}

HEADERS = {
    "X-API-Key": PLANE_API_KEY,
    "Content-Type": "application/json",
}

# ── Plane API helpers ───────────────────────────────────────────────────────


def plane_fetch(path: str, method: str = "GET", payload: dict = None):
    base = PLANE_BASE_URL.rstrip('/')
    clean_path = path.lstrip('/')
    url = f"{base}/{clean_path}"
    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"_error": True, "status": e.code, "body": e.read().decode()[:500]}
    except Exception as e:
        return {"_error": True, "exception": str(e)}


def list_issues(project_id: str, state_group: str = None):
    params = "?per_page=100"
    if state_group:
        params += f"&state_group={state_group}"
    data = plane_fetch(f"api/v1/workspaces/{PLANE_WORKSPACE}/projects/{project_id}/issues/{params}")
    return data.get("results", [])


def get_project_states(project_id: str):
    data = plane_fetch(f"api/v1/workspaces/{PLANE_WORKSPACE}/projects/{project_id}/states/")
    return data.get("results", [])


def find_state_id(states: list, target_group: str):
    """Find state ID by group (backlog/unstarted/started/completed/cancelled) or name match."""
    target_lower = target_group.lower()
    group_map = {
        "backlog": "backlog",
        "todo": "unstarted",
        "in_progress": "started",
        "done": "completed",
        "cancelled": "cancelled",
    }
    expected_group = group_map.get(target_lower, target_lower)

    for s in states:
        if s.get("group") == expected_group:
            return s["id"]
        if s.get("name", "").lower() == target_lower:
            return s["id"]
    return None


def update_issue_state(issue_id: str, project_id: str, state_id: str):
    return plane_fetch(
        f"api/v1/workspaces/{PLANE_WORKSPACE}/projects/{project_id}/issues/{issue_id}/",
        method="PATCH",
        payload={"state": state_id, "completed_at": datetime.now(timezone.utc).isoformat()},
    )


def add_comment(project_id: str, issue_id: str, html: str):
    return plane_fetch(
        f"api/v1/workspaces/{PLANE_WORKSPACE}/projects/{project_id}/issues/{issue_id}/comments/",
        method="POST",
        payload={"comment_html": html},
    )


# ── Test helpers ────────────────────────────────────────────────────────────


def shell_run(cmd: str):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
        return result.stdout.strip(), result.stderr.strip(), result.returncode
    except Exception as e:
        return "", str(e), 1


# ── Individual test functions ───────────────────────────────────────────────


def test_dns_drift():
    expected = {
        "assistedly.ai": "Cloudflare",
        "www.assistedly.ai": "Cloudflare",
        "secrets.assistedly.ai": "104.168.38.162",
    }
    issues_found = []
    for host, expected_val in expected.items():
        stdout, _, rc = shell_run(f'dig +short "{host}" | head -1')
        if rc != 0 or not stdout:
            issues_found.append(f"{host}: DNS lookup failed")
            continue
        if expected_val == "Cloudflare":
            if not (stdout.startswith("104.") or stdout.startswith("172.") or stdout.startswith("104.21.")):
                issues_found.append(f"{host}: expected Cloudflare IP, got {stdout}")
        else:
            if expected_val not in stdout:
                issues_found.append(f"{host}: expected {expected_val}, got {stdout}")

    stdout, _, rc = shell_run('dig +short "dify.assistedly.ai" | head -1')
    if rc != 0 or not stdout:
        issues_found.append("dify.assistedly.ai: no DNS record (may be expected)")

    status = "PASS" if not issues_found else "FAIL"
    details = "; ".join(issues_found) if issues_found else "All checked DNS records match expected values."
    return status, details


def test_nocodb_integration():
    token = ""
    env_path = os.path.expanduser("~/.infisical/rendered/.env")
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.strip().startswith("NOCODB_TOKEN"):
                    token = line.split("=")[1].strip().strip("'\";")
                    break
    if not token:
        return "FAIL", "NOCODB_TOKEN not found."

    cmd = f'curl -s -o /dev/null -w "%{{http_code}}" "http://23.95.189.106:8080/api/v2/tables/m27a78vd4i6c1bc/records" -H "xc-token: {token}"'
    stdout, _, rc = shell_run(cmd)
    try:
        actual_code = int(stdout)
    except:
        actual_code = 0

    if actual_code == 200:
        return "PASS", "NoCoDB API reachable with valid token."
    else:
        return "FAIL", f"NoCoDB API returned HTTP {actual_code}."


def test_posthog_integration():
    env_path = os.path.expanduser("~/.infisical/rendered/.env")
    ph_key = ""
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.strip().startswith("POSTHOG_API_KEY="):
                    ph_key = line.split("=")[1].strip().strip("'\";")
                    break
    if not ph_key:
        return "FAIL", "POSTHOG_API_KEY not found."

    cmd = f'curl -s -o /dev/null -w "%{{http_code}}" "https://us.posthog.com/api/projects/" -H "Authorization: Bearer {ph_key}"'
    stdout, _, rc = shell_run(cmd)
    try:
        actual_code = int(stdout)
    except:
        actual_code = 0

    if actual_code == 200:
        return "PASS", "PostHog API key valid (HTTP 200)."
    else:
        return "FAIL", f"PostHog API returned HTTP {actual_code}."


def test_firecrawl_integration():
    env_path = os.path.expanduser("~/.infisical/rendered/.env")
    fc_key = ""
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.strip().startswith("FIRECRAWL_API_KEY="):
                    fc_key = line.split("=")[1].strip().strip("'\";")
                    break
    if not fc_key:
        return "FAIL", "FIRECRAWL_API_KEY not found."

    cmd = f'curl -s -X POST -H "Authorization: Bearer {fc_key}" -H "Content-Type: application/json" -d \'{{"url":"https://example.com","formats":["markdown"]}}\' "https://api.firecrawl.dev/v1/scrape"'
    stdout, _, rc = shell_run(cmd)
    try:
        resp = json.loads(stdout)
        if resp.get("success"):
            return "PASS", "Firecrawl API working (scrape test passed)."
    except:
        pass
    return "FAIL", "Firecrawl API scrape test failed."


def test_dataforseo_integration():
    env_path = os.path.expanduser("~/.infisical/rendered/.env")
    api_key = ""
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.strip().startswith("dataforseo_api_key="):
                    api_key = line.split("=")[1].strip().strip("'\";")
                    break
    if not api_key:
        return "FAIL", "dataforseo_api_key not found."

    cmd = f'curl -s -o /dev/null -w "%{{http_code}}" -H "Authorization: Basic {api_key}" -H "Content-Type: application/json" -d \'{{"data":[]}}\' "https://api.dataforseo.com/v3/serp/google/organic/task_post"'
    stdout, _, rc = shell_run(cmd)
    try:
        actual_code = int(stdout)
    except:
        actual_code = 0

    if actual_code == 200:
        return "PASS", "DataForSEO credentials valid (auth accepted)."
    else:
        return "FAIL", f"DataForSEO API returned HTTP {actual_code}."


def test_zabbix_integration():
    env_path = os.path.expanduser("~/.infisical/rendered/.env")
    zabbix_url = ""
    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                if line.strip().startswith("ZABBIX_MCP_URL="):
                    zabbix_url = line.split("=")[1].strip().strip("'\";")
                    break
    if not zabbix_url:
        return "FAIL", "ZABBIX_MCP_URL not found."

    stdout, _, rc = shell_run(f'curl -s -o /dev/null -w "%{{http_code}}" "{zabbix_url}"')
    try:
        actual_code = int(stdout)
    except:
        actual_code = 0

    if actual_code == 200:
        return "PASS", f"Zabbix MCP URL reachable (HTTP 200)."
    else:
        return "FAIL", f"Zabbix MCP URL returned HTTP {actual_code}."


def test_mcp_configs():
    home = os.path.expanduser("~")
    configs = []
    for path in [
        f"{home}/.cursor/mcp.json",
        f"{home}/.config/goose/mcp.json",
        f"{home}/.vscode/mcp.json",
        f"{home}/.local/share/goose/mcp.json",
    ]:
        if os.path.exists(path) and os.path.getsize(path) > 10:
            try:
                with open(path) as f:
                    data = json.load(f)
                    servers = data.get("mcpServers", {})
                    configs.extend(list(servers.keys()))
            except:
                pass

    project_mcp_scripts = []
    scripts_dir = "/Users/joshdev/Assistedly.ai/scripts"
    if os.path.isdir(scripts_dir):
        for f in os.listdir(scripts_dir):
            if "mcp" in f.lower():
                project_mcp_scripts.append(f)

    detail_parts = []
    if configs:
        detail_parts.append(f"Found MCP configs: {', '.join(configs)}.")
    if project_mcp_scripts:
        detail_parts.append(f"Project scripts: {', '.join(project_mcp_scripts)}.")

    if not detail_parts:
        return "FAIL", "No MCP config files or scripts found beyond basic setup."

    detail = " ".join(detail_parts)
    if len(configs) + len(project_mcp_scripts) >= 3:
        return "PARTIAL", detail
    else:
        return "PARTIAL", detail


def test_bot_schedule_alive(schedule_id: str):
    stdout, stderr, rc = shell_run("goose schedule list 2>/dev/null")
    if rc != 0:
        return "FAIL", f"Failed to get Goose schedule list: {stderr}"

    in_block = False
    found = False
    last_run = None
    cron_expr = None

    lines = stdout.splitlines()
    for i, line in enumerate(lines):
        if line.strip().startswith(f"- ID: {schedule_id}"):
            found = True
            in_block = True
        if in_block:
            if "Cron:" in line:
                cron_expr = line.split("Cron:", 1)[1].strip()
            if "Last Run:" in line:
                last_run = line.split("Last Run:", 1)[1].strip()
            if line.strip() == "" or (line.strip().startswith("- ID:") and not line.strip().startswith(f"- ID: {schedule_id}")):
                in_block = False

    if not found:
        return "FAIL", f"Schedule {schedule_id} not found."

    if not last_run or last_run.lower() in ("never", "none", "null", ""):
        return "FAIL", f"Schedule {schedule_id} exists but has never run. Cron: {cron_expr}"

    try:
        last_dt = datetime.fromisoformat(last_run.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        stale_hours = (now - last_dt).total_seconds() / 3600

        fields = cron_expr.split()
        is_daily_or_more = True
        if len(fields) >= 6:
            weekday = fields[5]
            if weekday != "*":
                is_daily_or_more = False

        if stale_hours > 168 and is_daily_or_more:
            return "FAIL", f"Schedule {schedule_id} stale: {stale_hours:.1f}h (cron: {cron_expr})."
        elif stale_hours > 168 and not is_daily_or_more:
            return "PASS", f"Weekly schedule; {stale_hours:.1f}h stale is acceptable (last: {last_run})."
        else:
            return "PASS", f"Schedule healthy. Last run: {last_run} ({stale_hours:.1f}h ago)."
    except Exception as e:
        return "WARN", f"Could not parse timestamp: {e}. Last run: {last_run}"


def test_fleet_schedules():
    stdout, stderr, rc = shell_run("goose schedule list 2>/dev/null")
    if rc != 0:
        return "FAIL", f"Cannot list schedules: {stderr}"

    # Match by cron patterns since Goose auto-assigns IDs
    expected_crons = {
        "agetech-strategy-daily": "0 7 * * *",
        "bot-fleet-commander": "0 6 * * *",
        "competitor-analysis-biweekly": "0 9 * * 1,4",
        "firecrawl-senior-health-outreach": "30 10 * * 1,3,5",
    }

    missing = []
    for name, cron in expected_crons.items():
        if cron not in stdout:
            missing.append(name)

    if missing:
        return "FAIL", f"Missing schedules (by cron): {', '.join(missing)}."
    else:
        return "PASS", f"All expected revenue-critical schedules found by cron pattern. Detected: {', '.join(expected_crons.keys())}."


# ── Test mapping ────────────────────────────────────────────────────────────

TESTS = {
    ("Executive", 29): test_dns_drift,
    ("Executive", 13): test_nocodb_integration,
    ("Executive", 12): test_posthog_integration,
    ("Executive", 15): test_firecrawl_integration,
    ("Executive", 14): test_dataforseo_integration,
    ("Executive", 16): test_zabbix_integration,
    ("Executive", 18): test_mcp_configs,
    ("Executive", 17): test_mcp_configs,
    ("Coding", 5): lambda: test_bot_schedule_alive("agent_created_1783165470"),
    ("Coding", 4): lambda: test_bot_schedule_alive("agent_created_1783165470"),
    ("Business Development", 0): test_fleet_schedules,
}


def main():
    if not PLANE_API_KEY:
        print("ERROR: PLANE_API_KEY not set.")
        return 1

    print("=" * 70)
    print("PROGRAMMATIC PLANE TASK AUDIT")
    print("=" * 70)

    # Fetch open issues per project
    issue_cache = {}
    for proj_name, proj_id in PROJECTS.items():
        issues = list_issues(proj_id, "backlog,unstarted,started")
        issue_cache[proj_name] = {i["sequence_id"]: i for i in issues}
        print(f"\n📁 {proj_name}: loaded {len(issues)} open issues.")

    # Fetch states per project once
    state_cache = {}
    for proj_name, proj_id in PROJECTS.items():
        state_cache[proj_name] = get_project_states(proj_id)

    results = []

    for (proj_name, seq_id), test_fn in TESTS.items():
        issue_map = issue_cache.get(proj_name, {})
        if seq_id not in issue_map and proj_name != "Business Development":
            print(f"\n  ⚠️  {proj_name}-{seq_id}: Issue not found (may already be done). Skipping.")
            continue

        issue = issue_map.get(seq_id)
        issue_label = f"{proj_name}-{seq_id}"
        issue_name = issue["name"] if issue else "Fleet schedules"
        print(f"\n🔍 Testing {issue_label}: {issue_name[:60]} ...")

        try:
            status, detail = test_fn()
        except Exception as e:
            status, detail = "ERROR", str(e)

        print(f"   Result: {status} — {detail}")

        if issue:
            current_state_id = issue.get("state", "")
            current_state_name = None
            for s in state_cache.get(proj_name, []):
                if s["id"] == current_state_id:
                    current_state_name = s.get("group", "unknown")
                    break

            # Determine target state
            if status == "PASS":
                target_state = "done" if current_state_name != "completed" else None
            elif status == "PARTIAL":
                target_state = "in_progress" if current_state_name not in ("completed", "started") else None
            else:
                target_state = None

            if target_state:
                target_state_id = find_state_id(state_cache.get(proj_name, []), target_state)
                if target_state_id:
                    print(f"   🔄 Updating state -> {target_state}")
                    res = update_issue_state(issue["id"], PROJECTS[proj_name], target_state_id)
                    if res.get("_error"):
                        print(f"   ⚠️  State update failed: {res}")
                    else:
                        print(f"   ✅ State updated.")
                else:
                    print(f"   ⚠️  Could not find state ID for {target_state}")

            # Add comment
            html = f"<p><b>[Auto-Audit {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC]</b><br/>Result: {status}. {detail}</p>"
            comment_res = add_comment(PROJECTS[proj_name], issue["id"], html)
            if comment_res.get("_error"):
                print(f"   ⚠️  Comment failed (HTTP {comment_res.get('status','?')}): {comment_res.get('body','')[:80]}")
            else:
                print(f"   💬 Comment added.")

            results.append({
                "issue": issue_label,
                "name": issue_name,
                "status": status,
                "detail": detail,
                "state_changed": target_state is not None,
            })
        else:
            results.append({
                "issue": issue_label,
                "name": issue_name,
                "status": status,
                "detail": detail,
                "state_changed": False,
            })

    print("\n" + "=" * 70)
    print("AUDIT SUMMARY")
    print("=" * 70)
    for r in results:
        emoji = "✅" if r["status"] == "PASS" else ("⚠️" if r["status"] == "PARTIAL" else "❌")
        print(f"{emoji} {r['issue']} ({r['name'][:45]}): {r['status']} — {r['detail'][:60]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
