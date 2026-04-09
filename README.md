# AI-Assist-Living-Companion

A Next.js tool that helps families find assisted living facilities in Massachusetts using proprietary data, AI-powered matching, and compliance tracking sourced from official Massachusetts DPH records.

## Related Repositories

| Repo | Purpose |
|------|---------|
| **This repo** — [AI-Assist-Living-Finder](https://github.com/JoshFialkoff/AI-Assist-Living-Finder) | The facility-finder Next.js application |
| [aiassistliving.com](https://github.com/JoshFialkoff/aiassistliving.com) | The main marketing / brand site whose look and feel this app should match |

> **Design sync:** The visual design of this app is intentionally kept consistent with the main site at [aiassistliving.com](https://github.com/JoshFialkoff/aiassistliving.com). The brand palette comes directly from that repo's `index.html` and `logo_light.svg`:</p>
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
> When `aiassistliving.com` is updated, edit `styles/globals.css` first; the CSS Modules in `styles/` will inherit most changes automatically through the CSS custom properties.

## Getting Started

### Prerequisites

- Node.js 20.9.0 or newer
- npm

### Install & run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

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

All brand colors, typography, spacing, and shadow values are defined as CSS custom properties in [`styles/globals.css`](./styles/globals.css). Update those variables first whenever aligning with the main `aiassistliving.com` site.

## Deployment

The app is deployed via [Easypanel](https://easypanel.io/) and is accessible at the configured hostname. See the `Dockerfile` (in the Easypanel project directory) for container configuration.

### Manual deploy command

Use `scripts/deploy-and-purge.sh` for manual server deploys. It performs:

- `npm ci --include=dev`
- `npm run build`
- `supervisorctl restart nextjs-server`
- Cloudflare full-cache purge (`purge_everything`)

Required environment variables:

- `CLOUDFLARE_ZONE_ID`
- `CLOUDFLARE_API_TOKEN`
