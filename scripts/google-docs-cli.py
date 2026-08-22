#!/usr/bin/env python3
"""
Unified Google Docs CLI for Assistely.ai
Uses Service Account auth via Infisical (no browser needed).

Usage:
  # List recent docs
  infisical run --token "$TOKEN" --env dev -- python3 scripts/google-docs-cli.py list

  # Read a doc
  infisical run --token "$TOKEN" --env dev -- python3 scripts/google-docs-cli.py read <DOC_ID>

  # Create a new doc with content from stdin or --title
  infisical run --token "$TOKEN" --env dev -- python3 scripts/google-docs-cli.py create --title "My Doc" --content "Hello World"

  # Append content to existing doc
  infisical run --token "$TOKEN" --env dev -- python3 scripts/google-docs-cli.py append <DOC_ID> --content "New section"

  # Append heading + paragraphs
  infisical run --token "$TOKEN" --env dev -- python3 scripts/google-docs-cli.py append <DOC_ID> --heading "Week of 8/11" --lines "Bullet 1" "Bullet 2"
"""

import argparse
import json
import os
import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

def get_credentials(scopes):
    """Load Service Account credentials from Infisical env var."""
    sa_json = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")
    if not sa_json:
        print("ERROR: GOOGLE_SERVICE_ACCOUNT_JSON env var not set.", file=sys.stderr)
        print("Run this script through Infisical:", file=sys.stderr)
        print("  infisical run --token \"$(cat ~/.infisical/machine-identity/service-token)\" --env dev -- python3 scripts/google-docs-cli.py ...", file=sys.stderr)
        sys.exit(1)
    info = json.loads(sa_json)
    return service_account.Credentials.from_service_account_info(info, scopes=scopes)


def get_drive_service():
    creds = get_credentials(["https://www.googleapis.com/auth/drive"])
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def get_docs_service():
    creds = get_credentials(["https://www.googleapis.com/auth/documents"])
    return build("docs", "v1", credentials=creds, cache_discovery=False)


# ---------------------------------------------------------------------------
# Drive helpers
# ---------------------------------------------------------------------------

def get_doc_metadata(drive, doc_id):
    try:
        return drive.files().get(fileId=doc_id, fields="name,modifiedTime,webViewLink,mimeType").execute()
    except HttpError as e:
        print(f"ERROR: Could not access file: {e}", file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def render_runs(elements):
    """Render textRun elements into a single string."""
    texts = []
    for pe in elements:
        tr = pe.get("textRun", {})
        text = tr.get("content", "")
        ts = tr.get("textStyle", {})
        if ts.get("bold"):
            text = f"**{text}**"
        if ts.get("italic"):
            text = f"*{text}*"
        texts.append(text)
    return "".join(texts).rstrip()


def render_paragraph(para):
    """Render a single paragraph element into a string."""
    style = para.get("paragraphStyle", {})
    named = style.get("namedStyleType", "")
    prefix = ""
    if named.startswith("HEADING_"):
        level = int(named.replace("HEADING_", ""))
        prefix = "#" * level + " "
    text = render_runs(para.get("elements", []))
    if text.strip():
        return prefix + text
    return None


def extract_text(content):
    """Convert Google Docs structural content to plain markdown-ish text."""
    lines = []

    for elem in content:
        if "table" in elem:
            lines.append("[TABLE]")
            for row in elem["table"].get("tableRows", []):
                row_texts = []
                for cell in row.get("tableCells", []):
                    cell_lines = extract_text(cell.get("content", []))
                    row_texts.append(" | ".join(cell_lines))
                lines.append("  " + " | ".join(row_texts))
            lines.append("[END TABLE]")
            continue

        para = elem.get("paragraph")
        if not para:
            continue

        line = render_paragraph(para)
        if line:
            lines.append(line)

    return lines


def get_document_end_index(doc):
    """Return the index just before the final newline (safe insertion point)."""
    body = doc.get("body", {})
    content = body.get("content", [])
    if not content:
        return 1
    last_detail = content[-1]
    return last_detail.get("endIndex", 1) - 1


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def cmd_list(args):
    drive = get_drive_service()
    q = (
        "(mimeType='application/vnd.google-apps.document' or "
        "mimeType='application/vnd.google-apps.spreadsheet' or "
        "mimeType='application/vnd.google-apps.presentation') "
        "and trashed=false"
    )
    results = (
        drive.files()
        .list(pageSize=args.limit, fields="files(id, name, mimeType, modifiedTime, webViewLink)", q=q, orderBy="modifiedTime desc")
        .execute()
    )
    files = results.get("files", [])
    if not files:
        print("No recent Docs/Sheets/Slides found.")
        return

    print(f"\n{'#':<4} {'Name':<45} {'Type':<10} {'Modified':<20} {'Link'}")
    print("-" * 120)
    for i, f in enumerate(files, 1):
        mime = f["mimeType"].split(".")[-1].capitalize()
        if "spreadsheet" in f["mimeType"]:
            mime = "Sheet"
        elif "presentation" in f["mimeType"]:
            mime = "Slide"
        else:
            mime = "Doc"
        modified = f["modifiedTime"].replace("T", " ").split(".")[0]
        name = f["name"][:43]
        print(f"{i:<4} {name:<45} {mime:<10} {modified:<20} {f.get('webViewLink', '')}")
    print()


def cmd_read(args):
    docs = get_docs_service()
    drive = get_drive_service()

    meta = get_doc_metadata(drive, args.doc_id)
    print(f"Title: {meta['name']}")
    print(f"Modified: {meta['modifiedTime']}")
    print(f"Link: {meta['webViewLink']}")
    print("\n" + "=" * 60 + "\n")

    doc = docs.documents().get(documentId=args.doc_id).execute()
    body = doc.get("body", {})
    content = body.get("content", [])
    lines = extract_text(content)

    print("\n".join(lines))
    print()


def cmd_create(args):
    docs = get_docs_service()

    doc = docs.documents().create(body={"title": args.title}).execute()
    doc_id = doc["documentId"]
    print(f"Created: {doc_id}")
    print(f"Link: https://docs.google.com/document/d/{doc_id}/edit")

    # Insert content if provided
    if args.content or args.heading or args.lines:
        requests = build_content_requests(args, end_index=1)
        if requests:
            docs.documents().batchUpdate(documentId=doc_id, body={"requests": requests}).execute()
            print("Content inserted.")
    print()


def cmd_append(args):
    docs = get_docs_service()

    # Get current end index
    doc = docs.documents().get(documentId=args.doc_id).execute()
    end_index = get_document_end_index(doc)

    requests = build_content_requests(args, end_index=end_index)
    if not requests:
        print("ERROR: Nothing to append. Provide --content, --heading, or --lines", file=sys.stderr)
        sys.exit(1)

    docs.documents().batchUpdate(documentId=args.doc_id, body={"requests": requests}).execute()
    print("Appended successfully.")


def build_content_requests(args, end_index):
    """Build Google Docs batchUpdate requests from CLI args."""
    requests = []
    index = end_index

    def insert_text(text):
        nonlocal index
        requests.append({
            "insertText": {
                "location": {"index": index},
                "text": text
            }
        })
        index += len(text)

    # Insert heading first
    if args.heading:
        insert_text(f"\n\n{args.heading}\n\n")

    # Insert --lines as bullet paragraphs
    if args.lines:
        for line in args.lines:
            insert_text(f"• {line}\n")

    # Insert raw --content last
    if args.content:
        insert_text(f"\n{args.content}\n")

    return requests


# ---------------------------------------------------------------------------
# CLI setup
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Google Docs CLI via Service Account (Infisical-authenticated).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # List 10 recent docs
  infisical run --env dev -- python3 scripts/google-docs-cli.py list

  # Read a doc
  infisical run --env dev -- python3 scripts/google-docs-cli.py read ABC123xyz

  # Create doc with heading + bullets
  infisical run --env dev -- python3 scripts/google-docs-cli.py create \
    --title "Weekly Update" --heading "Platform" --lines "Shipped feature A" "Shipped feature B"

  # Append to existing doc
  infisical run --env dev -- python3 scripts/google-docs-cli.py append ABC123xyz \
    --heading "Week of 8/11" --lines "Cut AI fees 60%" "Launched passwordless login"
        """.strip()
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # list
    p_list = sub.add_parser("list", help="List recent Docs/Sheets/Slides")
    p_list.add_argument("--limit", type=int, default=10, help="Number of results (default: 10)")
    p_list.set_defaults(func=cmd_list)

    # read
    p_read = sub.add_parser("read", help="Read a Google Doc by ID")
    p_read.add_argument("doc_id", help="Google Doc document ID")
    p_read.set_defaults(func=cmd_read)

    # create
    p_create = sub.add_parser("create", help="Create a new Google Doc")
    p_create.add_argument("--title", required=True, help="Document title")
    p_create.add_argument("--content", help="Raw text content to insert")
    p_create.add_argument("--heading", help="Heading to insert")
    p_create.add_argument("--lines", nargs="+", help="Bullet lines to insert")
    p_create.set_defaults(func=cmd_create)

    # append
    p_append = sub.add_parser("append", help="Append content to an existing Google Doc")
    p_append.add_argument("doc_id", help="Google Doc document ID")
    p_append.add_argument("--content", help="Raw text content to append")
    p_append.add_argument("--heading", help="Heading to append")
    p_append.add_argument("--lines", nargs="+", help="Bullet lines to append")
    p_append.set_defaults(func=cmd_append)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
