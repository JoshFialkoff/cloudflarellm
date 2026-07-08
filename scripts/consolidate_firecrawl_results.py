#!/usr/bin/env python3
"""
Consolidate Firecrawl partner discovery results for Assistedly.ai revenue generation.
This script:
1. Loads & deduplicates Firecrawl CSV results
2. Scores each company on revenue potential
3. Exports to multiple platforms (Discord, NocoDB, Google Sheets)
4. Tracks outreach status and follow-ups
"""

import pandas as pd
import json
import hashlib
from datetime import datetime
from pathlib import Path
import re
import os

# Input CSV files
CSV_FILES = [
    "/Users/joshdev/Downloads/age tech monitoring apps extract-data-2026-07-03.csv",
    "/Users/joshdev/Downloads/extract-data-2026-07-04.csv",
    "/Users/joshdev/Downloads/extract-data-2026-07-04 (1).csv"  # Duplicate check
]

OUTPUT_DIR = Path("/Users/joshdev/Assistedly.ai/data/partner_outreach")
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def load_and_deduplicate():
    """Load all CSVs and deduplicate based on company name."""
    all_data = []
    
    for csv_file in CSV_FILES:
        if not Path(csv_file).exists():
            print(f"Warning: {csv_file} not found, skipping...")
            continue
            
        try:
            df = pd.read_csv(csv_file)
            df['source_file'] = Path(csv_file).name
            df['load_date'] = Path(csv_file).name.split('extract-data-')[1].replace('.csv', '') if 'extract-data-' in Path(csv_file).name else '2026-07-03'
            all_data.append(df)
            print(f"Loaded {len(df)} rows from {Path(csv_file).name}")
        except Exception as e:
            print(f"Error loading {csv_file}: {e}")
    
    if not all_data:
        raise ValueError("No data loaded from CSV files")
    
    # Combine all dataframes
    combined_df = pd.concat(all_data, ignore_index=True)
    
    # Deduplicate by company_name, keeping the most recent entry
    combined_df = combined_df.sort_values('load_date', ascending=False)
    deduped_df = combined_df.drop_duplicates(subset=['company_name'], keep='first')
    
    print(f"\nTotal rows: {len(combined_df)}, Unique companies: {len(deduped_df)}")
    return deduped_df

def calculate_revenue_score(row):
    """
    Score each partner on revenue potential (0-100).
    Factors:
    - Privacy alignment (30 points)
    - Contact quality (20 points)
    - Market presence (20 points)
    - Massachusetts relevance (15 points)
    - Partnership readiness (15 points)
    """
    score = 0
    score_breakdown = {}
    
    # Privacy alignment (30 points)
    privacy_text = str(row.get('privacy_philosophy_match', '')).lower()
    if 'privacy-first' in privacy_text or 'no cameras' in privacy_text:
        score += 15
        score_breakdown['privacy_first'] = 15
    if 'not sell' in privacy_text or 'never sell' in privacy_text:
        score += 15
        score_breakdown['no_lead_selling'] = 15
    
    # Contact quality (20 points)
    if pd.notna(row.get('contact_person.name')):
        score += 5
        score_breakdown['has_contact_name'] = 5
    if pd.notna(row.get('contact_person.title')):
        title = str(row.get('contact_person.title', '')).lower()
        if 'founder' in title or 'ceo' in title:
            score += 10
            score_breakdown['c_level_contact'] = 10
        elif 'head' in title or 'director' in title or 'vp' in title:
            score += 7
            score_breakdown['senior_contact'] = 7
    if pd.notna(row.get('contact_person.linkedin_url')) or pd.notna(row.get('contact_person.email')):
        score += 5
        score_breakdown['has_contact_method'] = 5
    
    # Market presence (20 points)
    intro_msg = str(row.get('personalized_intro_message', '')).lower()
    if 'raise' in intro_msg or 'funding' in intro_msg or 'million' in intro_msg:
        score += 10
        score_breakdown['funded_company'] = 10
    if pd.notna(row.get('website')):
        score += 5
        score_breakdown['has_website'] = 5
    if 'radar' in privacy_text or 'ambient' in privacy_text or 'ai' in privacy_text:
        score += 5
        score_breakdown['innovative_tech'] = 5
    
    # Massachusetts relevance (15 points)
    if 'massachusetts' in intro_msg or 'boston' in intro_msg or 'new england' in intro_msg:
        score += 10
        score_breakdown['ma_presence'] = 10
    if 'senior' in privacy_text or 'aging' in privacy_text or 'elder' in privacy_text:
        score += 5
        score_breakdown['senior_focused'] = 5
    
    # Partnership readiness (15 points)
    if 'partnership' in intro_msg or 'collaborate' in intro_msg:
        score += 8
        score_breakdown['partnership_mentioned'] = 8
    if pd.notna(row.get('best_contact_channel')):
        score += 7
        score_breakdown['clear_contact_channel'] = 7
    
    return score, score_breakdown

def enrich_data(df):
    """Add revenue scoring and outreach metadata."""
    # Calculate revenue scores
    scores_and_breakdowns = df.apply(calculate_revenue_score, axis=1)
    df['revenue_score'] = scores_and_breakdowns.apply(lambda x: x[0])
    df['score_breakdown'] = scores_and_breakdowns.apply(lambda x: json.dumps(x[1]))
    
    # Add outreach tracking fields
    df['outreach_status'] = 'pending'
    df['outreach_date'] = None
    df['last_followup'] = None
    df['response_received'] = False
    df['notes'] = ''
    
    # Generate unique IDs for tracking
    df['partner_id'] = df['company_name'].apply(
        lambda x: hashlib.md5(x.encode()).hexdigest()[:8]
    )
    
    # Categorize by tier based on score
    df['tier'] = pd.cut(
        df['revenue_score'],
        bins=[0, 40, 70, 100],
        labels=['Tier 3', 'Tier 2', 'Tier 1']
    )
    
    # Sort by revenue score (highest first)
    df = df.sort_values('revenue_score', ascending=False)
    
    return df

def export_to_json(df):
    """Export consolidated data to JSON for further processing."""
    output_file = OUTPUT_DIR / f"partner_pipeline_{datetime.now().strftime('%Y%m%d')}.json"
    
    # Convert to dict format with clean structure
    partners = []
    for _, row in df.iterrows():
        partner = {
            'id': row['partner_id'],
            'company': row['company_name'],
            'website': row.get('website'),
            'tier': row['tier'],
            'revenue_score': int(row['revenue_score']),
            'score_breakdown': json.loads(row['score_breakdown']),
            'contact': {
                'name': row.get('contact_person.name'),
                'title': row.get('contact_person.title'),
                'linkedin': row.get('contact_person.linkedin_url'),
                'email': row.get('contact_person.email'),
                'best_channel': row.get('best_contact_channel')
            },
            'privacy_alignment': row.get('privacy_philosophy_match'),
            'outreach': {
                'status': row['outreach_status'],
                'message': row.get('personalized_intro_message'),
                'date': row['outreach_date'],
                'last_followup': row['last_followup'],
                'response': row['response_received']
            },
            'metadata': {
                'source_file': row['source_file'],
                'load_date': row['load_date'],
                'notes': row['notes']
            }
        }
        partners.append(partner)
    
    output = {
        'generated_at': datetime.now().isoformat(),
        'total_partners': len(partners),
        'tier_distribution': df['tier'].value_counts().to_dict(),
        'avg_revenue_score': float(df['revenue_score'].mean()),
        'partners': partners
    }
    
    with open(output_file, 'w') as f:
        json.dump(output, f, indent=2)
    
    print(f"\nExported to {output_file}")
    return output_file

def export_to_csv(df):
    """Export to CSV for easy import to Google Sheets."""
    output_file = OUTPUT_DIR / f"partner_pipeline_{datetime.now().strftime('%Y%m%d')}.csv"
    
    # Select key columns for spreadsheet view
    export_columns = [
        'partner_id', 'company_name', 'tier', 'revenue_score',
        'contact_person.name', 'contact_person.title',
        'best_contact_channel', 'contact_person.linkedin_url',
        'contact_person.email', 'website', 'outreach_status',
        'privacy_philosophy_match'
    ]
    
    # Only include columns that exist
    export_columns = [col for col in export_columns if col in df.columns]
    
    export_df = df[export_columns].copy()
    export_df.to_csv(output_file, index=False)
    
    print(f"Exported to {output_file}")
    return output_file

def generate_discord_message(df):
    """Generate Discord-formatted summary for posting."""
    output_file = OUTPUT_DIR / f"discord_summary_{datetime.now().strftime('%Y%m%d')}.md"
    
    tier1 = df[df['tier'] == 'Tier 1']
    tier2 = df[df['tier'] == 'Tier 2']
    
    message = f"""# 🎯 Assistedly.ai Partner Pipeline Update
*Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}*

## 📊 Pipeline Summary
- **Total Partners Identified:** {len(df)}
- **Tier 1 (High Priority):** {len(tier1)}
- **Tier 2 (Medium Priority):** {len(tier2)}
- **Average Revenue Score:** {df['revenue_score'].mean():.1f}/100

## 🔥 Top 5 Tier 1 Partners
"""
    
    for idx, row in tier1.head(5).iterrows():
        contact_info = row.get('contact_person.name', 'Unknown')
        if pd.notna(row.get('contact_person.title')):
            contact_info += f" ({row['contact_person.title']})"
        
        message += f"""
**{row['company_name']}** - Score: {row['revenue_score']}/100
- Contact: {contact_info}
- Channel: {row.get('best_contact_channel', 'N/A')}
- Privacy Match: {"✅ Strong" if row['revenue_score'] >= 70 else "🟨 Moderate"}
"""
    
    message += f"""
## 📋 Next Actions
1. Initiate outreach to Tier 1 partners via preferred channels
2. Prepare partnership deck for high-score companies
3. Schedule follow-ups for pending outreach
4. Track responses in CRM

## 📁 Full Data
- JSON: `data/partner_outreach/partner_pipeline_{datetime.now().strftime('%Y%m%d')}.json`
- CSV: `data/partner_outreach/partner_pipeline_{datetime.now().strftime('%Y%m%d')}.csv`

*Use `@firecrawl-discord-outreach` to run next batch discovery*
"""
    
    with open(output_file, 'w') as f:
        f.write(message)
    
    print(f"\nDiscord summary saved to {output_file}")
    print("\n" + "="*50)
    print(message)
    print("="*50)
    
    return output_file

def generate_implementation_scripts(df):
    """Generate actionable scripts for CRM integration and outreach."""
    scripts_dir = OUTPUT_DIR / "implementation"
    scripts_dir.mkdir(exist_ok=True)
    
    # 1. NocoDB import script
    nocodb_script = scripts_dir / "nocodb_import.py"
    with open(nocodb_script, 'w') as f:
        f.write('''#!/usr/bin/env python3
"""
Import partner pipeline into NocoDB CRM.
Requires: NOCODB_API_KEY environment variable
"""
import requests
import json
import os
from pathlib import Path

NOCODB_BASE_URL = "http://107.172.94.35:8080"
API_KEY = os.getenv("NOCODB_API_KEY")
TABLE_NAME = "partner_pipeline"

def create_or_update_partner(partner_data):
    """Create or update partner in NocoDB."""
    headers = {
        "xc-auth": API_KEY,
        "Content-Type": "application/json"
    }
    
    # Check if partner exists
    search_url = f"{NOCODB_BASE_URL}/api/v1/db/data/noco/assistedly/{TABLE_NAME}"
    params = {"where": f"(partner_id,eq,{partner_data['id']})"}
    
    response = requests.get(search_url, headers=headers, params=params)
    
    if response.status_code == 200 and response.json().get('list'):
        # Update existing
        record_id = response.json()['list'][0]['id']
        update_url = f"{search_url}/{record_id}"
        requests.patch(update_url, headers=headers, json=partner_data)
        print(f"Updated: {partner_data['company']}")
    else:
        # Create new
        requests.post(search_url, headers=headers, json=partner_data)
        print(f"Created: {partner_data['company']}")

if __name__ == "__main__":
    # Load latest pipeline data
    latest_file = sorted(Path("../").glob("partner_pipeline_*.json"))[-1]
    with open(latest_file) as f:
        data = json.load(f)
    
    print(f"Importing {len(data['partners'])} partners to NocoDB...")
    
    for partner in data['partners']:
        create_or_update_partner(partner)
    
    print("Import complete!")
''')
    
    # 2. LinkedIn outreach automation script
    linkedin_script = scripts_dir / "linkedin_outreach.py"
    with open(linkedin_script, 'w') as f:
        f.write('''#!/usr/bin/env python3
"""
Generate LinkedIn outreach templates for Tier 1 partners.
"""
import json
from pathlib import Path
from datetime import datetime

def generate_linkedin_messages():
    """Create personalized LinkedIn messages for top partners."""
    # Load latest pipeline data
    latest_file = sorted(Path("../").glob("partner_pipeline_*.json"))[-1]
    with open(latest_file) as f:
        data = json.load(f)
    
    tier1_partners = [p for p in data['partners'] if p['tier'] == 'Tier 1']
    
    messages = []
    for partner in tier1_partners[:10]:  # Top 10 only
        if partner['contact'].get('linkedin'):
            message = {
                'company': partner['company'],
                'contact': partner['contact']['name'],
                'linkedin_url': partner['contact']['linkedin'],
                'channel': partner['contact']['best_channel'],
                'message': partner['outreach']['message'],
                'score': partner['revenue_score']
            }
            messages.append(message)
    
    # Save messages
    output_file = Path("../") / f"linkedin_outreach_{datetime.now().strftime('%Y%m%d')}.json"
    with open(output_file, 'w') as f:
        json.dump(messages, f, indent=2)
    
    print(f"Generated {len(messages)} LinkedIn outreach messages")
    print(f"Saved to: {output_file}")
    
    # Print first message as example
    if messages:
        print("\\nExample message:")
        print(f"To: {messages[0]['contact']} at {messages[0]['company']}")
        print(f"LinkedIn: {messages[0]['linkedin_url']}")
        print(f"\\n{messages[0]['message']}")

if __name__ == "__main__":
    generate_linkedin_messages()
''')
    
    # 3. Google Sheets sync script
    sheets_script = scripts_dir / "sheets_sync.sh"
    with open(sheets_script, 'w') as f:
        f.write('''#!/bin/bash
# Sync partner pipeline to Google Sheets
# Requires: gcloud CLI installed and authenticated

SPREADSHEET_ID="YOUR_SPREADSHEET_ID"  # Replace with actual ID
SHEET_NAME="Partner Pipeline"
CSV_FILE="../partner_pipeline_$(date +%Y%m%d).csv"

echo "Uploading to Google Sheets..."

# Use Google Sheets API or gcloud to upload
# This is a placeholder - implement based on your Google Workspace setup
curl -X POST \\
  "https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}:clear" \\
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
  -H "Content-Type: application/json"

curl -X PUT \\
  "https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${SHEET_NAME}?valueInputOption=RAW" \\
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \\
  -H "Content-Type: application/json" \\
  -d @- <<EOF
{
  "values": $(python3 -c "import csv, json; print(json.dumps(list(csv.reader(open('${CSV_FILE}')))))")
}
EOF

echo "Upload complete!"
''')
    
    # Make scripts executable
    for script in [nocodb_script, linkedin_script]:
        script.chmod(0o755)
    
    print(f"\nGenerated implementation scripts in {scripts_dir}")
    return scripts_dir

def main():
    """Main execution flow."""
    print("="*60)
    print("Assistedly.ai Partner Pipeline Consolidation")
    print("="*60)
    
    # Load and deduplicate data
    print("\n1. Loading and deduplicating data...")
    df = load_and_deduplicate()
    
    # Enrich with revenue scores
    print("\n2. Calculating revenue scores...")
    df = enrich_data(df)
    
    # Export to various formats
    print("\n3. Exporting data...")
    json_file = export_to_json(df)
    csv_file = export_to_csv(df)
    discord_file = generate_discord_message(df)
    scripts_dir = generate_implementation_scripts(df)
    
    # Summary statistics
    print("\n" + "="*60)
    print("SUMMARY STATISTICS")
    print("="*60)
    print(f"Total unique partners: {len(df)}")
    print(f"\nTier distribution:")
    for tier, count in df['tier'].value_counts().items():
        print(f"  {tier}: {count} partners")
    
    print(f"\nTop 5 partners by revenue score:")
    for idx, row in df.head(5).iterrows():
        print(f"  {row['company_name']}: {row['revenue_score']}/100")
    
    print(f"\nContact channel distribution:")
    print(df['best_contact_channel'].value_counts())
    
    print("\n" + "="*60)
    print("OUTPUT FILES")
    print("="*60)
    print(f"JSON: {json_file}")
    print(f"CSV: {csv_file}")
    print(f"Discord: {discord_file}")
    print(f"Scripts: {scripts_dir}")
    
    print("\n" + "="*60)
    print("NEXT STEPS")
    print("="*60)
    print("1. Review Discord summary above")
    print("2. Run implementation scripts to sync with platforms:")
    print(f"   - NocoDB: python3 {scripts_dir}/nocodb_import.py")
    print(f"   - LinkedIn: python3 {scripts_dir}/linkedin_outreach.py")
    print(f"   - Google Sheets: bash {scripts_dir}/sheets_sync.sh")
    print("3. Begin outreach to Tier 1 partners")
    print("4. Schedule follow-ups in calendar")
    
    return df

if __name__ == "__main__":
    df = main()