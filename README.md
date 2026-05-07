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

`npm run dev` runs `scripts/next-dev-free-port.js`: it picks the first free TCP port starting at **`3010`** (not **3000**, since EasyPanel often uses 3000 on this host) and binds **`0.0.0.0`**. After Next prints **Ready**, use the URL shown in the terminal, e.g. [http://localhost:3010/](http://localhost:3010/). Override the starting port with `PORT=3002 npm run dev` if you need a specific range.

After `npm run build`, `scripts/print-test-url.js` prints a local test URL using **`PORT` or 3010** (same default as dev).


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

Production **https://assistedly.ai** is served through **Cloudflare** (proxied DNS) to an origin where this app runs under **Supervisor** as `nextjs-server` (see `scripts/deploy-and-purge.sh`). The app working directory on that host is typically **`/code`**, matching the deploy script.

Set **`PORT`** in the Supervisor program environment (or leave unset so `npm start` defaults to **3000**) and ensure Cloudflare / any reverse proxy forwards to **that same port**. A **Dockerfile** may exist for other environments; it does not replace the Supervisor-based production path unless you explicitly migrated hosting.

### Manual deploy command

Use `scripts/deploy-and-purge.sh` on the server. It performs:

- `npm ci --include=dev`
- `npm run build`
- `supervisorctl restart nextjs-server`
- Cloudflare full-cache purge (`purge_everything`)

Required environment variables:

- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_API_TOKEN`

### Production returns 502 (`error code: 502`)

That response is from **Cloudflare** when the **origin is unreachable** (process down, crash loop, wrong port, or firewall). **Cache purge alone will not fix it.**

1. SSH to the origin host.
2. `supervisorctl status nextjs-server` — expect `RUNNING`. If `FATAL` / `BACKOFF`, inspect logs.
3. `supervisorctl tail nextjs-server stderr` (or your configured log paths) for `[ensure-next-build]` or `next start` errors.
4. From the host: `curl -sI "http://127.0.0.1:${PORT:-3000}/api/health"` (or `/`) — you should see `200` on `/api/health`. If this fails, fix the app or rebuild (`.next` missing → run `npm run build` in `/code`).
5. When the app responds locally, `supervisorctl restart nextjs-server` if needed, then re-check https://assistedly.ai .
