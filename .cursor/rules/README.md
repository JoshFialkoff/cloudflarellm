# Cursor rules (team hygiene)

## Source of truth

- **This directory in git is canonical.** Rules ship with the repo so CI, reviews, and clones stay aligned.
- Edit rules **here**, commit them on the same branch / PR as related code or workflow changes when practical.

## Optional: mirror rules to other local checkouts

Some developers keep **multiple folders** (another repo, a git worktree, or an older checkout). To copy **this** repo’s `.cursor/rules/` to those roots **without** maintaining duplicates by hand:

1. **Paths stay outside the repo** — use `~/.cursor/rules-mirrors` (one absolute path per line; `#` starts a comment; blank lines ignored).
2. Run from **this** repository root:

   ```bash
   npm run cursor:sync-rules
   ```

   Or pass paths explicitly (no mirrors file needed):

   ```bash
   bash scripts/sync-cursor-rules.sh /path/to/other/project/root
   ```

3. **Mirrors are overwritten** — the script replaces the destination `.cursor/rules/` with a copy of this repo’s rules and **removes files** there that no longer exist here (`rsync --delete`). Point mirrors only at folders where `.cursor/rules` is meant to be a **full copy** of this repo’s rules, not a mix of unique local-only rules.

4. **Do not commit** `~/.cursor/rules-mirrors` — it’s machine-specific (different paths per laptop).

5. **PullRequest / collaboration:** teammates get updates via **git**, not via your mirrors file. Sync is for **your** extra checkouts only.

## Related

- Script: `scripts/sync-cursor-rules.sh`
- npm: `cursor:sync-rules` in `package.json`
