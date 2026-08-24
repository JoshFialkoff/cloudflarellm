# Discord ↔ Goose Integration Recipe

> **Status:** Awaiting restart with Infisical agent-proxy  
> **Goal:** Two-way chat between Discord threads and Goose sessions  

---

## Prerequisites (User Must Complete First)

Restart Goose so Zapier MCP tools are loaded:

```bash
INFISICAL_DOMAIN=https://secrets.assistedly.ai \
infisical secrets agent-proxy run --env=dev -- goose
```

Verify by asking the new session: “List your Zapier tools.” You should see `list_zapier_actions`, `create_zap`, etc.

---

## Architecture Overview

```
Discord Message
    ↓
Zapier Zap 1 (Inbound)
    ↓
Goose Session (via MCP)
    ↓
Goose Reply
    ↓
Zapier Zap 2 (Outbound via Webhook)
    ↓
Discord Reply (in Thread)
```

---

## Zap 1: Discord Inbound → Goose

| Step | App | Config |
|------|-----|--------|
| **Trigger** | Discord | New Message in Channel (or New Message in Forum Post / Thread) |
| **Action 1** | Zapier Storage — Get Value | Key: `discord:<channel_id>:<author_id>` → returns `goose_session_id` or nothing |
| **Action 2A** (no session) | Webhooks by Zapier — POST | URL: `http://localhost:3000/api/chat/start` (or your Goose API endpoint)  
Payload: `{ "message": "{{ discord_message_content }}", "author": "{{ author_id }}", "source": "discord" }`  
Store response `session_id` |
| **Action 2B** (has session) | Webhooks by Zapier — POST | URL: `http://localhost:3000/api/chat/continue`  
Payload: `{ "session_id": "{{ stored_session_id }}", "message": "{{ discord_message_content }}" }` |
| **Action 3** | Zapier Storage — Set Value | Key: `discord:<channel_id>:<author_id>` → Value: `{{ goose_session_id }}` |

**Threading Strategy:**  
- Per-user persistence: `${channel_id}:${author_id}` as the storage key  
- Per-thread persistence: Use Discord’s native `thread_id` as the key instead  

---

## Zap 2: Goose → Discord Outbound

| Step | App | Config |
|------|-----|--------|
| **Trigger** | Webhooks by Zapier — Catch Raw Hook | Create a “Catch Hook” trigger. Copy the provided webhook URL. |
| **Action 1** | Zapier Storage — Get Value | Key: `goose:{{ incoming_webhook.session_id }}` → returns `discord_channel_id` and `discord_thread_id` |
| **Action 2** | Discord — Send Message | Channel: `{{ discord_channel_id }}`  
Thread: `{{ discord_thread_id }}` (optional, for replying in thread)  
Content: `{{ incoming_webhook.goose_reply }}` |

### How Goose Sends Replies to Zapier

Your Goose session (or the app) must POST to the Zapier Catch Hook URL:

```bash
curl -X POST "https://hooks.zapier.com/hooks/catch/<your_zap_id>/<your_hook_id>/" \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "goose-sess-abc123",
    "discord_thread_id": "thread-xyz789",
    "goose_reply": "Here is my analysis..."
  }'
```

Store the Catch Hook URL in Infisical as `ZAPIER_DISCORD_OUTBOUND_HOOK_URL`.

---

## Required Secrets (Add to Infisical)

| Secret | Purpose | Environment |
|--------|---------|-------------|
| `ZAPIER_MCP_TOKEN` | Authenticate Zapier MCP server | `dev`, `prod` |
| `ZAPIER_DISCORD_OUTBOUND_HOOK_URL` | Zapier Catch Hook for replies to Discord | `dev`, `prod` |
| `DISCORD_BOT_TOKEN` | If building a Discord bot instead of Zapier native | `dev`, `prod` |
| `DISCORD_GUILD_ID` | Server ID for Zapier Discord triggers | `dev` |
| `DISCORD_CHANNEL_ID` | Default channel for inbound messages | `dev` |

---

## Migration Path: Zapier → Native Discord Bot

Zapier Discord triggers have ~15-minute delay on free plans. For real-time:

1. Build a lightweight Discord bot (Node.js) that posts to `http://localhost:3000/api/chat/start|continue`
2. Goose replies via the same Zapier Catch Hook (or directly to bot’s webhook)
3. Bot sends reply back to Discord thread instantly

This recipe focuses on pure-Zapier first since it requires no extra hosting.

---

## Testing Checklist

- [ ] Send a message in Discord → verify it appears in Goose session  
- [ ] Reply from Goose → verify it appears in Discord thread  
- [ ] Send a second message in same Discord thread → verify Goose remembers context  
- [ ] Start a new thread → verify Goose creates a new session (no context bleed)  

---

## Notes

- **Session TTL:** Goose sessions may timeout. If `continue` fails with session not found, fall back to `start` and overwrite the stored `goose_session_id`.  
- **Rate Limits:** Discord has 5 msg/sec per channel. Zapier has task limits on free tiers.  
- **Error Handling:** Add a Zapier “Send DM to Admin” step on failure so you know if messages are dropping.  

Generated: 2026-08-23  
Awaiting: `infisical secrets agent-proxy run --env=dev -- goose`
