#!/usr/bin/env python3
"""
list-recent-google-docs.py
==========================
Lists the 10 most recently modified Google Docs / Sheets / Slides.

Authenticates via Service Account (GOOGLE_SERVICE_ACCOUNT_JSON env var)
which requires NO browser OAuth or redirect URIs.

Usage via Infisical (preferred):
    cd /Users/joshdev/Assistedly.ai
    infisical run --projectId e9cab1b7-b17c-4502-bc30-64ae61c21e63 --env dev \
        -- python3 scripts/list-recent-google-docs.py

Usage via rendered .env wrapper:
    bash scripts/run-with-infisical.sh python3 scripts/list-recent-google-docs.py
"""

import json
import os
import sys
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# ── Configuration ──────────────────────────────────────────────────────
# Prefer Service Account (no browser auth needed)
SA_JSON = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
CLIENT_ID = os.getenv("8-10-26OauthClient_ID")
CLIENT_SECRET = os.getenv("8-10-26OAuthSecret")

SCOPES = [
    "https://www.googleapis.com/auth/drive.readonly",
    "https://www.googleapis.com/auth/documents.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
]


def get_service_account_credentials():
    if not SA_JSON:
        return None
    info = json.loads(SA_JSON)
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)
    return creds


def get_user_oauth_credentials():
    """Fallback: interactive OAuth via local server (requires redirect URI match)."""
    from google.auth.transport.requests import Request
    from google_auth_oauthlib.flow import InstalledAppFlow
    import pickle
    from pathlib import Path
    TOKEN_PATH = Path.home() / ".config" / "goose" / "gworkspace_oauth_token.pickle"

    if not CLIENT_ID or not CLIENT_SECRET:
        return None

    creds = None
    if TOKEN_PATH.exists():
        with open(TOKEN_PATH, "rb") as token:
            creds = pickle.load(token)

    if creds and creds.expired and creds.refresh_token:
        creds.refresh(Request())
    else:
        print("Opening browser for Google OAuth …")
        print("(If you get redirect_uri_mismatch, add http://localhost:8085 to the app in Google Cloud Console)")
        client_config = {
            "installed": {
                "client_id": CLIENT_ID,
                "client_secret": CLIENT_SECRET,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
                "redirect_uris": ["http://localhost:8085"],
            }
        }
        flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
        creds = flow.run_local_server(port=8085, prompt="consent")
        TOKEN_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(TOKEN_PATH, "wb") as token:
            pickle.dump(creds, token)
    return creds


def main():
    print("Attempting Service Account authentication (no browser required) …")
    creds = get_service_account_credentials()
    if creds:
        print("✅ Authenticated via Service Account.")
    elif CLIENT_ID and CLIENT_SECRET:
        print("Service Account not found. Falling back to OAuth …")
        creds = get_user_oauth_credentials()
        if creds:
            print("✅ Authenticated via OAuth.")
    else:
        print("ERROR: No Google credentials found.")
        print("Set either GOOGLE_SERVICE_ACCOUNT_JSON or 8-10-26OauthClient_ID + 8-10-26OAuthSecret.")
        sys.exit(1)

    print("\nFetching 10 most recent Google Docs / Sheets / Slides …\n")
    try:
        service = build("drive", "v3", credentials=creds, cache_discovery=False)
        results = (
            service.files()
            .list(
                pageSize=10,
                fields="files(id, name, mimeType, modifiedTime, webViewLink)",
                q="(mimeType='application/vnd.google-apps.document' or "
                  "mimeType='application/vnd.google-apps.spreadsheet' or "
                  "mimeType='application/vnd.google-apps.presentation') "
                  "and trashed=false",
                orderBy="modifiedTime desc",
            )
            .execute()
        )
        files = results.get("files", [])

        if not files:
            print("No recent Google Docs / Sheets / Slides found.")
            print("If using a Service Account, ensure it has been shared on specific Drive files/folders.")
            return

        print(f"{'#':<3} {'Name':<45} {'Type':<10} {'Modified':<22} {'Link'}")
        print("-" * 118)
        for idx, f in enumerate(files, 1):
            mt = f["mimeType"].replace("application/vnd.google-apps.", "")
            mt = {"document": "Doc", "spreadsheet": "Sheet", "presentation": "Slide"}.get(mt, mt)
            mod = f["modifiedTime"][:19].replace("T", " ")
            name = f"{f['name'][:42]}…" if len(f["name"]) > 45 else f["name"]
            link = f.get("webViewLink", "")
            print(f"{idx:<3} {name:<45} {mt:<10} {mod:<22} {link}")

        print(f"\n📋 Tip: Copy any Doc ID and ask Goose:")
        print(f"        'Summarise Google Doc <id>'")

    except HttpError as e:
        print(f"API error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
