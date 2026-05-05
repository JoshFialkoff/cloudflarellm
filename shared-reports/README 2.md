 # Shared Firecrawl reports

`scripts/firecrawl-social-engagement.cjs` writes full timestamped reports to
the gitignored `reports/` directory and also refreshes scrubbed, stable latest
copies here:

 - `latest-social-engagement.json`
 - `latest-social-engagement.md`

The shared JSON excludes raw Firecrawl agent payloads and redacts common
PII/secrets such as emails, phone numbers, Discord webhook URLs, bearer tokens,
Firecrawl keys, SSNs, street addresses, and Reddit profile URLs. Review the
latest files before committing them when you want future Cursor agents to have
immediate access to the newest Firecrawl engagement analysis.
