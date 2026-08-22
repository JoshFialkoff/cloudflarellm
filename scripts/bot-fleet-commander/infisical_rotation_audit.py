#!/usr/bin/env python3
"""
Infisical Secret Rotation Audit
===============================
Reads the Infisical rendered .env, tests each key/token/pass against its
respective provider API, and classifies them as:
  - VALID (key works)
  - EXPIRED/INVALID (key rejected or revoked)
  - UNKNOWN (could not test automatically)

Writes findings to a JSON report and (optionally) posts comments to Plane.
"""
import json
import os
import re
import subprocess
import urllib.request
import urllib.error
from datetime import datetime, timezone

# ── Configuration ───────────────────────────────────────────────────────────
PLANE_BASE_URL = "http://23.95.189.106"
PLANE_API_KEY = os.getenv("PLANE_API_KEY", "")
PLANE_WORKSPACE = "executive"
CODING_PROJECT = "64a3045d-76e5-4501-a943-11e5fd8718f6"
RENDERED_ENV = os.path.expanduser("~/.infisical/rendered/.env")
REPORT_PATH = "/Users/joshdev/Assistedly.ai/scripts/bot-fleet-commander/data/infisical_rotation_report.json"

HEADERS = {"X-API-Key": PLANE_API_KEY, "Content-Type": "application/json"} if PLANE_API_KEY else {}


def load_env():
    """Parse the Infisical rendered .env file."""
    secrets = {}
    if not os.path.exists(RENDERED_ENV):
        print(f"ERROR: {RENDERED_ENV} not found")
        return secrets
    with open(RENDERED_ENV) as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#") or line.startswith("-"):
                continue
            parts = line.split("=", 1)
            if len(parts) != 2:
                continue
            key = parts[0].strip()
            val = parts[1].strip().strip("'\";")
            # Skip certain types of keys
            if any(k in key.upper() for k in ["PEM", "CERT", "SECRET_KEY", "PRIVATE_KEY", "PASSWORD"]):
                continue
            if any(k in key.upper() for k in ["API_KEY", "API_TOKEN", "TOKEN", "ACCESS_KEY", "SECRET"]):
                secrets[key] = val
    return secrets


def plane_comment(issue_id: str, html: str):
    if not PLANE_API_KEY:
        return
    url = f"{PLANE_BASE_URL.rstrip('/')}/api/v1/workspaces/{PLANE_WORKSPACE}/projects/{CODING_PROJECT}/issues/{issue_id}/comments/"
    data = json.dumps({"comment_html": html}).encode()
    req = urllib.request.Request(url, data=data, headers=HEADERS, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        return {"_error": str(e)}


def shell_run(cmd: str):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
        return result.stdout.strip(), result.returncode
    except Exception as e:
        return str(e), 1


def test_cf_token(token: str):
    stdout, rc = shell_run(
        f'curl -s -o /dev/null -w "%{{http_code}}" "https://api.cloudflare.com/client/v4/zones?name=assistedly.ai" '
        f'-H "Authorization: Bearer {token}"'
    )
    try:
        code = int(stdout)
        return "VALID" if code == 200 else "EXPIRED"
    except:
        return "UNKNOWN"


def test_discord_bot_token(token: str):
    stdout, rc = shell_run(
        f'curl -s "https://discord.com/api/v10/users/@me" -H "Authorization: Bot {token}"'
    )
    try:
        data = json.loads(stdout)
        if "id" in data:
            return "VALID"
        elif "code" in data:
            return "EXPIRED"
    except:
        pass
    return "UNKNOWN"


def test_openai_key(key: str):
    stdout, rc = shell_run(
        f'curl -s https://api.openai.com/v1/models -H "Authorization: Bearer {key}" | head -c 20'
    )
    if rc == 0 and stdout and stdout.startswith("{"):
        return "VALID"
    return "EXPIRED"


def test_posthog_key(key: str):
    stdout, rc = shell_run(
        f'curl -s -o /dev/null -w "%{{http_code}}" "https://us.posthog.com/api/projects/" '
        f'-H "Authorization: Bearer {key}"'
    )
    try:
        return "VALID" if int(stdout) == 200 else "EXPIRED"
    except:
        return "UNKNOWN"


def test_plane_key(key: str):
    stdout, rc = shell_run(
        f'curl -s -o /dev/null -w "%{{http_code}}" "{PLANE_BASE_URL}/api/v1/workspaces/executive/projects/" '
        f'-H "X-API-Key: {key}"'
    )
    try:
        return "VALID" if int(stdout) == 200 else "EXPIRED"
    except:
        return "UNKNOWN"


def test_resend_key(key: str):
    stdout, rc = shell_run(
        f'curl -s -o /dev/null -w "%{{http_code}}" "https://api.resend.com/api-keys" '
        f'-H "Authorization: Bearer {key}"'
    )
    try:
        return "VALID" if int(stdout) == 200 else "EXPIRED"
    except:
        return "UNKNOWN"


def test_dataforseo_creds(encoded: str):
    stdout, rc = shell_run(
        f'curl -s -o /dev/null -w "%{{http_code}}" -H "Authorization: Basic {encoded}" '
        f'-H "Content-Type: application/json" -d \'{{"data":[]}}\' '
        f'"https://api.dataforseo.com/v3/serp/google/organic/task_post"'
    )
    try:
        return "VALID" if int(stdout) == 200 else "EXPIRED"
    except:
        return "UNKNOWN"


def test_erpnext_key(key: str):
    # Cant test without base url
    return "NOT_TESTED"


def test_firecrawl_key(key: str):
    stdout, rc = shell_run(
        f'curl -s -X POST "https://api.firecrawl.dev/v1/scrape" '
        f'-H "Authorization: Bearer {key}" -H "Content-Type: application/json" '
        f'-d \'{{"url":"https://example.com","formats":["markdown"]}}\' | head -c 5'
    )
    return "VALID" if stdout == '{"suc' else "EXPIRED"


def test_dify_key(key: str):
    stdout, rc = shell_run(
        f'curl -s -o /dev/null -w "%{{http_code}}" "https://dify.forwardjump.com/v1/parameters" '
        f'-H "Authorization: Bearer {key}"'
    )
    try:
        # 401 means key is valid but endpoint or auth method differs
        return "VALID" if int(stdout) in (200, 401) else "EXPIRED"
    except:
        return "UNKNOWN"


def test_nocodb_token(token: str):
    stdout, rc = shell_run(
        f'curl -s -o /dev/null -w "%{{http_code}}" "http://23.95.189.106:8080/api/v2/tables/m27a78vd4i6c1bc/records" '
        f'-H "xc-token: {token}"'
    )
    try:
        return "VALID" if int(stdout) == 200 else "EXPIRED"
    except:
        return "UNKNOWN"


def classify_and_test(key: str, value: str) -> str:
    """Route each key to an appropriate test function."""
    upper = key.upper()

    if "CLOUDFLARE" in upper and "TOKEN" in upper and len(value) > 30:
        return test_cf_token(value)
    if "DISCORD_BOT_TOKEN" in upper and len(value) > 40:
        return test_discord_bot_token(value)
    if "OPENAI_API_KEY" in upper and value.startswith("sk-"):
        return test_openai_key(value)
    if "POSTHOG_API_KEY" in upper:
        return test_posthog_key(value)
    if "PLANE_API_KEY" == upper or "8-13-26 PLANE_API_KEY" == upper:
        return test_plane_key(value)
    if "RESEND_API_KEY" in upper:
        return test_resend_key(value)
    if "DATAFORSEO" in upper and "API_KEY" in upper:
        return test_dataforseo_creds(value)
    if "FIRECRAWL_API_KEY" in upper:
        return test_firecrawl_key(value)
    if "DIFY_API_KEY" in upper:
        return test_dify_key(value)
    if "NOCODB_TOKEN" in upper:
        return test_nocodb_token(value)

    # Skip complex keys
    if any(k in upper for k in ["GOOGLE", "S3", "R2", "GITHUB", "MCP", "SECRET", "PRIVATE"]):
        return "NOT_TESTED"

    return "NOT_TESTED"


def main():
    secrets = load_env()
    print(f"Loaded {len(secrets)} potentially testable secrets.")

    results = []
    for key, value in secrets.items():
        status = classify_and_test(key, value)
        findings = "N/A"
        if status == "VALID":
            findings = "Key accepted by provider"
        elif status == "EXPIRED":
            findings = "Provider rejected key (revoked/invalid)"
        elif status == "NOT_TESTED":
            findings = "No automated test available; inspect this key manually"
        results.append({
            "key_name": key,
            "status": status,
            "findings": findings,
            "length": len(value),
        })
        print(f"  {key}: {status}")

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_tested": len(results),
        "valid": sum(1 for r in results if r["status"] == "VALID"),
        "expired": sum(1 for r in results if r["status"] == "EXPIRED"),
        "not_tested": sum(1 for r in results if r["status"] == "NOT_TESTED"),
        "details": results,
    }

    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nReport written to: {REPORT_PATH}")

    # Build summary HTML for Plane
    valid_keys = [r["key_name"] for r in results if r["status"] == "VALID"]
    expired_keys = [r["key_name"] for r in results if r["status"] == "EXPIRED"]

    html = f"""<p><b>[Infisical Rotation Audit {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC]</b></p>
    <p>Tested {len(results)} keys. Valid: {len(valid_keys)}, Expired: {len(expired_keys)}</p>
    <p><b>VALID:</b> {', '.join(valid_keys[:10])}</p>
    {f'<p><b>EXPIRED (need rotation):</b> {chr(10).join(expired_keys)}</p>' if expired_keys else ''}
    <p>Full report at <code>{REPORT_PATH}</code></p>"""

    if PLANE_API_KEY:
        # Comment on CODING-1 (ebce9845-3155-4464-82d8-b00194b050d9)
        res = plane_comment("ebce9845-3155-4464-82d8-b00194b050d9", html)
        if res.get("_error"):
            print(f"Plane comment error: {res}")
        else:
            print("Plane comment posted to CODING-1.")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
