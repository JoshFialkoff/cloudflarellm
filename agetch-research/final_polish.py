#!/usr/bin/env python3
"""Final polish: fix URLs, dedup, normalize categories, output."""

import csv, json
from urllib.parse import urlparse
from collections import Counter

ROOT = "/Users/joshdev/Assistedly.ai/agetch-research"
SRC = f"{ROOT}/agetech_partners_outreach_100_v2.csv"
OUT_CSV = f"{ROOT}/agetech_partners_outreach_100_v2.csv"
OUT_JSON = f"{ROOT}/agetech_partners_outreach_100_v2.json"

rows = list(csv.DictReader(open(SRC)))

# Fix bad URLs
FIXES = {
    "juicy.health": {"website": "https://juicymenopause.co.uk", "company_name": "Juicy Menopause"},
    "mpowder.co": {"website": "https://mpowder.store", "company_name": "MPowder"},
    "hellowinona.com": {"website": "https://bywinona.com", "company_name": "Winona"},
    "fernehealth.com": {"website": "https://fernehealth.com", "company_name": "Ferne Health"},
    "pause.world": {"website": "https://thepause.ai", "company_name": "ThePause"},
}

DROP_DOMAINS = {"fernehealth.com"}  # confirmed 404, drop
DROP_SECOND_PAUSE = False

for r in rows:
    domain = urlparse(r["website"]).netloc.lower().replace("www.", "")
    if domain in FIXES:
        for k, v in FIXES[domain].items():
            r[k] = v

# Remove duplicates by domain after URL fixes
seen = set()
unique_rows = []
for r in rows:
    domain = urlparse(r["website"]).netloc.lower().replace("www.", "")
    if domain in DROP_DOMAINS:
        continue
    if domain not in seen:
        seen.add(domain)
        unique_rows.append(r)

rows = unique_rows
print(f"After URL fixes + dedup: {len(rows)} rows")

# If we're now below 100, add replacements
if len(rows) < 100:
    replacements = [
        {"company_name":"HealthBeats","website":"https://healthbeats.com","product_category":"monitoring","stage":"Series A","funding_info":"","funding_usd":"","founders_leadership":"","description":"Remote patient monitoring platform with FDA-cleared devices for chronic disease management at home.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"RPM platform for seniors"},
        {"company_name":"Carallel","website":"https://carallel.com","product_category":"monitoring","stage":"Series A","funding_info":"","funding_usd":"","founders_leadership":"","description":"Digital health platform supporting family caregivers with personalized guidance, resources, and expert coaching.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Caregiver support platform"},
    ]
    for r in replacements:
        domain = urlparse(r["website"]).netloc.lower().replace("www.", "")
        if domain not in seen:
            seen.add(domain)
            rows.append(r)

# Normalize categories cleanly
for r in rows:
    cat = r.get("product_category", "").lower().strip()
    # Remove leading hyphens and clean up
    cat = cat.lstrip("-").strip()
    # Handle commas
    if "," in cat:
        parts = [p.strip().lstrip("-").strip() for p in cat.split(",")]
        parts = [p for p in parts if p]
        r["product_category"] = ", ".join(parts)
    else:
        r["product_category"] = cat

# Outreach angle generation
for r in rows:
    name = r.get("company_name", "")
    cat = r.get("product_category", "").lower()
    if "menopause" in cat:
        r["outreach_angle"] = f"Your community of women 45-55 are the primary decision makers for aging parents. Offer them a trusted, opt-in assisted-living concierge from assistedly.ai."
    else:
        r["outreach_angle"] = f"{name} users chose your device to stay safe at home. When the family realizes 24/7 home care isn't enough, be the brand that connects them to assisted living via assistedly.ai — and earn referral revenue."

# Stats
print(f"\n--- FINAL STATS ---")
print(f"Total rows: {len(rows)}")

stage_counts = Counter(r["stage"] for r in rows)
print(f"\nStages:")
for s, c in stage_counts.most_common():
    print(f"  {s}: {c}")

cat_counts = Counter()
for r in rows:
    for part in r.get("product_category", "").split(","):
        cat_counts[part.strip()] += 1
print(f"\nCategories:")
for c, n in cat_counts.most_common():
    print(f"  {c}: {n}")

seeda = [r for r in rows if r["stage"] in ("Seed", "Series A")]
meno = [r for r in rows if "menopause" in r.get("product_category", "")]
hw = [r for r in rows if any(x in r.get("product_category", "") for x in ("wearables", "in-home-sensors", "monitoring", "fall-detection"))]
print(f"\nSeed+Series A: {len(seeda)}")
print(f"Menopause: {len(meno)}")
print(f"Hardware/monitoring: {len(hw)}")

FIELDNAMES = [
    "company_name", "website", "product_category", "stage", "funding_info",
    "funding_usd", "founders_leadership", "head_of_business_dev_or_partnerships",
    "description", "outreach_angle", "assistedly_fit_score", "data_source", "notes"
]

with open(OUT_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
    writer.writeheader()
    for r in rows:
        writer.writerow({k: r.get(k, "") for k in FIELDNAMES})

with open(OUT_JSON, "w", encoding="utf-8") as f:
    json.dump(rows, f, indent=2)

print(f"\nWrote {OUT_CSV}")
print(f"Wrote {OUT_JSON}")
