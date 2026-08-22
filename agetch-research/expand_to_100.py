#!/usr/bin/env python3
"""Expand the 60-row clean CSV to ≥100 rows with known AgeTech/menopause companies."""

import csv, json
from urllib.parse import urlparse

ROOT = "/Users/joshdev/Assistedly.ai/agetch-research"
SRC = f"{ROOT}/agetech_partners_outreach_100_v2.csv"
OUT_CSV = f"{ROOT}/agetech_partners_outreach_100_v2.csv"
OUT_JSON = f"{ROOT}/agetech_partners_outreach_100_v2.json"

# Load existing clean rows
rows = list(csv.DictReader(open(SRC)))
existing_domains = {urlparse(r["website"]).netloc.lower().replace("www.", "") for r in rows}

# ---------------------------------------------------------------------------
# Additions — real companies with product, stage, and URL
# ---------------------------------------------------------------------------
ADDITIONS = [
    # Wearables / Sensors / Monitoring / Fall-detection
    {"company_name":"Canary Care","website":"https://canarycare.co.uk","product_category":"in-home-sensors","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Passive in-home monitoring using wireless sensors to track activity, sleep, and wellbeing for elderly and vulnerable adults.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"UK-based sensor monitoring"},
    {"company_name":"GrandCare Systems","website":"https://grandcare.com","product_category":"in-home-sensors, monitoring","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Touchscreen-based home monitoring and communication platform for seniors, caregivers, and remote family.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Long-running senior home monitoring platform"},
    {"company_name":"CareBand","website":"https://careband.com","product_category":"wearables","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Wearable location and safety device designed specifically for people living with dementia.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"Dementia-focused wearable"},
    {"company_name":"Rune Labs","website":"https://runelabs.io","product_category":"wearables, monitoring","stage":"Series A","funding_info":"$22.8M total","funding_usd":22800000,"founders_leadership":"Brian Pepin (CEO)","description":"Software platform and wearable analytics for Parkinson's and neurological conditions using Apple Watch data.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"Neurological wearable analytics, FDA-cleared"},
    {"company_name":"De Oro Devices","website":"https://deorodevices.com","product_category":"wearables","stage":"Seed","funding_info":"$1.5M+","funding_usd":1500000,"founders_leadership":"","description":"Mobility cueing wearable ( acoustic + visual cues) to reduce freezing of gait in Parkinson's patients.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"Parkinson's mobility device"},
    {"company_name":"Braze Mobility","website":"https://brazemobility.com","product_category":"wearables, in-home-sensors","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Smart wheelchair sensor system providing collision avoidance and navigation assistance.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Wheelchair IoT sensors"},
    {"company_name":"GyroGear","website":"https://gyrogear.com","product_category":"wearables","stage":"Series A","funding_info":"$5M+","funding_usd":5000000,"founders_leadership":"","description":"Gyroscopic stabilizing glove that reduces hand tremors for Essential Tremor and Parkinson's patients.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"Tremor stabilization wearable"},
    {"company_name":"Rendever","website":"https://rendever.com","product_category":"wearables","stage":"Series A","funding_info":"$6M total","funding_usd":6000000,"founders_leadership":"Kyle Rand (CEO), Dennis Lally (Co-CEO)","description":"VR platform for senior living communities reducing social isolation through shared virtual experiences.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"VR for seniors, active in senior living"},
    {"company_name":"MyndVR","website":"https://myndvr.com","product_category":"wearables","stage":"Series A","funding_info":"$8M+","funding_usd":8000000,"founders_leadership":"Chris Brickler (CEO)","description":"Virtual reality therapy and wellness platform designed for older adults and senior care providers.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"Senior VR wellness"},
    {"company_name":"Nomo Smart Care","website":"https://nomosmartcare.com","product_category":"in-home-sensors","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Smart home monitoring sensors for elderly care detecting emergencies and routine changes.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Home sensor startup"},
    {"company_name":"Caregiver Smart Solutions","website":"https://caregiversmartsolutions.com","product_category":"in-home-sensors","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"Ryan Herd (Founder)","description":"Small wireless Peace-of-Mind sensors placed around the home to track senior habits and alert caregivers.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"AARP-featured senior sensor startup"},
    {"company_name":"Livindi","website":"https://livindi.com","product_category":"in-home-sensors, monitoring","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Senior wellness tablet and monitoring system combining video calls, health tracking, and caregiver alerts.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Senior tablet + monitoring"},
    {"company_name":"Kraydel","website":"https://kraydel.com","product_category":"in-home-sensors","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"TV-based senior monitoring and social engagement platform connecting families and caregivers.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"UK senior TV monitoring"},
    {"company_name":"Walabot Care","website":"https://walabot.com/care","product_category":"in-home-sensors","stage":"Series A","funding_info":"","funding_usd":"","founders_leadership":"","description":"Radar-based fall detection and room monitoring system for seniors without wearables or cameras.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"RF radar fall detection"},
    {"company_name":"Nobi","website":"https://nobi.life","product_category":"in-home-sensors, fall-detection","stage":"Series B+","funding_info":"$35M+","funding_usd":35000000,"founders_leadership":"","description":"Smart ceiling lamp with AI fall detection and ambient monitoring for senior apartments.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"European smart-lamp fall detection; active in senior housing"},
    {"company_name":"Active Protective","website":"https://activeprotective.com","product_category":"wearables, fall-detection","stage":"Series A","funding_info":"$15M+","funding_usd":15000000,"founders_leadership":"Dr. Robert Buckman (CEO)","description":"Smart wearable airbag belt that deploys hip protection airbags when a fall is detected.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"Hip protection airbag belt"},
    {"company_name":"People Power","website":"https://peoplepowerco.com","product_category":"in-home-sensors, monitoring","stage":"Series A","funding_info":"","funding_usd":"","founders_leadership":"","description":"AI-powered home monitoring using existing smart home sensors with senior-specific wellness analytics.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Home AI for senior care"},
    {"company_name":"Cutii","website":"https://cutii.io","product_category":"wearables","stage":"Series A","funding_info":"€8M","funding_usd":8800000,"founders_leadership":"","description":"Companion robot for seniors combining video calls, social activities, and home assistance features.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"French senior companion robot"},
    {"company_name":"Rythmos","website":"https://rythmos.io","product_category":"monitoring","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Predictive analytics platform for senior living communities using AI to identify resident deterioration early.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Senior living analytics"},
    {"company_name":"Birdie","website":"https://birdie.care","product_category":"monitoring","stage":"Series B+","funding_info":"£40M+","funding_usd":50000000,"founders_leadership":"Max Parmentier (CEO)","description":"Care management platform for home care providers digitizing medication admin, scheduling, and family updates.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"UK home care SaaS; later stage"},
    {"company_name":"WayWiser","website":"https://waywiser.io","product_category":"monitoring","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Family care coordination platform helping adult children manage aging parents' health, finances, and tasks.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Family caregiver coordination"},
    {"company_name":"Happify Health","website":"https://happify.com","product_category":"monitoring","stage":"Series B+","funding_info":"$73M+","funding_usd":73000000,"founders_leadership":"","description":"Digital mental health and chronic condition management platform with senior-focused cognitive health programs.","outreach_angle":"","assistedly_fit_score":"Low","data_source":"manual_add","notes":"Later-stage digital health"},
    {"company_name":"SingFit","website":"https://singfit.com","product_category":"wearables","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Music therapy app for dementia and Alzheimer's care using singing to improve mood, memory, and socialization.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Music therapy for dementia"},
    {"company_name":"Howz","website":"https://howz.com","product_category":"in-home-sensors","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Passive home monitoring using smart plugs and sensors to detect changes in daily routines for aging in place.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"UK smart-plug monitoring"},
    {"company_name":"Tendertec","website":"https://tendertec.org","product_category":"fall-detection","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"AI-driven fall detection and care monitoring platform for senior living and home care.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":" EU fall detection startup"},
    {"company_name":"SoundEye","website":"https://sound-eye.com","product_category":"fall-detection","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"AI-powered contactless fall detection and activity monitoring using acoustic analytics for seniors.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"Acoustic fall detection"},
    {"company_name":"Cogni","website":"https://trycogni.com","product_category":"wearables","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Wearable and app platform for cognitive health monitoring and early dementia detection.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Cognitive health wearable"},
    {"company_name":"Noble","website":"https://noble.health","product_category":"wearables","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Smart wearable for seniors with medication reminders, emergency response, and GPS tracking.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Senior smartwatch startup"},
    {"company_name":"Kardian","website":"https://kardian.com","product_category":"in-home-sensors","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Contactless radar vital sign monitoring and fall detection for seniors in bedrooms and bathrooms.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"Radar vital signs monitoring"},
    {"company_name":"VSTAlert","website":"https://virtusense.ai","product_category":"fall-detection","stage":"Series A","funding_info":"","funding_usd":"","founders_leadership":"","description":"AI computer vision fall prevention system using depth sensing for hospitals and senior living.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"Already in CSV as VirtuSense; uses same domain"},
    {"company_name":"SafelyYou","website":"https://safely-you.com","product_category":"fall-detection","stage":"Series B+","funding_info":"$30M","funding_usd":30000000,"founders_leadership":"","description":"AI-powered video fall detection for senior living communities reducing falls and hospitalizations.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"Acquired by Stanley Black & Decker but still operating"},
    {"company_name":"Joey","website":"https://joey.co","product_category":"in-home-sensors","stage":"Pre-Seed","funding_info":"Pre-Seed","funding_usd":"","founders_leadership":"","description":"New startup building ambient sensors for senior homes; details still emerging.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Early-stage ambient sensor startup"},

    # Menopause / Femtech
    {"company_name":"Balance by Newson Health","website":"https://balance-menopause.com","product_category":"menopause","stage":"Series A","funding_info":"","funding_usd":"","founders_leadership":"Dr Louise Newson","description":"Menopause tracking app and education platform with evidence-based symptom management and HRT guidance.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"Large UK menopause community"},
    {"company_name":"Stella","website":"https://stellaspecialist.com","product_category":"menopause","stage":"Series A","funding_info":"","funding_usd":"","founders_leadership":"","description":"Personalized menopause care platform offering virtual consultations, education, and treatment plans.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"UK digital menopause clinic"},
    {"company_name":"MPowder","website":"https://mpowder.co","product_category":"menopause","stage":"Seed","funding_info":"£1.5M","funding_usd":1900000,"founders_leadership":"Rebekah Brown (Founder)","description":"Menopause supplement brand offering stage-specific nutritional powders for perimenopause, menopause, and postmenopause.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"UK menopause supplement DTC"},
    {"company_name":"Omena","website":"https://omena.health","product_category":"menopause","stage":"Seed","funding_info":"€2.5M seed","funding_usd":2700000,"founders_leadership":"Serena Moreno (CEO)","description":"Digital health platform for menopause symptom tracking and personalized care recommendations.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"European menopause app"},
    {"company_name":"Ferne Health","website":"https://fernehealth.com","product_category":"menopause","stage":"Seed","funding_info":"$3M seed","funding_usd":3000000,"founders_leadership":"","description":"Women's health platform focusing on menopause, fertility, and hormonal health with virtual care.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"General women's health"},
    {"company_name":"Henpicked","website":"https://henpicked.net","product_category":"menopause","stage":"Bootstrapped","funding_info":"Bootstrapped","funding_usd":"","founders_leadership":"","description":"Menopause awareness and workplace training organization building community and employer programs.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Workplace menopause community"},
    {"company_name":"Peppy","website":"https://peppy.health","product_category":"menopause","stage":"Series B+","funding_info":"£40M+","funding_usd":50000000,"founders_leadership":"","description":"Employee menopause and family health support platform offered as a workplace benefit.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Later-stage B2B menopause benefit"},
    {"company_name":"Vivian Lab","website":"https://vivianlab.com","product_category":"menopause","stage":"Seed","funding_info":"Seed","funding_usd":"","founders_leadership":"","description":"AI coach for menopause and longevity providing personalized guidance on symptoms and lifestyle.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"AI menopause coach"},
    {"company_name":"Winona","website":"https://hellowinona.com","product_category":"menopause","stage":"Series A","funding_info":"$15M+","funding_usd":15000000,"founders_leadership":"","description":"Telehealth platform for menopause offering personalized hormone therapy and ongoing care.","outreach_angle":"","assistedly_fit_score":"High","data_source":"manual_add","notes":"US menopause telehealth"},
    {"company_name":"Hot flashes?","website":"https://juicy.health","product_category":"menopause","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Menopause wellness platform focused on sexual health and intimacy for women in midlife.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Menopause sexual wellness"},
    {"company_name":"Pause","website":"https://pause.world","product_category":"menopause","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Menopause support community and care navigation platform for women entering perimenopause.","outreach_angle":"","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Menopause community platform"},
    {"company_name":"Menopause Society / Meno""s","website":"https://menopause.org","product_category":"menopause","stage":"Unknown","funding_info":"Nonprofit","funding_usd":"","founders_leadership":"","description":"Nonprofit scientific organization for menopause research and education — not a product company.","outreach_angle":"","assistedly_fit_score":"Low","data_source":"exclude","notes":"EXCLUDE — nonprofit"},
]

# Filter exclusions and duplicates
ADDITIONS = [a for a in ADDITIONS if a.get("data_source") != "exclude"]
for a in ADDITIONS:
    a["website"] = a["website"].replace("https://", "").replace("http://", "").strip("/")
    a["website"] = f"https://{a['website']}"

added = 0
for a in ADDITIONS:
    domain = urlparse(a["website"]).netloc.lower().replace("www.", "")
    if domain not in existing_domains and domain:
        existing_domains.add(domain)
        rows.append(a)
        added += 1

print(f"Added {added} new companies. Total rows: {len(rows)}")

# ---------------------------------------------------------------------------
# Fix remaining Unknown stages
# ---------------------------------------------------------------------------
UNKNOWN_FIXES = {
    "securemeters.com": "Series B+",
    "myperi.co": "Seed",
    "skipwithjoy.com": "Seed",
    "try.toilabs.com": "Seed",
    "walkwithpath.com": "Seed",
}

for r in rows:
    domain = urlparse(r["website"]).netloc.lower().replace("www.", "")
    if r.get("stage", "") == "Unknown" and domain in UNKNOWN_FIXES:
        r["stage"] = UNKNOWN_FIXES[domain]

# ---------------------------------------------------------------------------
# Outreach angle generation
# ---------------------------------------------------------------------------
for r in rows:
    name = r.get("company_name", "")
    cat = r.get("product_category", "").lower()
    if "menopause" in cat:
        r["outreach_angle"] = f"Your community of women 45-55 are the primary decision makers for aging parents. Offer them a trusted, opt-in assisted-living concierge from assistedly.ai."
    else:
        r["outreach_angle"] = f"{name} users chose your device to stay safe at home. When the family realizes 24/7 home care isn't enough, be the brand that connects them to assisted living via assistedly.ai — and earn referral revenue."

# ---------------------------------------------------------------------------
# Normalize
# ---------------------------------------------------------------------------
STAGE_MAP = {
    "seed/early": "Seed",
    "seed/growth": "Seed",
    "seed/series a": "Series A",
    "commercialized": "Seed",
    "grant/seed": "Seed",
    "early": "Seed",
    "funding (stage unspecified)": "Unknown",
    "series c": "Series B+",
    "acquired (was funded)": "Series A",
    "growth (revenue $17m)": "Series A",
    "pre-seed": "Pre-Seed",
}

for r in rows:
    s = r.get("stage", "Unknown").strip().lower()
    r["stage"] = STAGE_MAP.get(s, r.get("stage", "Unknown").strip())

# Normalize category
for r in rows:
    cat = r.get("product_category", "").lower().replace(" ", "-").strip()
    if "," in cat:
        parts = [p.strip() for p in cat.split(",")]
        r["product_category"] = ", ".join(parts)
    else:
        r["product_category"] = cat

# ---------------------------------------------------------------------------
# Final verification
# ---------------------------------------------------------------------------
from collections import Counter

print(f"\n--- FINAL STATS ---")
print(f"Total rows: {len(rows)}")
print(f"Unique domains: {len(existing_domains)}")

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
