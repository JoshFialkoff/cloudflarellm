#!/usr/bin/env python3
"""
Smart loader for Infisical rendered .env that picks the FIRST valid Plane API key
instead of the last (stale) duplicate that python-dotenv would load.
"""
import os
import re
import subprocess
import warnings
from typing import Optional


def _find_working_plane_key(env_path: str) -> Optional[str]:
    """Scan rendered env for Plane credentials, test them, return first working."""
    if not os.path.exists(env_path):
        return None

    with open(env_path) as f:
        lines = f.readlines()

    candidates = []
    for line in lines:
        line = line.strip()
        m = re.search(r"PLANE_API_KEY=['\"]?(plane_api_[a-f0-9]+)", line, re.IGNORECASE)
        if m:
            candidates.append(m.group(1))

    # Also check for key stored as GooseSyncBot (Infisical sometimes uses key name as env name)
    for line in lines:
        m = re.search(r"GooseSyncBot=['\"]?(plane_api_[a-f0-9]+)", line, re.IGNORECASE)
        if m:
            candidates.append(m.group(1))

    test_url = (
        os.getenv("PLANE_BASE_URL", "http://23.95.189.106").rstrip("/")
        + "/api/v1/workspaces/executive/projects/"
    )

    for key in candidates:
        if not key:
            continue
        result = subprocess.run(
            ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", test_url, "-H", f"X-API-Key: {key}"],
            capture_output=True,
            text=True,
        )
        if result.stdout.strip() == "200":
            return key
    return None


def load_infisical_env():
    """Load Infisical env smartly.  Suppresses dotenv parse warnings."""
    env_path = os.path.join(os.path.expanduser("~"), ".infisical", "rendered", ".env")

    # 1) Try standard dotenv first (loads *most* vars correctly)
    try:
        from dotenv import load_dotenv
        if os.path.exists(env_path):
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                load_dotenv(env_path)
    except ImportError:
        pass

    # 2) Override stale PLANE_API_KEY with first working key from file
    valid_key = _find_working_plane_key(env_path)
    if valid_key:
        os.environ["PLANE_API_KEY"] = valid_key

    # 3) Fallback project IDs if still missing
    known_ids = [
        "64a3045d-76e5-4501-a943-11e5fd8718f6",
        "59048c57-f5db-4247-ac61-e6019c012985",
        "1eb938ee-35dc-4c86-93e0-eef03d8912b5",
    ]
    if not os.getenv("PLANE_PROJECT_IDS"):
        os.environ["PLANE_PROJECT_IDS"] = ",".join(known_ids)


if __name__ == "__main__":
    load_infisical_env()
    print("PLANE_API_KEY:", os.getenv("PLANE_API_KEY", "NOT SET"))
    print("PLANE_PROJECT_IDS:", os.getenv("PLANE_PROJECT_IDS", "NOT SET"))
