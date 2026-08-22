#!/usr/bin/env python3
"""
Enrich NocoDB facility records with first_name, last_name, and logo_url
using Firecrawl search + scrape.

Usage:
  FIRECRAWL_API_KEY=xxx NOCODB_TOKEN=xxx python3 scripts/enrich-facilities-with-firecrawl.py

Processes facilities in batches with rate limiting.
"""
import json, os, re, subprocess, sys, time, urllib.parse
from urllib.parse import quote

NOCODB_URL = os.getenv("NOCODB_URL", "http://23.95.189.106:8080")
NOCODB_TOKEN = os.getenv("NOCODB_TOKEN", "")
FIRECRAWL_API_KEY = os.getenv("FIRECRAWL_API_KEY", "")

FACILITIES_JSON = "/tmp/ma-facilities.json"
LOG_FILE = "/tmp/enrich-facilities.log"

def log(msg):
    print(msg)
    with open(LOG_FILE, "a") as f:
        f.write(f"{msg}\n")

def noco_request(method, path, data=None):
    import urllib.request
    url = f"{NOCODB_URL}/api/v3/{path}"
    headers = {"xc-token": NOCODB_TOKEN, "Content-Type": "application/json"}
    req = urllib.request.Request(url, method=method, headers=headers)
    if data:
        req.data = json.dumps(data).encode()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        log(f"  NocoDB API error: {e}")
        return None

def firecrawl_search(query):
    """Search via Firecrawl CLI. Returns list of {url, title}."""
    out_path = ".firecrawl/search-tmp.json"
    cmd = ["firecrawl", "search", query, "--limit", "5", "-o", out_path, "--json"]
    env = os.environ.copy()
    env["FIRECRAWL_API_KEY"] = FIRECRAWL_API_KEY
    env["FIRECRAWL_NO_SEARCH_FEEDBACK"] = "1"
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        log(f"  Firecrawl search error: {result.stderr[:200]}")
        return []
    try:
        with open(out_path) as f:
            data = json.load(f)
        return data.get("data", {}).get("web", [])
    except Exception as e:
        log(f"  Firecrawl parse error: {e}")
        return []

def firecrawl_scrape(url):
    """Scrape a URL. Returns {markdown, links, title}."""
    out_path = ".firecrawl/scrape-tmp.json"
    cmd = ["firecrawl", "scrape", url, "--format", "markdown,links", "--wait-for", "3000", "-o", out_path, "--json"]
    env = os.environ.copy()
    env["FIRECRAWL_API_KEY"] = FIRECRAWL_API_KEY
    result = subprocess.run(cmd, capture_output=True, text=True, env=env)
    if result.returncode != 0:
        log(f"  Firecrawl scrape error: {result.stderr[:200]}")
        return None
    try:
        with open(out_path) as f:
            data = json.load(f)
        return {
            "markdown": data.get("markdown", ""),
            "links": data.get("links", []),
            "title": data.get("title", ""),
        }
    except Exception as e:
        log(f"  Firecrawl parse error: {e}")
        return None

def extract_logo_url(scrape_result, base_domain):
    """Extract logo URL from scraped page."""
    if not scrape_result:
        return None
    # Priority 1: look for logo pattern in image URLs
    image_urls = [u for u in scrape_result.get("links", []) 
                  if any(ext in u.lower() for ext in [".png", ".jpg", ".jpeg", ".svg", ".webp"])]
    
    logo_patterns = ["logo", "brand", "emblem", "emailsig", "signature", "header"]
    for url in image_urls:
        lurl = url.lower()
        if any(p in lurl for p in logo_patterns):
            return url
    
    # Priority 2: look for src in markdown images
    md = scrape_result.get("markdown", "")
    img_matches = re.findall(r'!\[.*?\]\((https?://[^\s)]+)\)', md)
    for url in img_matches:
        if any(p in url.lower() for p in logo_patterns):
            return url
    
    # Priority 3: pick the first image that looks like a logo (square-ish, small, from same domain)
    for url in image_urls:
        if base_domain in url and ("icon" in url.lower() or "favicon" in url.lower()):
            return url
    
    return None

def extract_ed_name(scrape_result):
    """Attempt to find Executive Director name from scraped markdown."""
    if not scrape_result:
        return None, None
    md = scrape_result.get("markdown", "")
    
    # Patterns for ED name extraction
    patterns = [
        r'(?:Executive|Administrator|Community|Executive)\s+Director[:\s\n]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)',
        r'(?:Leadership|Our Team|Staff|About Us)[\s\S]{0,500}?([A-Z][a-z]+\s+[A-Z][a-z]+)\s*[-–]\s*Executive Director',
        r'([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+),?\s*Executive Director',
        r'Executive Director\s*[:\n\s]+([A-Z][a-z]+\s+[A-Z][a-z]+)',
    ]
    
    for pat in patterns:
        m = re.search(pat, md, re.IGNORECASE)
        if m:
            return m.group(1).strip(), True
    
    return None, False

def parse_name_from_email(email, facility_name=""):
    """Extract first/last name from email local part with improved heuristics."""
    if not email:
        return "", ""
    local = email.split("@")[0].lower()
    domain = email.split("@")[1].lower() if "@" in email else ""
    
    # Facility-derived suffixes to strip (e.g. wardmtvernon → ward)
    suffixes_to_strip = []
    # Extract facility words from name (lowercased, no spaces)
    if facility_name:
        fclean = re.sub(r'[^a-zA-Z]', '', facility_name).lower()
        # If email ends with facility-derived suffix, strip it
        if local.endswith(fclean) and len(local) > len(fclean):
            possible_name = local[:-len(fclean)]
            if len(possible_name) >= 2:
                return possible_name[0].upper() + possible_name[1:], ""
    
    # Skip generic emails
    generic = ["accounting", "admin", "info", "contact", "support", "office", 
               "marketing", "residence", "mil-ed", "ed", "director", "nurse",
               "administrator", "community"]
    if any(g == local or local.startswith(g + "@") for g in generic):
        return "", ""
    
    # first.last or firstname.lastname (best signal)
    if "." in local and local[0].isalpha():
        parts = local.split(".")
        if len(parts) == 2 and len(parts[0]) >= 1 and len(parts[1]) >= 2:
            return parts[0].capitalize(), parts[1].capitalize()
    
    # firstname_lastname (underscore)
    if "_" in local and local[0].isalpha():
        parts = local.split("_")
        if len(parts) == 2 and len(parts[1]) >= 2:
            return parts[0].capitalize(), parts[1].capitalize()
    
    # janedoe / johnsmith — detect camelCase-ish patterns
    # Look for transition from lowercase to uppercase (unlikely in email)
    # Instead: try splitting at vowel transitions or known name boundaries
    
    # fkelly / mkelly — initial + lastname
    if re.match(r'^[a-z][a-z]+$', local):
        # fkelly → F Kelly
        # Try 1-char initial
        if len(local) >= 3:
            return local[0].upper(), local[1:].capitalize()
    
    # staceymcdaniel — firstname concatenated with lastname
    # Try common first-name+last-name split using vowel patterns
    # This is approximative: split where consonant cluster changes
    m = re.match(r'^([a-z]{2,8})([a-z]{3,})$', local)
    if m:
        first, last = m.group(1), m.group(2)
        # sanity check: avoid splitting a single syllable
        if len(first) >= 2 and len(last) >= 3:
            return first.capitalize(), last.capitalize()
    
    # Default: return local part as-is if it looks like a name (no numbers)
    if local.isalpha() and len(local) >= 3:
        return local.capitalize(), ""
    
    return "", ""

def update_facility(record_id, first_name, last_name, logo_url):
    """Update NocoDB record."""
    fields = {}
    if first_name:
        fields["first_name"] = first_name
    if last_name:
        fields["last_name"] = last_name
    if logo_url:
        fields["logo_url"] = logo_url
    if not fields:
        return True  # nothing to update
    
    resp = noco_request("PATCH", f"data/pfeipqmy5ybhs71/mix4o0ymn0l2nhz/records", 
                       [{"id": record_id, "fields": fields}])
    if resp and "records" in resp:
        log(f"  ✓ Updated NocoDB record {record_id}")
        return True
    else:
        log(f"  ✗ Failed to update NocoDB record {record_id}")
        return False

def process_facility(facility, record_id):
    name = facility["name"]
    city = facility.get("city", "")
    email = facility.get("email", "")
    
    log(f"Processing: {name} ({city}) — {email}")
    
    # Step 1: Search for website
    query = f"{name} {city} MA assisted living official website"
    results = firecrawl_search(query)
    if not results:
        log("  ✗ No search results")
        return False
    
    top_url = results[0]["url"]
    log(f"  Found URL: {top_url}")
    
    # Skip third-party directories if possible
    skip_domains = ["caring.com", "seniorliving.org", "aplaceformom", 
                    "elderlifefinancial", "senioradvisor", "usnews",
                    "health usnews", "facebook.com", "yelp.com",
                    "google.com/maps", "glassdoor"]
    for r in results:
        url = r["url"]
        if not any(d in url.lower() for d in skip_domains):
            top_url = url
            break
    
    log(f"  Using URL: {top_url}")
    
    # Step 2: Scrape the page
    scrape = firecrawl_scrape(top_url)
    
    # Step 3: Extract logo
    domain = urllib.parse.urlparse(top_url).netloc
    logo_url = extract_logo_url(scrape, domain)
    if logo_url:
        log(f"  Found logo: {logo_url}")
    else:
        log("  No logo found")
    
    # Step 4: Extract ED name from website
    ed_name, found_on_site = extract_ed_name(scrape)
    first_name, last_name = "", ""
    
    if ed_name and found_on_site:
        parts = ed_name.split()
        if len(parts) >= 2:
            first_name = parts[0]
            last_name = " ".join(parts[1:])
            log(f"  Found ED name on site: {first_name} {last_name}")
    else:
        # Fallback to email parsing
        first_name, last_name = parse_name_from_email(email, name)
        if first_name:
            log(f"  Parsed from email: {first_name} {last_name}")
        else:
            log("  No name extractable")
    
    # Step 5: Update NocoDB
    update_facility(record_id, first_name, last_name, logo_url)
    return True

def main(max_facilities=0, start_index=0):
    if not NOCODB_TOKEN:
        log("ERROR: NOCODB_TOKEN required")
        sys.exit(1)
    if not FIRECRAWL_API_KEY:
        log("WARNING: FIRECRAWL_API_KEY not set (firecrawl CLI may still work if logged in)")
    
    # Get facilities with record IDs
    facilities = []
    page = 1
    while True:
        resp = noco_request("GET", 
            f"data/pfeipqmy5ybhs71/mix4o0ymn0l2nhz/records?page={page}&pageSize=100"
            f"&fields={quote('Facility,City,ED Email,Phone,ALR Tax Status')}")
        if not resp or not resp.get("records"):
            break
        for rec in resp["records"]:
            f = rec.get("fields", {})
            facilities.append({
                "record_id": rec["id"],
                "name": f.get("Facility", ""),
                "city": f.get("City", ""),
                "email": f.get("ED Email", ""),
                "phone": f.get("Phone", ""),
                "tax_status": f.get("ALR Tax Status", ""),
            })
        if len(resp["records"]) < 100:
            break
        page += 1
    
    log(f"Loaded {len(facilities)} facilities from NocoDB")
    
    if max_facilities > 0:
        facilities = facilities[start_index:start_index + max_facilities]
    
    log(f"Processing {len(facilities)} facilities (start={start_index})")
    
    success = 0
    for i, fac in enumerate(facilities):
        try:
            if process_facility(fac, fac["record_id"]):
                success += 1
        except Exception as e:
            log(f"  ERROR: {e}")
        
        # Rate limit: 2-3 seconds between requests to be respectful
        if i < len(facilities) - 1:
            time.sleep(2.5)
    
    log(f"\nDone. Success: {success}/{len(facilities)}")
    log(f"Log written to {LOG_FILE}")

if __name__ == "__main__":
    max_f = int(sys.argv[1]) if len(sys.argv) > 1 else 0
    start = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    main(max_f, start)
