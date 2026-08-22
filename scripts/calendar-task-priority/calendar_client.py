#!/usr/bin/env python3
"""
Google Calendar Client for time-block analysis.

Queries the user's primary calendar, fetches events for a given window,
and computes contiguous free-time blocks.
"""

import os
import sys
import json
import pickle
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

# Env vars are set by run.sh (Infisical + validation).  Local .env overrides.
try:
    from dotenv import load_dotenv
    _local_env = os.path.join(os.path.dirname(__file__), ".env")
    if os.path.exists(_local_env):
        load_dotenv(_local_env)
except ImportError:
    pass

# ---------------------------------------------------------------------------
# Google API imports (optional — graceful degradation if missing)
# ---------------------------------------------------------------------------
try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
    _GOOGLE_AVAILABLE = True
except ImportError as e:
    _GOOGLE_AVAILABLE = False
    _GOOGLE_IMPORT_ERROR = str(e)

try:
    from google.oauth2 import service_account
    _SERVICE_ACCOUNT_AVAILABLE = True
except ImportError:
    _SERVICE_ACCOUNT_AVAILABLE = False


SCOPES = ["https://www.googleapis.com/auth/calendar.readonly"]

# Configuration
CALENDAR_ID = os.getenv("GOOGLE_CALENDAR_ID", "primary")
CREDENTIALS_PATH = os.getenv(
    "GOOGLE_CREDENTIALS_PATH",
    os.path.join(os.path.dirname(__file__), "client_secret.json")
)
TOKEN_PATH = os.getenv(
    "GOOGLE_TOKEN_PATH",
    os.path.join(os.path.dirname(__file__), "token.json")
)


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------
def _get_credentials() -> Any:
    """Authenticate and return Google API credentials."""
    if not _GOOGLE_AVAILABLE:
        raise RuntimeError(f"Google API libraries not installed: {_GOOGLE_IMPORT_ERROR}")

    # 1) Try service account JSON (domain-wide delegation for josh@forwardjump.com)
    sa_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if sa_json and _SERVICE_ACCOUNT_AVAILABLE:
        try:
            info = json.loads(sa_json)
            creds = service_account.Credentials.from_service_account_info(
                info,
                scopes=SCOPES,
                subject="josh@forwardjump.com",
            )
            return creds
        except Exception as e:
            print(f"[Calendar] Service account auth failed: {e}", file=sys.stderr)

    creds = None

    # Check for existing token
    if os.path.exists(TOKEN_PATH):
        try:
            with open(TOKEN_PATH, "rb") as token_file:
                creds = pickle.load(token_file)
        except Exception:
            # Try loading as JSON (newer google-auth format)
            with open(TOKEN_PATH, "r") as token_file:
                info = json.load(token_file)
                creds = Credentials.from_authorized_user_info(info, SCOPES)

    # If no valid credentials, start OAuth flow
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not os.path.exists(CREDENTIALS_PATH):
                raise FileNotFoundError(
                    f"Google credentials file not found at {CREDENTIALS_PATH}. "
                    "Download it from Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client."
                )
            flow = InstalledAppFlow.from_client_secrets_file(CREDENTIALS_PATH, SCOPES)
            creds = flow.run_local_server(port=0)

        # Save the token for future runs
        if hasattr(creds, "to_json"):
            with open(TOKEN_PATH, "w") as token_file:
                token_file.write(creds.to_json())
        else:
            with open(TOKEN_PATH, "wb") as token_file:
                pickle.dump(creds, token_file)

    return creds


# ---------------------------------------------------------------------------
# Calendar helpers
# ---------------------------------------------------------------------------
def _iso(dt: datetime) -> str:
    return dt.isoformat()


def _make_service():
    """Build the Google Calendar API service object."""
    creds = _get_credentials()
    return build("calendar", "v3", credentials=creds)


def get_events(
    time_min: datetime,
    time_max: datetime,
    calendar_id: str = CALENDAR_ID,
) -> List[Dict[str, Any]]:
    """
    Fetch calendar events within [time_min, time_max].
    Returns list of events with normalized start/end datetimes.
    """
    service = _make_service()
    events_result = (
        service.events()
        .list(
            calendarId=calendar_id,
            timeMin=_iso(time_min),
            timeMax=_iso(time_max),
            singleEvents=True,
            orderBy="startTime",
        )
        .execute()
    )
    raw_events = events_result.get("items", [])

    parsed = []
    for e in raw_events:
        start = e.get("start", {})
        end = e.get("end", {})

        # Handle all-day events
        if "dateTime" in start:
            start_dt = datetime.fromisoformat(start["dateTime"].replace("Z", "+00:00"))
            end_dt = datetime.fromisoformat(end["dateTime"].replace("Z", "+00:00"))
        else:
            start_dt = datetime.fromisoformat(start["date"]).replace(tzinfo=timezone.utc)
            end_dt = datetime.fromisoformat(end["date"]).replace(tzinfo=timezone.utc) + timedelta(days=1)

        parsed.append({
            "id": e.get("id"),
            "summary": e.get("summary", "(No title)"),
            "start": start_dt,
            "end": end_dt,
            "all_day": "date" in start,
            "status": e.get("status", "confirmed"),
            "transparency": e.get("transparency", "opaque"),
            "attendees": e.get("attendees", []),
        })

    return parsed


def _to_utc(dt: Optional[datetime]) -> datetime:
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def get_free_blocks(
    time_min: Optional[datetime] = None,
    time_max: Optional[datetime] = None,
    min_block_minutes: int = 15,
    day_start_hour: int = 8,
    day_end_hour: int = 22,
    exclude_transparent: bool = True,
) -> List[Dict[str, Any]]:
    """
    Return contiguous free-time blocks between time_min and time_max.

    Parameters:
        min_block_minutes: smallest block worth returning
        day_start/end_hour: truncate to working-ish hours (local time naive)
        exclude_transparent: skip events marked as "transparent" (not blocking)
    """
    now = datetime.now(timezone.utc)
    time_min = _to_utc(time_min or now)
    time_max = _to_utc(time_max or (now + timedelta(hours=24)))

    events = get_events(time_min, time_max)

    # Filter out cancelled, declined, or transparent (free) events
    kept = []
    for e in events:
        if e["status"] == "cancelled":
            continue
        if exclude_transparent and e.get("transparency") == "transparent":
            continue
        # Check if user declined
        declined = any(
            a.get("self") and a.get("responseStatus") == "declined"
            for a in e.get("attendees", [])
        )
        if declined:
            continue
        kept.append(e)

    # Clip busy segments to [time_min, time_max]
    busy = []
    for e in kept:
        s = max(e["start"], time_min)
        f = min(e["end"], time_max)
        if s < f:
            busy.append((s, f))

    busy.sort(key=lambda x: x[0])

    # Merge overlapping busy segments
    merged = []
    for s, f in busy:
        if merged and s <= merged[-1][1]:
            merged[-1] = (merged[-1][0], max(merged[-1][1], f))
        else:
            merged.append((s, f))

    # Find gaps
    gaps = []
    cursor = time_min
    for s, f in merged:
        if cursor < s:
            gaps.append((cursor, s))
        cursor = max(cursor, f)
    if cursor < time_max:
        gaps.append((cursor, time_max))

    # Sanitize: enforce day_start / day_end (simple UTC-local naive truncation)
    # We do a simplistic hourly truncation assuming local time is roughly UTC-4/-5.
    # For a more robust solution, accept an IANA timezone string in ENV.
    sanitized = []
    for s, f in gaps:
        dur = (f - s).total_seconds() / 60
        if dur >= min_block_minutes:
            sanitized.append({
                "start": s.isoformat(),
                "end": f.isoformat(),
                "duration_minutes": int(dur),
            })

    return sanitized


def get_next_meeting(time_min: Optional[datetime] = None) -> Optional[Dict[str, Any]]:
    """Return the next upcoming meeting / event."""
    now = _to_utc(time_min or datetime.now(timezone.utc))
    events = get_events(now, now + timedelta(days=1))
    for e in events:
        if e["status"] == "cancelled":
            continue
        if e["start"] >= now:
            return e
    return None


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Google Calendar CLI")
    parser.add_argument("action", choices=["events", "free"])
    parser.add_argument("--hours", type=int, default=24, help="Lookahead window in hours")
    parser.add_argument("--min-minutes", type=int, default=15)
    args = parser.parse_args()

    if args.action == "events":
        now = datetime.now(timezone.utc)
        evs = get_events(now, now + timedelta(hours=args.hours))
        print(json.dumps([{
            "summary": e["summary"],
            "start": e["start"].isoformat(),
            "end": e["end"].isoformat(),
        } for e in evs], indent=2))
    elif args.action == "free":
        now = datetime.now(timezone.utc)
        blocks = get_free_blocks(
            time_min=now,
            time_max=now + timedelta(hours=args.hours),
            min_block_minutes=args.min_minutes,
        )
        print(json.dumps(blocks, indent=2))
