#!/usr/bin/env python3
"""
Import MA facilities from NocoDB into Listmonk subscribers,
create a campaign template, and prepare the campaign for sending.

Usage:
  python3 scripts/import-facilities-to-listmonk.py
"""
import json, os, re, sys, urllib.parse, urllib.request

NOCODB_URL = os.getenv("NOCODB_URL", "http://23.95.189.106:8080")
NOCODB_TOKEN = os.getenv("NOCODB_TOKEN", "")
LISTMONK_DB_HOST = os.getenv("LISTMONK_DB_HOST", "107.174.44.66")
LISTMONK_LIST_ID = int(os.getenv("LISTMONK_LIST_ID", "3"))

def log(msg):
    print(msg)

def noco_get(path):
    url = f"{NOCODB_URL}/api/v3/{path}"
    req = urllib.request.Request(url, headers={"xc-token": NOCODB_TOKEN})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        log(f"  NocoDB GET error: {e}")
        return None

def noco_patch(path, data):
    url = f"{NOCODB_URL}/api/v3/{path}"
    req = urllib.request.Request(url, method="PATCH", headers={
        "xc-token": NOCODB_TOKEN,
        "Content-Type": "application/json",
    })
    req.data = json.dumps(data).encode()
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except Exception as e:
        log(f"  NocoDB PATCH error: {e}")
        return None

def slugify(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

def build_demo_url(name, city, logo_url=""):
    slug = slugify(name)
    params = {
        "facility": slug,
        "name": name,
        "city": city or "Massachusetts",
    }
    if logo_url:
        params["logo"] = logo_url
    return "https://assistedly.ai/facility-insights-preview?" + urllib.parse.urlencode(params)

def get_all_facilities():
    facilities = []
    page = 1
    while True:
        resp = noco_get(
            f"data/pfeipqmy5ybhs71/mix4o0ymn0l2nhz/records"
            f"?page={page}&pageSize=100"
            f"&fields={urllib.parse.quote('Facility,City,ED Email,first_name,last_name,logo_url,Phone')}")
        if not resp or not resp.get("records"):
            break
        for rec in resp["records"]:
            f = rec.get("fields", {})
            facilities.append({
                "noco_id": rec["id"],
                "name": f.get("Facility", ""),
                "city": f.get("City", ""),
                "email": f.get("ED Email", ""),
                "first_name": f.get("first_name", ""),
                "last_name": f.get("last_name", ""),
                "logo_url": f.get("logo_url", ""),
                "phone": f.get("Phone", ""),
            })
        if len(resp["records"]) < 100:
            break
        page += 1
    return facilities

def update_listmonk_subscribers(facilities):
    import psycopg2
    conn = psycopg2.connect(
        host=LISTMONK_DB_HOST,
        port=5432,
        user="listmonk",
        password="listmonk",
        database="listmonk"
    )
    cur = conn.cursor()
    
    imported = 0
    skipped = 0
    
    for fac in facilities:
        email = fac["email"]
        if not email or "@" not in email:
            skipped += 1
            continue
        
        first = fac["first_name"]
        last = fac["last_name"]
        full_name = f"{first} {last}".strip() or fac["name"]
        
        attribs = {
            "facility_name": fac["name"],
            "facility_city": fac["city"],
            "facility_slug": slugify(fac["name"]),
            "facility_logo": fac["logo_url"] or "",
            "facility_phone": fac["phone"] or "",
            "first_name": first,
            "last_name": last,
            "demo_url": build_demo_url(fac["name"], fac["city"], fac["logo_url"]),
        }
        
        # Upsert subscriber
        cur.execute("""
            INSERT INTO subscribers (uuid, email, name, attribs, status, created_at, updated_at)
            VALUES (gen_random_uuid(), %s, %s, %s, 'enabled', NOW(), NOW())
            ON CONFLICT (lower(email)) DO UPDATE SET
                name = EXCLUDED.name,
                attribs = EXCLUDED.attribs,
                updated_at = NOW()
            RETURNING id
        """, (email, full_name, json.dumps(attribs)))
        
        sub_id = cur.fetchone()[0]
        
        # Link to list
        cur.execute("""
            INSERT INTO subscriber_lists (subscriber_id, list_id, status, created_at, updated_at)
            VALUES (%s, %s, 'confirmed', NOW(), NOW())
            ON CONFLICT DO NOTHING
        """, (sub_id, LISTMONK_LIST_ID))
        
        imported += 1
        if imported % 50 == 0:
            log(f"  Imported {imported}...")
    
    conn.commit()
    cur.close()
    conn.close()
    log(f"Done. Imported {imported}, skipped {skipped}.")
    return imported

def create_campaign_template():
    import psycopg2
    conn = psycopg2.connect(
        host=LISTMONK_DB_HOST,
        port=5432,
        user="listmonk",
        password="listmonk",
        database="listmonk"
    )
    cur = conn.cursor()
    
    template_name = "Facility Insights Demo"
    template_body = '''<![CDATA[
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Facility Intelligence Dashboard</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9f6f2;color:#333;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
          {{ if .Subscriber.Attribs.facility_logo }}
          <tr>
            <td align="center" style="padding:30px 30px 10px;">
              <img src="{{ .Subscriber.Attribs.facility_logo }}" alt="{{ .Subscriber.Attribs.facility_name }}" style="max-width:200px;max-height:60px;">
            </td>
          </tr>
          {{ end }}
          <tr>
            <td style="padding:30px 40px 20px;">
              <h1 style="font-size:24px;margin:0 0 10px;color:#4a7c7e;">
                {{ if .Subscriber.Attribs.first_name }}Hi {{ .Subscriber.Attribs.first_name }},{{ else }}Hello,{{ end }}
              </h1>
              <p style="font-size:16px;line-height:1.6;margin:0 0 20px;">
                Families are searching for assisted living facilities like <strong>{{ .Subscriber.Attribs.facility_name }}</strong> every day on Assistedly.ai. 
                We built a private intelligence dashboard so you can see exactly what they care about.
              </p>
              <p style="font-size:16px;line-height:1.6;margin:0 0 20px;">
                View anonymized search trends, filter preferences, and competitor comparisons — all personalized for your community in {{ .Subscriber.Attribs.facility_city }}.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 40px 30px;">
              <a href="{{ .Subscriber.Attribs.demo_url }}" style="display:inline-block;padding:14px 32px;background:#4a7c7e;color:#ffffff;text-decoration:none;border-radius:12px;font-size:16px;font-weight:600;">
                View Your Dashboard
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 40px 30px;">
              <p style="font-size:14px;line-height:1.5;color:#666;margin:0;">
                This is a sample preview with fake data. Log in with your email to see your full branded dashboard.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #e6e6e9;font-size:13px;color:#999;">
              <p style="margin:0;">
                Assistedly.ai — Unbiased AI Finds Best Assisted Living in Massachusetts<br>
                Questions? Reply to this email or call us.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
]]>'''
    
    # Listmonk templates are stored as raw text (NOT CDATA-wrapped in the DB)
    template_body = template_body.replace('<![CDATA[\n', '').replace('\n]]>', '')
    
    cur.execute("""
        INSERT INTO templates (name, body, type, created_at, updated_at)
        VALUES (%s, %s, 'html', NOW(), NOW())
        ON CONFLICT DO NOTHING
        RETURNING id
    """, (template_name, template_body))
    
    result = cur.fetchone()
    if result:
        log(f"Created template ID: {result[0]}")
        template_id = result[0]
    else:
        # Get existing template id
        cur.execute("SELECT id FROM templates WHERE name = %s", (template_name,))
        template_id = cur.fetchone()[0]
        log(f"Template already exists ID: {template_id}")
    
    conn.commit()
    cur.close()
    conn.close()
    return template_id

def create_campaign(template_id):
    import psycopg2
    conn = psycopg2.connect(
        host=LISTMONK_DB_HOST,
        port=5432,
        user="listmonk",
        password="listmonk",
        database="listmonk"
    )
    cur = conn.cursor()
    
    campaign_name = "MA Facility Executive Director Outreach - Aug 2026"
    
    cur.execute("""
        INSERT INTO campaigns (name, subject, from_email, body, altbody, content_type, type, template_id, status, created_at, updated_at)
        VALUES (%s, %s, %s, '', '', 'html', 'regular', %s, 'draft', NOW(), NOW())
        ON CONFLICT DO NOTHING
        RETURNING id
    """, (campaign_name, "Your Facility Intelligence Dashboard — {{ .Subscriber.Attribs.facility_name }}", "josh@assistedly.ai", template_id))
    
    result = cur.fetchone()
    if result:
        campaign_id = result[0]
        log(f"Created campaign ID: {campaign_id}")
        
        # Link to list
        cur.execute("""
            INSERT INTO campaign_lists (campaign_id, list_id, created_at, updated_at)
            VALUES (%s, %s, NOW(), NOW())
            ON CONFLICT DO NOTHING
        """, (campaign_id, LISTMONK_LIST_ID))
    else:
        cur.execute("SELECT id FROM campaigns WHERE name = %s", (campaign_name,))
        campaign_id = cur.fetchone()[0]
        log(f"Campaign already exists ID: {campaign_id}")
    
    conn.commit()
    cur.close()
    conn.close()
    return campaign_id

def main():
    if not NOCODB_TOKEN:
        log("ERROR: NOCODB_TOKEN required")
        sys.exit(1)
    
    log("Step 1: Fetching facilities from NocoDB...")
    facilities = get_all_facilities()
    log(f"Found {len(facilities)} facilities")
    
    log("Step 2: Importing into Listmonk...")
    imported = update_listmonk_subscribers(facilities)
    
    log("Step 3: Creating campaign template...")
    template_id = create_campaign_template()
    
    log("Step 4: Creating campaign...")
    campaign_id = create_campaign(template_id)
    
    log(f"\n✓ Done.")
    log(f"  Subscribers: {imported}")
    log(f"  Template ID: {template_id}")
    log(f"  Campaign ID: {campaign_id}")
    log(f"  Next: Configure SMTP in Listmonk and start the campaign.")
    log(f"  Listmonk URL: http://{LISTMONK_DB_HOST}:9000")

if __name__ == "__main__":
    main()
