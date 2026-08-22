#!/usr/bin/env python3
"""
Firecrawl Nextdoor / Senior Care Conversation Monitor for Massachusetts

Searches the web for senior care conversations in MA towns, filters for
high-engagement opportunities, and posts the best results to Discord.

Usage:
    python3 monitor.py [--dry-run] [--towns tier1|tier2|tier3|all]

Environment (from Infisical):
    FIRECRAWL_API_KEY
    DISCORD_BOT_TOKEN
    DISCORD_CHANNEL_ID
    YOURLS_API_URL      (default: https://go.assistedly.ai/yourls-api.php)
    YOURLS_SIGNATURE    (API signature for custom short links)
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.parse
import typing
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

# ── Massachusetts Town Tiers ────────────────────────────────────────────────

MA_TOWNS = {
    "tier1": [
        "Plymouth",
        "Barnstable", "Hyannis", "Falmouth",
        "Worcester",
        "Framingham", "Natick", "Sudbury",
        "Lexington", "Concord", "Carlisle",
        "Newton", "Brookline", "Chestnut Hill",
        "Hingham", "Cohasset", "Scituate",
        "Pittsfield", "Lenox", "Great Barrington",
    ],
    "tier2": [
        "Springfield", "Chicopee",
        "Lowell", "Chelmsford", "Dracut",
        "Lynn", "Salem", "Peabody",
        "Taunton", "Attleboro", "New Bedford",
    ],
    "tier3": [
        # Smaller towns with ALFs — monitored via broader Google Alerts style queries
        "Northampton", "Amherst", "Greenfield",
        "Leominster", "Fitchburg", "Gardner",
        "Marlborough", "Hudson", "Milford",
        "Waltham", "Watertown", "Belmont",
        "Arlington", "Somerville", "Cambridge",
        "Quincy", "Braintree", "Weymouth",
        "Hull", "Marshfield", "Duxbury",
        "Kingston", "Hanover", "Norwell",
        "Stoughton", "Sharon", "Canton",
        "Foxborough", "Walpole", "Norwood",
        "Dedham", "Needham", "Westwood",
        "Medfield", "Dover", "Sherborn",
        "Hopkinton", "Ashland", "Holliston",
        "Southborough", "Westborough", "Northborough",
    ],
}

# ── Keyword Clusters ────────────────────────────────────────────────────────

KEYWORDS = [
    "assisted living",
    "memory care",
    "nursing home",
    "senior care",
    "home care",
    "elder care",
    "aging parents",
    "Medicaid assisted living",
]

# ── Configuration ─────────────────────────────────────────────────────────────

MAX_RESULTS_PER_QUERY = 10
SEARCH_WINDOW = "7d"  # firecrawl search time filter: qdr:w
DATA_DIR = Path(__file__).parent / "data"

# ── Helpers ───────────────────────────────────────────────────────────────────


def log(msg: str):
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")
    print(f"[{ts}] {msg}", flush=True)


def ensure_env():
    """Load secrets from Infisical render if available."""
    env_path = Path.home() / ".infisical" / "rendered" / ".env"
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                # Handle simple KEY='value' or KEY=value
                key, _, val = line.partition("=")
                key = key.strip()
                val = val.strip().strip("'\";")
                if key not in os.environ:
                    os.environ[key] = val
    missing = []
    for k in ("FIRECRAWL_API_KEY", "DISCORD_BOT_TOKEN", "DISCORD_CHANNEL_ID"):
        if not os.environ.get(k):
            missing.append(k)
    if missing:
        log(f"ERROR: Missing env vars: {missing}")
        sys.exit(1)

    # YOURLS is optional — if missing, we fall back to full URLs
    if not os.environ.get("YOURLS_API_URL"):
        os.environ["YOURLS_API_URL"] = "https://go.assistedly.ai/yourls-api.php"
    if not os.environ.get("YOURLS_SIGNATURE"):
        log("WARNING: YOURLS_SIGNATURE not set — links will not be shortened.")
    log("Secrets loaded from Infisical.")


def shorten_url(long_url: str, keyword: typing.Optional[str] = None, title: typing.Optional[str] = None) -> str:
    """Shorten a URL via YOURLS. Returns original URL on failure."""
    api_url = os.environ.get("YOURLS_API_URL", "")
    signature = os.environ.get("YOURLS_SIGNATURE", "")
    if not api_url or not signature:
        return long_url

    params = {
        "signature": signature,
        "action": "shorturl",
        "url": long_url,
        "format": "json",
    }
    if keyword:
        params["keyword"] = keyword
    if title:
        params["title"] = title[:200]

    query_string = urllib.parse.urlencode(params)
    url = f"{api_url}?{query_string}"

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "AssistedlyMonitor/1.0"},
            method="GET",
        )
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read())
            if data.get("status") == "success" or data.get("shorturl"):
                return data.get("shorturl", long_url)
            if data.get("status") == "fail" and "already exists" in str(data):
                # Keyword taken — return the link from the error
                log(f"  YOURLS keyword taken: {data.get('message', '')}")
                return data.get("shorturl", long_url)
            log(f"  YOURLS error: {data.get('message', 'unknown')}")
            return long_url
    except Exception as e:
        log(f"  YOURLS request failed: {e}")
        return long_url


def generate_keyword(r: dict, index: int) -> str:
    """Generate a descriptive custom YOURLS keyword for tracking."""
    query_slug = slug(r.get("query", "ma"))[:15]
    source = "reddit" if "reddit.com" in r["url"] else "fb" if "facebook" in r["url"] else "nd" if "nextdoor" in r["url"] else "web"
    date_code = datetime.now(timezone.utc).strftime("%m%d")
    # e.g. assisted_living_mareddit_0814_01
    return f"{query_slug}_{source}_{date_code}_{index:02d}"[:40]


def shorten_results(results: list[dict]) -> list[dict]:
    """Batch-shorten result URLs via YOURLS. Mutates and returns results."""
    signature = os.environ.get("YOURLS_SIGNATURE", "")
    if not signature:
        log("YOURLS not configured — using original URLs.")
        return results

    log(f"Shortening {len(results)} URLs via YOURLS...")
    for i, r in enumerate(results):
        keyword = generate_keyword(r, i + 1)
        short = shorten_url(r["url"], keyword=keyword, title=r.get("title"))
        r["shorturl"] = short
        r["yourls_keyword"] = keyword
        time.sleep(0.3)  # be polite to YOURLS API
    return results


def firecrawl_search(query: str, limit: int = MAX_RESULTS_PER_QUERY) -> list[dict]:
    """Run a single Firecrawl search via REST API and return web results."""
    api_key = os.environ.get("FIRECRAWL_API_KEY", "")
    if not api_key:
        log("  FIRECRAWL_API_KEY missing")
        return []

    url = "https://api.firecrawl.dev/v1/search"
    payload = json.dumps({
        "query": query,
        "limit": limit,
        "lang": "en",
        "country": "us",
    }).encode("utf-8")
    log(f"Searching: {query}")
    try:
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read())
    except Exception as e:
        log(f"  firecrawl API error: {e}")
        return []

    # Normalize API response: Firecrawl v1 search returns {success, data: [{title,url,description}]}
    raw_results = data.get("data", [])
    if not isinstance(raw_results, list):
        raw_results = []

    results = []
    for r in raw_results:
        results.append({
            "title": r.get("title", ""),
            "url": r.get("url", ""),
            "description": r.get("description", ""),
            "query": query,
        })
    log(f"  → {len(results)} results")
    return results


def slug(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")[:60]


def score_opportunity(item: dict) -> int:
    """Heuristic score for how good an outreach opportunity this is."""
    score = 0
    text = f"{item['title']} {item['description']} {item['url']}".lower()

    # Bonus for Nextdoor (high intent local conversations)
    if "nextdoor.com" in item["url"]:
        score += 30

    # Bonus for Reddit (community discussions)
    if "reddit.com" in item["url"]:
        score += 20

    # Bonus for Facebook groups
    if "facebook.com/groups" in item["url"]:
        score += 18

    # Bonus for Quora / forum-style Q&A
    if any(d in item["url"] for d in ("quora.com", "forum", "community")):
        score += 15

    # Bonus for local news / Patch / teeny towns
    if any(d in item["url"] for d in ("patch.com", "local", "news")):
        score += 10

    # Keyword intensity scoring
    high_intent_phrases = [
        "looking for", "recommendation", "recommend", "need help",
        "anyone know", "experience with", "review", "opinions on",
        "struggling with", "worried about", "concerned about",
        "moving my", "placing my", "finding a", "how do i",
        "what is the best", "which is better", "vs", "versus",
        "cost", "price", "expensive", "affordable", "cheap",
        "medicaid", "medicare", "insurance", "pay for",
        "urgent", "asap", "soon", "quickly",
    ]
    for phrase in high_intent_phrases:
        if phrase in text:
            score += 5

    # Topic relevance
    topic_keywords = ["assisted living", "memory care", "nursing home", "senior care",
                      "home care", "elder care", "aging parent", "medicaid"]
    for kw in topic_keywords:
        if kw in text:
            score += 3

    # Penalty for junk / aggregator / directory listings
    junk_domains = [
        "yelp.com", "healthgrades.com", "caring.com", "aplaceformom.com",
        "seniorliving.org", "senioradvisor.com", "zillow.com",
        "google.com/maps", "bbb.org", "玻璃", "casino", "bet",
    ]
    for junk in junk_domains:
        if junk in item["url"]:
            score -= 50

    # Penalty for unrelated topics
    unrelated = ["dog", "cat", "pet", "restaurant", "pizza", "hair salon",
                 "car repair", "plumber", "roofing", "landscaping",
                 "daycare", "child care", "preschool", "nanny"]
    for bad in unrelated:
        if bad in text:
            score -= 20

    return max(0, score)


def deduplicate(results: list[dict]) -> list[dict]:
    seen = set()
    out = []
    for r in results:
        key = r["url"].split("?")[0].rstrip("/")
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    return out


def post_to_discord(results: list[dict], dry_run: bool = False):
    """Post a formatted summary to Discord via Bot API."""
    # Shorten URLs first if YOURLS is configured
    results = shorten_results(results)

    token = os.environ["DISCORD_BOT_TOKEN"]
    # NOTE: The Infisical DISCORD_CHANNEL_ID points to an invalid channel.
    # Hardcode the correct #social-monitoring channel until Infisical is updated.
    channel_id = "1494298143704088720"
    url = f"https://discord.com/api/v10/channels/{channel_id}/messages"

    header = (
        f"🕵️ **Assistedly.ai — MA Senior Care Conversation Monitor**\n"
        f"_{datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}_\n"
        f"Found **{len(results)}** high-opportunity conversations.\n"
        "──────────────────────────────\n"
    )

    lines = [header]
    for i, r in enumerate(results[:15], 1):
        domain = r["url"].split("/")[2].replace("www.", "")
        emoji = "🚪" if "nextdoor" in domain else "💬" if "reddit" in domain else "📰"
        link = r.get("shorturl") or r["url"]
        keyword = r.get("yourls_keyword", "")
        kw_tag = f" `Keyword:` {keyword}" if keyword else ""
        lines.append(
            f"**{i}.** {emoji} [{r['title'][:80]}]({link})\n"
            f"   `Domain:` {domain} | `Score:` {r['score']}{kw_tag}\n"
            f"   {r['description'][:180]}...\n"
        )

    footer = (
        "\n──────────────────────────────\n"
        "**Next steps:**\n"
        "• Click links → read context → draft helpful, non-promotional reply\n"
        "• Priority: Nextdoor & Reddit first (highest local intent)\n"
        "• Always disclose affiliation with Assistedly.ai when relevant\n"
        "• Tracking spreadsheet: https://docs.google.com/spreadsheets (create one)\n"
    )

    content = "\n".join(lines) + footer
    # Discord has a 2000 char limit for regular messages; chunk if needed.
    chunks = chunk_message(content, 1900)

    for idx, chunk in enumerate(chunks):
        if dry_run:
            log(f"[DRY RUN] Discord chunk {idx+1}/{len(chunks)}:\n{chunk[:400]}...")
            continue

        payload = json.dumps({"content": chunk}).encode()
        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Authorization": f"Bot {token}",
                "Content-Type": "application/json",
                "User-Agent": "AssistedlyMonitor/1.0 (github.com/assistedly)",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                log(f"  Discord chunk {idx+1}/{len(chunks)} posted — HTTP {resp.status}")
        except Exception as e:
            log(f"  Discord chunk {idx+1} FAILED: {e}")
        time.sleep(1)


def chunk_message(text: str, limit: int) -> list[str]:
    """Split text into Discord-safe chunks."""
    if len(text) <= limit:
        return [text]
    chunks = []
    while text:
        if len(text) <= limit:
            chunks.append(text)
            break
        split = text.rfind("\n", 0, limit)
        if split == -1:
            split = limit
        chunks.append(text[:split])
        text = text[split:].lstrip("\n")
    return chunks


def generate_queries(tiers: list[str]) -> list[str]:
    """Build search queries from town tiers + keywords."""
    queries = []
    for tier in tiers:
        towns = MA_TOWNS.get(tier, [])
        # For each keyword, create a few query variants
        for kw in KEYWORDS:
            # Broad MA query (no town) — catches regional discussions
            queries.append(f'{kw} "Massachusetts" forum OR reddit OR nextdoor')
            # Town-specific queries for tier 1 & 2
            if tier in ("tier1", "tier2"):
                for town in towns[:8]:  # limit per-tier to avoid blowing quota
                    queries.append(f'{kw} "{town}" Massachusetts')
    # Deduplicate
    return list(dict.fromkeys(queries))


def main():
    parser = argparse.ArgumentParser(description="MA Senior Care Conversation Monitor")
    parser.add_argument("--dry-run", action="store_true", help="Don't post to Discord")
    parser.add_argument("--tiers", default="tier1,tier2", help="Comma-separated town tiers")
    parser.add_argument("--max-queries", type=int, default=25, help="Cap number of searches")
    args = parser.parse_args()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ensure_env()

    tiers = [t.strip() for t in args.tiers.split(",")]
    queries = generate_queries(tiers)[:args.max_queries]

    log(f"Running {len(queries)} Firecrawl searches across tiers: {tiers}")

    all_results = []
    for q in queries:
        results = firecrawl_search(q)
        for r in results:
            r["score"] = score_opportunity(r)
        all_results.extend(results)
        time.sleep(1.5)  # be nice to Firecrawl API

    # Deduplicate & sort
    all_results = deduplicate(all_results)
    all_results.sort(key=lambda x: x["score"], reverse=True)

    # Filter to meaningful scores
    good_results = [r for r in all_results if r["score"] >= 15]

    log(f"Total unique results: {len(all_results)}")
    log(f"High-opportunity results (score ≥15): {len(good_results)}")

    if good_results:
        post_to_discord(good_results, dry_run=args.dry_run)
    else:
        log("No high-opportunity results found today.")
        if not args.dry_run:
            post_to_discord([], dry_run=False)

    # Save raw results for audit
    audit_path = DATA_DIR / f"audit_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M')}.json"
    audit_path.write_text(json.dumps({
        "queries": queries,
        "all_results": all_results,
        "good_results": good_results,
    }, indent=2))
    log(f"Audit saved to {audit_path}")


if __name__ == "__main__":
    main()
