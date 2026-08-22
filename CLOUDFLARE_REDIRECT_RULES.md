# Cloudflare Redirect Rules for SEO

These instructions configure edge-level 301 redirects for subdomains that
currently serve duplicate content via Cloudflare Pages (bypassing the
Next.js middleware in the Worker).

## Required Dashboard Changes

Go to: https://dash.cloudflare.com/ad9d77d8f16147c01ff26b56d41cb5a9/assistedly.ai/rules/redirect-rules

### Rule 1: lp.assistedly.ai → assistedly.ai
- **Rule name**: `lp-subdomain-to-canonical`
- **When incoming requests match**:
  - Field: `Hostname`
  - Operator: `equals`
  - Value: `lp.assistedly.ai`
- **Then**:
  - Type: `Static`
  - URL: `https://assistedly.ai`
  - Status code: `301`
- **Preserve query string**: Yes

### Rule 2: chat.assistedly.ai → assistedly.ai
- **Rule name**: `chat-subdomain-to-canonical`
- **When incoming requests match**:
  - Field: `Hostname`
  - Operator: `equals`
  - Value: `chat.assistedly.ai`
- **Then**:
  - Type: `Static`
  - URL: `https://assistedly.ai`
  - Status code: `301`
- **Preserve query string**: Yes

## Why This Is Needed

- `lp.assistedly.ai` and `chat.assistedly.ai` resolve to Cloudflare IPs but
  are NOT attached as custom domains on the `assistedly-slot4` Worker.
- Instead, they fall through to Cloudflare Pages, which serves the Next.js
  static export without running the Worker middleware.
- Result: Google sees duplicate homepage content on 3+ hostnames, which
  dilutes ranking signals.
- Cloudflare Redirect Rules execute at the edge before Pages/Workers, so
  they guarantee a 301 regardless of the backend.
