#!/usr/bin/env python3
"""
Twenty LinkedIn DM Sync

Marks a contact as already-reached-out in Twenty CRM so you don't
double-message them via LinkedIn or other channels.

Usage:
    python3 twenty_linkedin_sync.py \\
        --company "Aidar Health" \\
        --first-name Sathya --last-name Elumalai \\
        --linkedin-url https://www.linkedin.com/in/sathyaelumalai/ \\
        --company-status CONTACTED

Environment:
    TWENTY_BASE_URL  (default http://107.172.94.35:3002)
    TWENTY_API_KEY   (loaded from Infisical if available)
"""
import os
import sys
import json
import argparse
from datetime import datetime, timezone
import urllib.request
import urllib.error

TWENTY_BASE = os.getenv("TWENTY_BASE_URL", "http://107.172.94.35:3002")
TWENTY_KEY = os.getenv("TWENTY_API_KEY", "")

HEADERS = {
    "Authorization": f"Bearer {TWENTY_KEY}",
    "Content-Type": "application/json",
}


def api(method, path, payload=None):
    url = f"{TWENTY_BASE}/{path.lstrip('/')}"
    data = json.dumps(payload).encode() if payload else None
    req = urllib.request.Request(url, data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = resp.read()
            return json.loads(body.decode()) if body else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"[HTTP {e.code}] {err}", file=sys.stderr)
        raise


def list_companies(search_term):
    resp = api("GET", f"/rest/companies?limit=500")
    items = resp.get("data", {}).get("companies", []) if isinstance(resp, dict) else []
    term = search_term.lower()
    return [c for c in items if term in c.get("name", "").lower()]


def create_company(name):
    resp = api("POST", "/rest/companies", {"name": name})
    comp = resp.get("data", {}).get("createCompany") if isinstance(resp, dict) else None
    print(f"[+ Company] {comp['name']} ({comp['id']})")
    return comp


def find_or_create_company(name):
    comps = list_companies(name)
    if comps:
        print(f"[Found Company] {comps[0]['name']} ({comps[0]['id']})")
        return comps[0]
    return create_company(name)


def list_people(company_id, first_name, last_name, linkedin_url):
    resp = api("GET", f"/rest/people?limit=500")
    items = resp.get("data", {}).get("people", []) if isinstance(resp, dict) else []
    linkedin_path = linkedin_url.rstrip('/').lower()
    for p in items:
        if p.get("companyId") != company_id:
            continue
        ln = p.get("linkedinLink", {}).get("primaryLinkUrl", "").rstrip('/').lower()
        fname = p.get("name", {}).get("firstName", "").lower()
        lname = p.get("name", {}).get("lastName", "").lower()
        if ln == linkedin_path or (fname == first_name.lower() and lname == last_name.lower()):
            return p
    return None


def create_person(company_id, first_name, last_name, linkedin_url):
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "name": {"firstName": first_name, "lastName": last_name},
        "companyId": company_id,
        "linkedinLink": {"primaryLinkUrl": linkedin_url, "primaryLinkLabel": "LinkedIn"},
        "lastOutboundAt": now,
        "lastContactAt": now,
    }
    resp = api("POST", "/rest/people", payload)
    person = resp.get("data", {}).get("createPerson") if isinstance(resp, dict) else None
    print(f"[+ Person] {person['name']['firstName']} {person['name']['lastName']} ({person['id']})")
    return person


def update_person(person_id):
    now = datetime.now(timezone.utc).isoformat()
    resp = api("PATCH", f"/rest/people/{person_id}", {
        "lastOutboundAt": now,
        "lastContactAt": now,
    })
    print(f"[Updated Person] lastOutboundAt / lastContactAt set to {now}")
    return resp


def update_company_outreach(company_id, status):
    valid = ["NOT_CONTACTED", "CONTACTED", "POSITIVE_INTERESTED",
             "NEGATIVE_NOT_INTERESTED", "FORWARDED_TO_TECHNICAL_TEAM",
             "NEEDS_HUMAN", "MEETING_BOOKED", "PARTNER_SIGNED"]
    if status not in valid:
        print(f"Invalid status. Choose from: {valid}", file=sys.stderr)
        raise SystemExit(1)
    api("PATCH", f"/rest/companies/{company_id}", {"outreachStatus": status})
    print(f"[Updated Company] outreachStatus → {status}")


def main():
    parser = argparse.ArgumentParser(description="Sync LinkedIn DM history into Twenty CRM")
    parser.add_argument("--company", required=True, help="Company name in Twenty")
    parser.add_argument("--first-name", required=True)
    parser.add_argument("--last-name", required=True)
    parser.add_argument("--linkedin-url", required=True)
    parser.add_argument("--company-status", default="CONTACTED",
                        help="Company outreachStatus (default: CONTACTED)")
    args = parser.parse_args()

    if not TWENTY_KEY:
        print("TWENTY_API_KEY not set. Source /Users/joshdev/.infisical/rendered/.env first.", file=sys.stderr)
        raise SystemExit(1)

    comp = find_or_create_company(args.company)
    update_company_outreach(comp["id"], args.company_status)

    person = list_people(comp["id"], args.first_name, args.last_name, args.linkedin_url)
    if person:
        update_person(person["id"])
    else:
        create_person(comp["id"], args.first_name, args.last_name, args.linkedin_url)

    print("\n✅ Sync complete. Company + person updated in Twenty.")


if __name__ == "__main__":
    main()
