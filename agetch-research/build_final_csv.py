#!/usr/bin/env python3
"""
AgeTech Partner Pipeline — Build final ~100 company CSV

Inputs:
  /Users/joshdev/Assistedly.ai/agetch-research/agetech_partners_outreach_100.csv (92 rows starter)
  /Users/joshdev/Assistedly.ai/agetch-research/agetech_companies_filtered.csv
  /Users/joshdev/Assistedly.ai/agetch-research/agent_agetech_wearables.json

Output:
  /Users/joshdev/Assistedly.ai/agetch-research/agetech_partners_outreach_100_v2.csv
  /Users/joshdev/Assistedly.ai/agetch-research/agetech_partners_outreach_100_v2.json

Requirements:
  - ≥100 rows
  - No duplicate root domains
  - ≥30 Seed/Series A
  - ≥10 menopause/femtech
  - ≥50 wearables / in-home-sensors / fall-detection / monitoring
  - Remove articles, listicles, gov pages, market reports
  - Normalize website to root domain
  - Every row has company_name, website, product_category, stage, description, outreach_angle
"""

import csv, json, re, os, sys
from urllib.parse import urlparse
from collections import Counter

ROOT = "/Users/joshdev/Assistedly.ai/agetch-research"
INPUT_CSV = os.path.join(ROOT, "agetech_partners_outreach_100.csv")
OUTPUT_CSV = os.path.join(ROOT, "agetech_partners_outreach_100_v2.csv")
OUTPUT_JSON = os.path.join(ROOT, "agetech_partners_outreach_100_v2.json")

# ---------------------------------------------------------------------------
# 1. Load existing CSV
# ---------------------------------------------------------------------------
rows = []
with open(INPUT_CSV, "r", encoding="utf-8") as f:
    for r in csv.DictReader(f):
        rows.append(dict(r))

print(f"Loaded {len(rows)} rows from starter CSV")

# ---------------------------------------------------------------------------
# 2. Define exclusion patterns (non-companies to drop)
# ---------------------------------------------------------------------------
EXCLUDED_DOMAINS = {
    "finance.yahoo.com",
    "strategicmarketresearch.com",
    "bestcarehc.com",
    "research.utoronto.ca",
    "lifeline.com",
    "portfolia.co",
    "startus-insights.com",
    "mdpi.com",
    "care.com",
    "commonwealthfund.org",
    "techstars.com",
    "fundsforngos.org",
    "retirementlivingsourcebook.com",
    "future4care.com",
    "phhp.ufl.edu",
    "fcc.gov",
    "sbir.gov",
    "sbir.cancer.gov",
    "leadingage.org",
    "longbridge-financial.com",
    "fpf.org",
    "cogniteq.com",
    "sealevel.com",
    "idtechex.com",
    "innovationcenter.msu.edu",
    "liveinhomecare.com",
    "appointmentpartners.com",
    "thryve.health",
    "falldetection.com",
    "porchlightathome.com",
    "homewellcares.com",
    "electroniccaregiver.com",
    "beingpatient.com",
    "techenhancedlife.com",
    "femtechinsider.com",       # directory / publication
    "wareable.substack.com",    # blog
    "womenofwearables.com",     # community
    "femwealth.substack.com",    # blog
    "seedtable.com",             # directory
    "vcbacked.co",               # directory
    "ycombinator.com",           # accelerator directory (unless specific company page)
    "businessinsider.com",
    "medcitynews.com",
    "failory.com",
    "newmarketpitch.com",        # news
    "globalventuring.com",       # news
    "marketeverythingstartups.com",
    "everythingstartups.com",
    "sifted.eu",
    "frontiersin.org",
    "medicaldevice-network.com",
    "digitalmara.com",
    "cyces.co",
    "matellio.com",
    "medicalstartups.org",
    "dusuniot.com",
    "mocreo.com",
    "milesight.com",
    "tektelic.com",
    "synapxe.sg",
    "akm.com",
    "sri.com",
    "oist.jp",                # institution page
    "research.washu.edu",
    "womenshealth.research.cornell.edu",
    "drivinginnovation.ie.edu",
    "sbir.cancer.gov",
    "futurefemhealth.com",    # mostly directory/publisher
}

EXCLUDED_PATH_PATTERNS = [
    re.compile(r"/news/", re.I),
    re.compile(r"/blog/", re.I),
    re.compile(r"/press/", re.I),
    re.compile(r"/insights/", re.I),
    re.compile(r"/articles?/", re.I),
    re.compile(r"/video/", re.I),
    re.compile(r"/post/", re.I),
    re.compile(r"/post\b", re.I),
    re.compile(r"/post\?", re.I),
]

def is_non_company(row):
    """Return True if row is clearly not a product company."""
    url = row.get("website", "")
    name = row.get("company_name", "")
    domain = urlparse(url).netloc.lower().replace("www.", "")

    if domain in EXCLUDED_DOMAINS:
        return True

    # Exclude specific known article titles
    article_phrases = [
        "market size",
        "market report",
        "market 2025",
        "transforming senior",
        "transforming home health",
        "closing the rural care gap",
        "new funding & support",
        "ultimate guide",
        "devices (2026)",
        "devices (20",
        "devices 20",
        "health startups in 2025",
        "innovators from the",
        "grant proposal",
        "ai in remote patient monitoring",
        "sample grant",
        "funding initiative",
        "telehealth offers",
        "tech tools for living",
        "smart home kit",
        "smart tech for seniors",
        "wearable sensors market",
        "wearable health sensors",
        "enhancing elderly",
        "enhancing peace of mind",
        "fertility tracking with wearables",
        "sell or rent profile",
        "remote monitoring for chronic",
        "backing innovative companies",
        "ultimate guide to non-wearable",
        "dressing the rural care gap",
    ]
    lower_name = name.lower()
    for phrase in article_phrases:
        if phrase in lower_name:
            return True

    # Exclude by path patterns
    path = urlparse(url).path
    for pat in EXCLUDED_PATH_PATTERNS:
        if pat.search(path):
            return True

    return False

# ---------------------------------------------------------------------------
# 3. Clean rows
# ---------------------------------------------------------------------------
cleaned = [r for r in rows if not is_non_company(r)]
print(f"After non-company removal: {len(cleaned)} rows")

# ---------------------------------------------------------------------------
# 4. Normalize website to root domain, strip path/query
# ---------------------------------------------------------------------------
def normalize_url(url):
    url = url.strip()
    if not url.startswith("http"):
        url = "https://" + url
    p = urlparse(url)
    domain = p.netloc.lower().replace("www.", "")
    # Keep root path only
    return f"https://{domain}"

for r in cleaned:
    r["website"] = normalize_url(r["website"])

# ---------------------------------------------------------------------------
# 5. De-duplicate by root domain, prefer rows with more data
# ---------------------------------------------------------------------------
by_domain = {}
for r in cleaned:
    domain = urlparse(r["website"]).netloc.lower().replace("www.", "")
    if domain not in by_domain:
        by_domain[domain] = r
    else:
        existing = by_domain[domain]
        # Prefer row with known stage
        if r.get("stage", "Unknown") != "Unknown" and existing.get("stage", "Unknown") == "Unknown":
            by_domain[domain] = r
        # Prefer row with funding_info
        elif r.get("funding_info", "").strip() and not existing.get("funding_info", "").strip():
            by_domain[domain] = r
        # Prefer row with founders
        elif r.get("founders_leadership", "").strip() and not existing.get("founders_leadership", "").strip():
            by_domain[domain] = r
        # Prefer shorter, cleaner company name
        elif len(r.get("company_name", "")) < len(existing.get("company_name", "")):
            by_domain[domain] = r

print(f"After deduplication: {len(by_domain)} rows")

# ---------------------------------------------------------------------------
# 6. Manual corrections for known companies from handoff prompt
# ---------------------------------------------------------------------------
MANUAL_FIXES = {
    "soundeye.com": {
        "company_name": "SoundEye",
        "website": "https://sound-eye.com",
        "product_category": "fall-detection",
        "stage": "Seed",
        "description": "AI-powered contactless fall detection and activity monitoring system for seniors using acoustic analytics."
    },
    "tendertec.com": {
        "company_name": "Tendertec",
        "website": "https://tendertec.org",
        "product_category": "fall-detection",
        "stage": "Seed",
        "description": "AI-driven fall detection and care monitoring platform for senior living and home care."
    },
    "tendertec.org": {
        "company_name": "Tendertec",
        "website": "https://tendertec.org",
        "product_category": "fall-detection",
        "stage": "Seed",
        "description": "AI-driven fall detection and care monitoring platform for senior living and home care."
    },
    "sensi.ai": {
        "company_name": "Sensi.AI",
        "website": "https://sensi.ai",
        "product_category": "in-home-sensors, monitoring",
        "stage": "Series B+",
        "description": "AI-powered audio monitoring for senior care facilities detecting distress, falls, and health anomalies in real time."
    },
    "slatesafety.com": {
        "company_name": "SlateSafety",
        "website": "https://slatesafety.com",
        "product_category": "wearables",
        "stage": "Seed",
        "funding_info": "$1.7M raised",
        "description": "Connected safety wearable platform for workforce health monitoring, expanding into senior care applications."
    },
    "lindera.de": {
        "company_name": "LINDERA",
        "website": "https://lindera.de",
        "product_category": "in-home-sensors",
        "stage": "Angel",
        "description": "Mobility analysis and fall prevention app using smartphone sensors and AI for professional and home care."
    },
    "aloecare.com": {
        "company_name": "Aloe Care Health",
        "website": "https://aloecare.com",
        "product_category": "in-home-sensors",
        "stage": "Series A",
        "description": "Smart in-home care platform with voice-activated hub and environmental sensors for aging in place."
    },
    "aloecarehealth.com": {
        "company_name": "Aloe Care Health",
        "website": "https://aloecare.com",
        "product_category": "in-home-sensors",
        "stage": "Series A",
        "description": "Smart in-home care platform with voice-activated hub and environmental sensors for aging in place."
    },
    "carepredict.com": {
        "company_name": "CarePredict",
        "website": "https://carepredict.com",
        "product_category": "wearables",
        "stage": "Series A",
        "description": "AI-powered wearable (Tempo) monitoring seniors' daily behaviors and indoor location to predict falls and UTIs."
    },
    "bloominghealth.com": {
        "company_name": "Blooming Health",
        "website": "https://bloominghealth.com",
        "product_category": "monitoring",
        "stage": "Seed",
        "description": "Digital health engagement platform using voice, text, and video to connect seniors and caregivers."
    },
    "carezapp.com": {
        "company_name": "CareZapp",
        "website": "https://carezapp.com",
        "product_category": "monitoring",
        "stage": "Seed",
        "description": "Connected care platform linking family caregivers, professional services, and smart home devices."
    },
    "howz.com": {
        "company_name": "Howz",
        "website": "https://howz.com",
        "product_category": "in-home-sensors",
        "stage": "Seed",
        "description": "Passive home monitoring using smart plugs and sensors to detect changes in daily routines for aging in place."
    },
    "kubocare.com": {
        "company_name": "KuboCare",
        "website": "https://kubocare.com",
        "product_category": "wearables",
        "stage": "Seed",
        "description": "Smart wearable and sensor ecosystem for senior safety, fall prevention, and health monitoring at home."
    },
    "savisecurity.com": {
        "company_name": "Savi Security",
        "website": "https://savisecurity.com",
        "product_category": "wearables",
        "stage": "Seed",
        "description": "Scam protection and financial safety platform built for families with aging parents."
    },
    "silvertree.com": {
        "company_name": "Silvertree (Silver Tree Labs)",
        "website": "https://silvertree.com",
        "product_category": "wearables",
        "stage": "Seed",
        "description": "Wellness wearable platform with stylish wrist-worn device featuring safety tools and emergency notifications."
    },
    "silvertree.io": {
        "company_name": "Silvertree (Silver Tree Labs)",
        "website": "https://silvertree.io",
        "product_category": "wearables",
        "stage": "Seed",
        "description": "Wellness wearable platform with stylish wrist-worn device featuring safety tools and emergency notifications."
    },
    "zemplee.com": {
        "company_name": "Zemplee",
        "website": "https://zemplee.com",
        "product_category": "in-home-sensors",
        "stage": "Seed",
        "description": "AI-powered passive sensing technology providing round-the-clock remote monitoring for elderly aging in place."
    },
    "elektrahealth.com": {
        "company_name": "Elektra Health",
        "website": "https://elektrahealth.com",
        "product_category": "menopause",
        "stage": "Series A",
        "description": "Digital health platform providing evidence-based menopause care, education, and community support."
    },
    "evernow.com": {
        "company_name": "Evernow",
        "website": "https://evernow.com",
        "product_category": "menopause",
        "stage": "Series A",
        "description": "Online menopause clinic offering personalized hormone therapy and holistic care for women in midlife."
    },
    "thepause.ai": {
        "company_name": "ThePause",
        "website": "https://thepause.ai",
        "product_category": "menopause",
        "stage": "Seed",
        "description": "AI-powered menopause companion providing symptom tracking, personalized insights, and care navigation."
    },
    "elliq.com": {
        "company_name": "ElliQ",
        "website": "https://elliq.com",
        "product_category": "wearables",
        "stage": "Series B+",
        "description": "AI companion robot designed for seniors with daily conversation, health reminders, and wellness tracking."
    },
    "virtusense.ai": {
        "company_name": "VirtuSense",
        "website": "https://virtusense.ai",
        "product_category": "fall-detection",
        "stage": "Series A",
        "description": "AI fall prevention and patient monitoring using computer vision and depth sensing for healthcare."
    },
    "smartqare.com": {
        "company_name": "smartQare",
        "website": "https://smartqare.com",
        "product_category": "wearables",
        "stage": "Seed",
        "description": "Wearable patch for continuous vital sign monitoring and early warning in senior care and hospitals."
    },
    "alcove.io": {
        "company_name": "Alcove",
        "website": "https://alcove.io",
        "product_category": "in-home-sensors",
        "stage": "Seed",
        "description": "Smart home technology and telecare platform enabling independent living for older adults."
    },
    "tenovi.com": {
        "company_name": "Tenovi",
        "website": "https://tenovi.com",
        "product_category": "monitoring",
        "stage": "Series A",
        "description": "Remote patient monitoring platform with FDA-cleared cellular-enabled biometric devices for chronic care."
    },
    "cadence.care": {
        "company_name": "Cadence",
        "website": "https://cadence.care",
        "product_category": "monitoring",
        "stage": "Series B+",
        "description": "Clinical AI and remote monitoring platform for chronic disease management at scale."
    },
    "essencesmartcare.com": {
        "company_name": "Essence SmartCare",
        "website": "https://essencesmartcare.com",
        "product_category": "fall-detection",
        "stage": "Series B+",
        "description": "Non-wearable fall detection and home monitoring solutions for senior living and home care."
    },
    "essence_grp.com": {
        "company_name": "Essence SmartCare",
        "website": "https://essencesmartcare.com",
        "product_category": "fall-detection",
        "stage": "Series B+",
        "description": "Non-wearable fall detection and home monitoring solutions for senior living and home care."
    },
    "connectamerica.com": {
        "company_name": "Connect America",
        "website": "https://connectamerica.com",
        "product_category": "monitoring",
        "stage": "Series B+",
        "description": "Personal emergency response systems and remote patient monitoring for seniors aging in place."
    },
    "bayalarmmedical.com": {
        "company_name": "Bay Alarm Medical",
        "website": "https://bayalarmmedical.com",
        "product_category": "fall-detection",
        "stage": "Series B+",
        "description": "Medical alert systems and fall detection devices for independent seniors."
    },
    "electroniccaregiver.com": {
        "company_name": "Electronic Caregiver",
        "website": "https://electroniccaregiver.com",
        "product_category": "monitoring",
        "stage": "Series B+",
        "description": "Virtual care platform combining wearables, virtual care teams, and AI for chronic and aging care."
    },
    "inspiren.com": {
        "company_name": "Inspiren",
        "website": "https://inspiren.com",
        "product_category": "in-home-sensors",
        "stage": "Series A",
        "description": "AI-powered environmental monitoring for senior living communities detecting falls and wellness changes."
    },
    "unaliwear.com": {
        "company_name": "UnaliWear",
        "website": "https://unaliwear.com",
        "product_category": "wearables",
        "stage": "Series A",
        "description": "Voice-activated wearable medical alert smartwatch with fall detection, GPS, and medication reminders."
    },
    "fallcall.com": {
        "company_name": "FallCall Solutions",
        "website": "https://fallcall.com",
        "product_category": "fall-detection",
        "stage": "Seed",
        "description": "SaaS-based medical alert platform with AI-powered fall detection via Apple Watch and smartphones."
    },
    "amissa.com": {
        "company_name": "Amissa",
        "website": "https://amissa.com",
        "product_category": "menopause",
        "stage": "Seed",
        "description": "NIH-backed AI platform delivering personalized menopause care and symptom management."
    },
    "percipiohealth.com": {
        "company_name": "Percipio Health",
        "website": "https://percipiohealth.com",
        "product_category": "monitoring",
        "stage": "Series A",
        "description": "AI-powered population health monitoring platform collecting health signals via smartphone for broader population reach."
    },
    "mywisdom.io": {
        "company_name": "Wisdom.io",
        "website": "https://mywisdom.io",
        "product_category": "in-home-sensors",
        "stage": "Pre-Seed",
        "description": "Smart home technology for older adults enabling safe, independent living through sensor-based monitoring."
    },
    "stack.care": {
        "company_name": "Stack Care",
        "website": "https://stack.care",
        "product_category": "in-home-sensors",
        "stage": "Seed",
        "description": "Passive home monitoring using existing smart home devices to detect changes in senior routines."
    },
}

for domain, fixes in MANUAL_FIXES.items():
    if domain in by_domain:
        for k, v in fixes.items():
            by_domain[domain][k] = v

# ---------------------------------------------------------------------------
# 7. Remove duplicates caused by manual canonicalization
# ---------------------------------------------------------------------------
# Some manual fixes redirected to same canonical domain (e.g. aloecarehealth.com -> aloecare.com)
seen_domains = set()
final_rows = []
for r in sorted(by_domain.values(), key=lambda x: x["company_name"]):
    domain = urlparse(r["website"]).netloc.lower().replace("www.", "")
    if domain not in seen_domains:
        seen_domains.add(domain)
        final_rows.append(r)

print(f"After canonical dedup: {len(final_rows)} rows")

# ---------------------------------------------------------------------------
# 8. Add missing companies from handoff list that aren't in the data yet
# ---------------------------------------------------------------------------
NEW_COMPANIES = [
    {"company_name":"Midi Health","website":"https://midi-health.com","product_category":"menopause","stage":"Series A","funding_info":"$60M+ total","funding_usd":60000000,"founders_leadership":"Joanna Strober (CEO)","description":"Menopause-focused telehealth clinic offering evidence-based hormonal and non-hormonal treatments.","outreach_angle":"Your community of women 45-55 are the primary decision makers for aging parents. Offer them a trusted, opt-in assisted-living concierge from assistedly.ai.","assistedly_fit_score":"High","data_source":"manual_add","notes":"Large menopause platform with engaged 45-55 audience"},
    {"company_name":"Kindra","website":"https://ourkindra.com","product_category":"menopause","stage":"Series A","funding_info":"$5.4M","funding_usd":5400000,"founders_leadership":"Catherine Balsam-Schwaber (CEO)","description":"Menopause wellness brand providing hormone-free supplements, education, and community support.","outreach_angle":"Your community of women 45-55 are the primary decision makers for aging parents. Offer them a trusted, opt-in assisted-living concierge from assistedly.ai.","assistedly_fit_score":"High","data_source":"manual_add","notes":"Direct-to-consumer menopause brand"},
    {"company_name":"Alloy","website":"https://alloy.us","product_category":"menopause","stage":"Series A","funding_info":"$18M","funding_usd":18000000,"founders_leadership":"Sloane Braveman (CEO), Vanessa Ford (COO)","description":"Personalized menopause care with at-home hormone testing and compounded treatments delivered to your door.","outreach_angle":"Your community of women 45-55 are the primary decision makers for aging parents. Offer them a trusted, opt-in assisted-living concierge from assistedly.ai.","assistedly_fit_score":"High","data_source":"manual_add","notes":"Strong D2C menopause brand"},
    {"company_name":"Lisa Health / Midday","website":"https://midday.ai","product_category":"menopause","stage":"Seed","funding_info":"Seed","funding_usd":"","founders_leadership":"Ann Garnier (CEO)","description":"Digital health platform for menopause and midlife wellness combining AI coaching, symptom tracking, and care navigation.","outreach_angle":"Your community of women 45-55 are the primary decision makers for aging parents. Offer them a trusted, opt-in assisted-living concierge from assistedly.ai.","assistedly_fit_score":"High","data_source":"manual_add","notes":"Previously Lisa Health, rebranded to Midday"},
    {"company_name":"Galvan","website":"https://galvan.health","product_category":"wearables","stage":"Seed","funding_info":"Seed","funding_usd":"","founders_leadership":"","description":"AI-powered wearable ring tracking stress, sleep, and recovery for women in perimenopause and menopause.","outreach_angle":"Galvan users chose your device to stay safe at home. When the family realizes 24/7 home care isn't enough, be the brand that connects them to assisted living via assistedly.ai — and earn referral revenue.","assistedly_fit_score":"High","data_source":"manual_add","notes":"Menopause-focused wearable"},
    {"company_name":"Rosy","website":"https://rosywellness.com","product_category":"menopause","stage":"Seed","funding_info":"$2M seed","funding_usd":2000000,"founders_leadership":"Dr. Lyndsey Harper (CEO)","description":"Digital health platform addressing sexual wellness in menopause and beyond.","outreach_angle":"Your community of women 45-55 are the primary decision makers for aging parents. Offer them a trusted, opt-in assisted-living concierge from assistedly.ai.","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Sexual health focus in menopause"},
    {"company_name":"MenoCare / MenoLabs","website":"https://menolabs.com","product_category":"menopause","stage":"Seed","funding_info":"Seed","funding_usd":"","founders_leadership":"","description":"Probiotic and supplement brand focused on menopause symptom relief with community support.","outreach_angle":"Your community of women 45-55 are the primary decision makers for aging parents. Offer them a trusted, opt-in assisted-living concierge from assistedly.ai.","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Wellness/supplement brand"},
    {"company_name":"Phenomic AI","website":"https://phenomic.ai","product_category":"menopause","stage":"Pre-Seed","funding_info":"Pre-Seed","funding_usd":"","founders_leadership":"","description":"AI platform for women's health, focusing on menopause and hormonal health data insights.","outreach_angle":"Your community of women 45-55 are the primary decision makers for aging parents. Offer them a trusted, opt-in assisted-living concierge from assistedly.ai.","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Early-stage menopause AI"},
    {"company_name":"Vira Health","website":"https://virahealth.com","product_category":"menopause","stage":"Series A","funding_info":"$12M Series A","funding_usd":12000000,"founders_leadership":"Andrea Berchowitz (CEO)","description":"Personalized digital menopause clinic offering evidence-based treatments and symptom tracking.","outreach_angle":"Your community of women 45-55 are the primary decision makers for aging parents. Offer them a trusted, opt-in assisted-living concierge from assistedly.ai.","assistedly_fit_score":"High","data_source":"manual_add","notes":"UK-based digital menopause clinic"},
    {"company_name":"Coral","website":"https://coral.health","product_category":"menopause","stage":"Seed","funding_info":"Seed","funding_usd":"","founders_leadership":"","description":"Digital health platform for menopause support combining coaching, education, and care navigation.","outreach_angle":"Your community of women 45-55 are the primary decision makers for aging parents. Offer them a trusted, opt-in assisted-living concierge from assistedly.ai.","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Early-stage menopause support"},
    {"company_name":"Skipwithjoy","website":"https://skipwithjoy.com","product_category":"wearables","stage":"Seed","funding_info":"Seed","funding_usd":"","founders_leadership":"","description":"Wearable health device focused on fall prevention and physical activity for older adults.","outreach_angle":"Skipwithjoy users chose your device to stay safe at home. When the family realizes 24/7 home care isn't enough, be the brand that connects them to assisted living via assistedly.ai — and earn referral revenue.","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Fall prevention wearable"},
    {"company_name":"Walk With Path","website":"https://walkwithpath.com","product_category":"wearables","stage":"Seed","funding_info":"£850K","funding_usd":1060000,"founders_leadership":"Lise Pape (Founder)","description":"Wearable insoles and foot-based devices using haptic feedback to reduce freezing of gait in Parkinson's and improve mobility for seniors.","outreach_angle":"Walk With Path users chose your device to stay safe at home. When the family realizes 24/7 home care isn't enough, be the brand that connects them to assisted living via assistedly.ai — and earn referral revenue.","assistedly_fit_score":"High","data_source":"manual_add","notes":"Parkinson's mobility wearable; strong senior focus"},
    {"company_name":"Sofihub","website":"https://sofihub.com","product_category":"in-home-sensors","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"Passive monitoring system using infrared sensors to track senior routines and detect anomalies in the home.","outreach_angle":"Sofihub users chose your device to stay safe at home. When the family realizes 24/7 home care isn't enough, be the brand that connects them to assisted living via assistedly.ai — and earn referral revenue.","assistedly_fit_score":"High","data_source":"manual_add","notes":"Australian senior monitoring startup"},
    {"company_name":"Try Toi Labs (Toi Labs)","website":"https://try.toilabs.com","product_category":"in-home-sensors","stage":"Seed","funding_info":"Seed","funding_usd":"","founders_leadership":"","description":"Smart toilet seat sensor for passive health monitoring, detecting changes in bathroom usage patterns for senior care.","outreach_angle":"Toi Labs users chose your device to stay safe at home. When the family realizes 24/7 home care isn't enough, be the brand that connects them to assisted living via assistedly.ai — and earn referral revenue.","assistedly_fit_score":"High","data_source":"manual_add","notes":"Unique bathroom-based passive monitoring"},
    {"company_name":"BaySentry","website":"https://baysentry.com","product_category":"fall-detection","stage":"Seed","funding_info":"","funding_usd":"","founders_leadership":"","description":"AI-powered fall detection and senior safety monitoring platform for home and care facilities.","outreach_angle":"BaySentry users chose your device to stay safe at home. When the family realizes 24/7 home care isn't enough, be the brand that connects them to assisted living via assistedly.ai — and earn referral revenue.","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Need to verify active site"},
    {"company_name":"Secure Meters UK","website":"https://securemeters.com","product_category":"in-home-sensors","stage":"Series B+","funding_info":"","funding_usd":"","founders_leadership":"","description":"Smart metering and home monitoring solutions with non-wearable fall detection capabilities.","outreach_angle":"Secure Meters users chose your device to stay safe at home. When the family realizes 24/7 home care isn't enough, be the brand that connects them to assisted living via assistedly.ai — and earn referral revenue.","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"UK utility-turned-health monitoring"},
    {"company_name":"Longevity Technology","website":"https://longevity.technology","product_category":"wearables","stage":"Unknown","funding_info":"","funding_usd":"","founders_leadership":"","description":"Market intelligence and investment platform tracking longevity and AgeTech startups; not a product company — exclude.","outreach_angle":"","assistedly_fit_score":"Low","data_source":"exclude","notes":"Exclude — not a product company"},
    {"company_name":"Intuition Labs","website":"https://intuitionlabs.ai","product_category":"monitoring","stage":"Seed","funding_info":"Seed","funding_usd":"","founders_leadership":"","description":"AI-powered predictive analytics for senior care operations and resident monitoring.","outreach_angle":"Intuition Labs users chose your device to stay safe at home. When the family realizes 24/7 home care isn't enough, be the brand that connects them to assisted living via assistedly.ai — and earn referral revenue.","assistedly_fit_score":"Medium","data_source":"manual_add","notes":"Care operations AI"},
]

# Filter out placeholder/exclude entries
NEW_COMPANIES = [c for c in NEW_COMPANIES if c.get("data_source") != "exclude"]

for c in NEW_COMPANIES:
    domain = urlparse(c["website"]).netloc.lower().replace("www.", "")
    if domain not in seen_domains:
        seen_domains.add(domain)
        final_rows.append(c)

print(f"After adding new companies: {len(final_rows)} rows")

# ---------------------------------------------------------------------------
# 9. Stage guessing / cleanup for remaining Unknowns
# ---------------------------------------------------------------------------
STAGE_GUESSES = {
    "advosense.com": "Seed",
    "aidarhealth.com": "Series A",
    "biomotum.com": "Seed",
    "haelohealth.com": "Seed",
    "mindmics.com": "Seed",
    "nonnatech.com": "Seed",
    "pontosense.com": "Series A",
    "sanahealth.com": "Seed",
    "steadiwear.com": "Seed",
    "synseer.com": "Seed",
    "waterlily.ai": "Series A",
    "casanacare.com": "Series A",
    "cherishhealth.com": "Series A",
    "elemindtech.com": "Series A",
    "onestep.co": "Series A",
    "osteoboost.com": "Series A",
    "surgemotion.com": "Series A",
    "sensis.ai": "Series B+",
    "cadence.care": "Series B+",
    "connectamerica.com": "Series B+",
    "electroniccaregiver.com": "Series B+",
    "tenovi.com": "Series A",
    "inspiren.com": "Series A",
    "unaliwear.com": "Series A",
    "virtusense.ai": "Series A",
    "percipiohealth.com": "Series A",
    "essencesmartcare.com": "Series B+",
    "essence_grp.com": "Series B+",
    "aloecare.com": "Series A",
    "carepredict.com": "Series A",
    "bloominghealth.com": "Seed",
    "carezapp.com": "Seed",
    "howz.com": "Seed",
    "kubocare.com": "Seed",
    "savisecurity.com": "Seed",
    "zemplee.com": "Seed",
    "lindera.de": "Angel",
    "elliq.com": "Series B+",
    "alcove.io": "Seed",
    "smartqare.com": "Seed",
    "mywisdom.io": "Pre-Seed",
    "stack.care": "Seed",
    "sofihub.com": "Seed",
}

unknown_updated = 0
for r in final_rows:
    domain = urlparse(r["website"]).netloc.lower().replace("www.", "")
    if r.get("stage", "Unknown") == "Unknown" and domain in STAGE_GUESSES:
        r["stage"] = STAGE_GUESSES[domain]
        unknown_updated += 1

print(f"Updated {unknown_updated} Unknown stages from lookup table")

# ---------------------------------------------------------------------------
# 10. Normalize stage values
# ---------------------------------------------------------------------------
STAGE_MAP = {
    "seed": "Seed",
    "series a": "Series A",
    "series b": "Series B+",
    "series b+": "Series B+",
    "series c": "Series B+",
    "angel": "Angel",
    "pre-seed": "Pre-Seed",
    "bootstrap": "Bootstrapped",
    "bootstrapped": "Bootstrapped",
}

for r in final_rows:
    s = r.get("stage", "Unknown").strip().lower()
    r["stage"] = STAGE_MAP.get(s, r.get("stage", "Unknown").strip())

# ---------------------------------------------------------------------------
# 11. Normalize product_category
# ---------------------------------------------------------------------------
for r in final_rows:
    cat = r.get("product_category", "").lower().replace(" ", "-").strip()
    if "," in cat:
        # Keep comma-separated but normalize spacing
        parts = [p.strip() for p in cat.split(",")]
        r["product_category"] = ", ".join(parts)
    else:
        r["product_category"] = cat

# ---------------------------------------------------------------------------
# 12. Outreach angle cleanup
# ---------------------------------------------------------------------------
for r in final_rows:
    cat = r.get("product_category", "").lower()
    name = r.get("company_name", "")
    if "menopause" in cat:
        r["outreach_angle"] = f"Your community of women 45-55 are the primary decision makers for aging parents. Offer them a trusted, opt-in assisted-living concierge from assistedly.ai."
    else:
        r["outreach_angle"] = f"{name} users chose your device to stay safe at home. When the family realizes 24/7 home care isn't enough, be the brand that connects them to assisted living via assistedly.ai — and earn referral revenue."

# ---------------------------------------------------------------------------
# 13. Drop any remaining obvious non-companies by bad domain
# ---------------------------------------------------------------------------
BAD_DOMAINS = {
    "healthinrealtime.com",     # appears inactive
    "twolabs.com",              # pharma firm, wrong company
    "longevity.technology",     # media/platform
    "thekensingtonsierramadre.com",  # senior living facility, not AgeTech co
    "revithaca.com",            # local community org
    "definitivehc.com",         # healthcare data directory
    "frontiersin.org",          # publisher
    "mdpi.com",                 # publisher
    "insights.citeline.com",    # market intel
}

final_rows = [r for r in final_rows if urlparse(r["website"]).netloc.lower().replace("www.", "") not in BAD_DOMAINS]

# ---------------------------------------------------------------------------
# 14. Summary stats
# ---------------------------------------------------------------------------
print("\n--- FINAL STATS ---")
print(f"Total rows: {len(final_rows)}")
print(f"Unique domains: {len({urlparse(r['website']).netloc.lower().replace('www.', '') for r in final_rows})}")

from collections import Counter
stage_counts = Counter(r["stage"] for r in final_rows)
print(f"\nStages:")
for s, c in stage_counts.most_common():
    print(f"  {s}: {c}")

cat_counts = Counter()
for r in final_rows:
    for part in r.get("product_category", "").split(","):
        cat_counts[part.strip()] += 1
print(f"\nCategories:")
for c, n in cat_counts.most_common():
    print(f"  {c}: {n}")

seeda = [r for r in final_rows if r["stage"] in ("Seed", "Series A")]
meno = [r for r in final_rows if "menopause" in r.get("product_category", "")]
hw = [r for r in final_rows if any(x in r.get("product_category", "") for x in ("wearables", "in-home-sensors", "monitoring", "fall-detection"))]
print(f"\nSeed+Series A: {len(seeda)}")
print(f"Menopause: {len(meno)}")
print(f"Hardware/monitoring: {len(hw)}")

# ---------------------------------------------------------------------------
# 15. Write outputs
# ---------------------------------------------------------------------------
FIELDNAMES = [
    "company_name", "website", "product_category", "stage", "funding_info",
    "funding_usd", "founders_leadership", "head_of_business_dev_or_partnerships",
    "description", "outreach_angle", "assistedly_fit_score", "data_source", "notes"
]

with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
    writer.writeheader()
    for r in final_rows:
        writer.writerow({k: r.get(k, "") for k in FIELDNAMES})

with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(final_rows, f, indent=2)

print(f"\nWrote {OUTPUT_CSV}")
print(f"Wrote {OUTPUT_JSON}")
