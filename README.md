# AI-Assist-Living-Finder

A Next.js tool that helps families find assisted living facilities in Massachusetts using proprietary data, AI-powered matching, and compliance tracking sourced from official Massachusetts DPH records.

## Related Repositories

| Repo | Purpose |
|------|---------|
| **This repo** — [AI-Assist-Living-Finder](https://github.com/JoshFialkoff/AI-Assist-Living-Finder) | The facility-finder Next.js application |
| [aiassistliving.com](https://github.com/JoshFialkoff/aiassistliving.com) | The main marketing / brand site whose look and feel this app should match |

> **Design sync:** The visual design of this app (colors, typography, component styles) should stay consistent with the main site at [aiassistliving.com](https://github.com/JoshFialkoff/aiassistliving.com). When the main site is updated, review `styles/globals.css` and the CSS Modules in `styles/` and update accordingly.

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
  facility/[id].js  # Facility detail page (overview, compliance history, amenities, contact)
  api/
    facilities.js   # API route returning facility data
components/
  Navbar.js         # Sticky responsive navigation
styles/
  globals.css       # Design tokens (CSS custom properties), reset, and utility classes
  *.module.css      # Per-page/component CSS Modules
```

## Design Tokens

All brand colors, typography, spacing, and shadow values are defined as CSS custom properties in [`styles/globals.css`](./styles/globals.css). Update those variables first whenever aligning with the main `aiassistliving.com` site.

## Deployment

The app is deployed via [Easypanel](https://easypanel.io/) and is accessible at the configured hostname. See the `Dockerfile` (in the Easypanel project directory) for container configuration.
