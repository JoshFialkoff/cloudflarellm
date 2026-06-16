# Assistedly.ai

A Next.js tool that helps families find assisted living facilities in Massachusetts using proprietary data, AI-powered matching, and compliance tracking sourced from official Massachusetts DPH records.

## Related Repositories

| Repo | Purpose |
|------|---------|
| **This repo** — [Assistedly.ai](https://github.com/JoshFialkoff/AI-Assist-Living-Finder) | The facility-finder Next.js application |
| [Assistedly.ai](https://github.com/JoshFialkoff/Assistedly.ai) | The main marketing / brand site whose look and feel this app should match |

> **Design sync:** The visual design of this app is intentionally kept consistent with the main site at [Assistedly.ai](https://github.com/JoshFialkoff/Assistedly.ai). The brand palette comes directly from that repo's `index.html` and `logo_light.svg`:</p>
>
> | Token | Value | Usage |
> |-------|-------|-------|
> | `--accent` | `#12cd87` | CTA buttons, star ratings, success highlights |
> | `--secondary` | `#12abcd` | Gradient partner, secondary actions, range sliders |
> | `--primary` | `#0d3b30` | Hero/footer/stats-bar backgrounds, section headings |
> | `--bg` | `#fafafa` | Page background |
> | `--text` | `#111111` | Body text |
> | `--text-light` | `#666666` | Muted / secondary text |
> | `--border` | `#e6e6e9` | Input & card borders |
>
> When `Assistedly.ai` is updated, edit `styles/globals.css` first; the CSS Modules in `styles/` will inherit most changes automatically through the CSS custom properties.

## Getting Started

### Prerequisites

- Node.js 20.9.0 or newer
- npm

### Install & run locally

```bash
npm install
npm run dev
```

`npm run dev` runs `scripts/next-dev-free-port.js`: it picks the first free TCP port starting at **`3010`** (not **3000**, so local dev avoids colliding with anything else that usually binds **3000** on your machine) and binds **`0.0.0.0`**. After Next prints **Ready**, use the URL shown in the terminal, e.g. [http://localhost:3010/](http://localhost:3010/). Override the starting port with `PORT=3002 npm run dev` if you need a specific range.

To preview over Cloudflare Tunnel at **https://agent3.assistedly.ai/**, run:

```bash
npm run tunnel:dev:agent3
```

After `npm run build`, `scripts/print-test-url.js` prints a local test URL using **`PORT` or 3010** (same default as dev). It also prints a testing-site URL by checking, in order, **`TEST_SITE_URL`**, **`URL`**, **`SITE_URL`**, **`NEXT_PUBLIC_SITE_URL`**, **`NEXT_PUBLIC_APP_URL`**, **`NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`**, **`DEPLOY_PRIME_URL`**, **`CF_PAGES_URL`**, **`VERCEL_BRANCH_URL`**, **`VERCEL_URL`**, **`RAILWAY_PUBLIC_DOMAIN`**, and **`RENDER_EXTERNAL_URL`**. Values without a scheme are normalized to `https://.../`.


### Build for production

```bash
npm run build
npm start
```

### Lint

```bash
npm run lint
```

## Project Structure

```
pages/
  index.js          # Homepage — hero search, how-it-works, trust section, CTA
  search.js         # Facility search results with filters (budget, care level, compliance)
  facility/[slug].js # Facility detail page (slug URLs; overview, compliance, amenities, contact)
  api/
    facilities.js   # API route returning facility data
components/
  Search/index.js   # Search component stub
styles/
  globals.css       # Design tokens (CSS custom properties), reset, and utility classes
  *.module.css      # Per-page/component CSS Modules
```

## Design Tokens

All brand colors, typography, spacing, and shadow values are defined as CSS custom properties in [`styles/globals.css`](./styles/globals.css). Update those variables first whenever aligning with the main `Assistedly.ai` site.

## Deployment

Production **https://assistedly.ai** is served through **Cloudflare** (proxied DNS) to an origin Docker host.

| Host | IP | Edge proxy | Compose file |
|------|-----|------------|--------------|
| Current | 104.168.38.162 | Traefik | `compose.yaml` |
| Migration target | 75.127.14.185 | dify-nginx | `compose.dify-host.yaml` |

The app runs as the **`web` Docker Compose service** on **port 3003**. On the legacy host, Traefik reads routing labels from `compose.yaml`. On the Dify co-located host, `dify-nginx-1` proxies using `scripts/deploy/nginx-assistedly.conf` (see `docs/deploy/migration-to-dify-host.md`).

The app configuration directory on each host is **`/opt/assistedly`**. CI uploads each deploy to a temp worktree, copies `/opt/assistedly/.env.production`, then rebuilds and restarts the live Compose project.

Keep the container **`PORT`** aligned with the proxy target (**3003**). If those drift apart, Cloudflare can return **502** even while the container is healthy.

### GitHub Actions (`main`)

Pushes to **`main`** run CI (lint, build, deploy, smoke). At cutover, set workflow env `DEPLOY_HOST=75.127.14.185` and `DEPLOY_COMPOSE_FILE=compose.dify-host.yaml`.

### Manual deploy commands

**Legacy host:**
```bash
node scripts/ci/trigger-deploy.mjs --host 104.168.38.162
```

**Dify co-located host (after prep):**
```bash
DEPLOY_HOST=75.127.14.185 DEPLOY_COMPOSE_FILE=compose.dify-host.yaml DEPLOY_USER=joshfialkoff \
  node scripts/ci/trigger-deploy.mjs
```

### Production returns 502 (`error code: 502`)

That response is from **Cloudflare** when the **origin is unreachable** (process down, crash loop, wrong port, or firewall). **Cache purge alone will not fix it.**

1. SSH to the origin host.
2. `cd /opt/assistedly && docker compose -p assistedlyai ps` — expect the `web` service to be up.
3. `cd /opt/assistedly && docker compose -p assistedlyai logs --tail=200 web` for `[ensure-next-build]`, `next start`, or port-binding errors.
4. From the host: `curl -sI "http://127.0.0.1:3003/api/health"` (or `/`) — you should see `200` on `/api/health`.
5. If local health is good but the public site still fails, verify `compose.yaml` still points Traefik at **3003** and the `web` service remains attached to both the **`assistedly`** and Traefik overlay Docker networks.

## Cursor rules

Agent and editor rules live in **`.cursor/rules/`**. Treat that folder as **source of truth** in git—commit rule changes with the work they document.

If you use **more than one local checkout** and want the same rules everywhere without editing copies by hand, run **`npm run cursor:sync-rules`** (optional paths or `~/.cursor/rules-mirrors`). See [`.cursor/rules/README.md`](./.cursor/rules/README.md) for safety notes (`rsync --delete`, machine-local mirrors file).
