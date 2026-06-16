# Dependency Updates: Daily Check & Approval Flow

Assistedly uses [Dependabot](https://docs.github.com/en/code-security/dependabot) to
automatically open pull requests for outdated npm and GitHub Actions dependencies.
A daily GitHub Actions workflow posts a digest of pending PRs to Discord, and a
GitHub Environment approval gate prevents Dependabot-authored merges from deploying
without explicit sign-off.

---

## Overview

```
Daily @ 09:30 UTC
        │
        ▼
dependabot-discord-notify.yml
  └── scripts/ci/dependabot-discord-notify.mjs
        │  Queries GitHub API for open Dependabot PRs
        │  Posts summary to Discord (DISCORD_DEPENDABOT_WEBHOOK_URL)
        ▼
Team reviews PRs in GitHub → merges when satisfied
        │
        ▼
ci-cd.yml (push to main)
  ├── build job: lint → build → detect Dependabot commit
  └── deploy job:
        ├── Regular commit  → environment: production    (no approval gate)
        └── Dependabot commit → environment: dependency-deploy (⏸ requires reviewer approval)
              │
              ▼ (after approval in GitHub Actions UI)
        trigger-deploy → origin smoke → Cloudflare purge → production smoke
```

---

## Required Secrets & Variables

### Secrets — repo → Settings → Secrets and variables → Actions → Secrets

| Secret | Required | Description |
|--------|----------|-------------|
| `DEPLOY_KEY` | ✅ | SSH private key for the `opencode` user on the production host |
| `CLOUDFLARE_ZONE_ID` | ✅ | Cloudflare zone ID for cache purge |
| `CLOUDFLARE_API_TOKEN` | ✅ | Cloudflare API token with cache-purge permission |
| `DISCORD_DEPENDABOT_WEBHOOK_URL` | Recommended | Discord Incoming Webhook for the dependency-updates channel |
| `DISCORD_GITHUB_UPDATES_WEBHOOK_URL` | Fallback | Used if `DISCORD_DEPENDABOT_WEBHOOK_URL` is not set |
| `DISCORD_DEPLOY_WEBHOOK_URL` | Fallback | Legacy fallback webhook |

### Variables — repo → Settings → Secrets and variables → Actions → Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DEPLOY_HOST` | ✅ | Production SSH host IP (e.g. `192.0.2.100`) |
| `DEPLOY_COMPOSE_FILE` | Optional | Compose file to use; defaults to `compose.yaml`. Set to `compose.dify-host.yaml` after cutover to 75.127.14.185 |

---

## Required GitHub Environment Setup

The deploy job uses GitHub Environments to gate Dependabot deployments.
You must create these two environments:

### 1. `production` (for regular commits)

1. Go to **repo → Settings → Environments → New environment**
2. Name: `production`
3. No required reviewers needed (deploy proceeds automatically for non-Dependabot commits)

### 2. `dependency-deploy` (for Dependabot commits — the approval gate)

1. Go to **repo → Settings → Environments → New environment**
2. Name: `dependency-deploy`
3. Under **Deployment protection rules**, check **Required reviewers**
4. Add yourself (or your team) as a required reviewer
5. Set **Wait timer** to `0` minutes (or your preferred delay)

When a Dependabot PR is merged to `main`, the CI/CD `deploy` job will pause at the
`dependency-deploy` environment gate and send a notification. A required reviewer
then approves (or rejects) the deployment from the **Actions** tab in GitHub.

---

## Daily Schedule

### Dependabot PR creation

Dependabot checks for outdated dependencies according to `.github/dependabot.yml`:

- **npm packages**: daily at 06:00 ET, up to 5 open PRs at a time
- **GitHub Actions**: weekly on Monday at 06:00 ET, up to 3 open PRs

### Discord digest

The `dependabot-discord-notify` workflow runs daily at **09:30 UTC (~5:30 AM ET)**,
after Dependabot has had time to create its PRs.

It posts one of:
- 🟢 An all-clear if there are no open Dependabot PRs
- 🔄 A list of pending PRs with direct links for review

---

## How Approval Works

### Discord notification → review

1. Discord posts a list of open Dependabot PRs each morning.
2. Click a PR link to review the diff in GitHub.
3. Check the PR's CI checks pass (lint + build run automatically on the PR).
4. Merge the PR when satisfied.

### Deployment approval gate

After a Dependabot PR merges to `main`:

1. CI/CD starts and detects the Dependabot-authored commit.
2. The `deploy` job pauses at the **`dependency-deploy`** environment.
3. GitHub sends an email/notification to required reviewers.
4. A reviewer approves (or rejects) via:
   - **GitHub Actions UI**: navigate to the workflow run → click **Review deployments** → **Approve**
   - Or dismiss to skip the deployment.
5. On approval, the deploy proceeds: SSH deploy → origin smoke → Cloudflare purge → production smoke.

---

## How to Trigger the Discord Digest Manually

```
GitHub → Actions → "Dependabot digest → Discord" → Run workflow
```

---

## Detection Logic

The `build` job in `ci-cd.yml` detects Dependabot commits by checking:

1. `github.event.head_commit.author.name == "dependabot[bot]"` (direct Dependabot commit/rebase merge)
2. Commit message starts with `Merge pull request #N from dependabot/...` (merge commit)
3. Commit message starts with `Bump ... from ... to ...` or `deps: bump ...` (squash merge)

If any condition matches, the `deploy` job uses the `dependency-deploy` environment.

---

## Dependabot Configuration

See `.github/dependabot.yml`. Highlights:

- PRs are grouped by dependency type (dev vs production) to reduce noise.
- `open-pull-requests-limit: 5` prevents a flood of PRs.
- No auto-merge is configured; all merges are manual.
