# Discord Ops Bot

A Discord bot you can ask open-ended questions about your Racknerd servers.

## Examples of what you can ask

- "Do I need to take any action on any of the Racknerd servers?"
- "How are the Racknerd servers doing?"
- "List all servers"
- "Any alerts?"
- "What servers need attention?"

## Setup

### 1. Create a Discord bot application

1. Go to https://discord.com/developers/applications
2. Click **New Application**, name it (e.g., "Assistedly Ops Bot")
3. Go to **Bot** tab → click **Add Bot**
4. Under **Privileged Gateway Intents**, turn on **MESSAGE CONTENT INTENT** (required to read text messages)
5. Click **Reset Token** and copy the token

### 2. Invite the bot to your server

1. Go to **OAuth2 → URL Generator**
2. Scopes: select **bot**
3. Bot permissions: select at minimum:
   - Send Messages
   - Read Message History
   - Mention @everyone, @here, and All Roles
4. Copy the generated URL, paste it in your browser, and invite the bot to the server where you want to ask questions

### 3. Configure the token

Add the token to your `.env.local` (or export it directly):

```bash
DISCORD_BOT_TOKEN=your-token-here
DISCORD_APPROVAL_CHANNEL_ID=optional-channel-id
```

If `DISCORD_APPROVAL_CHANNEL_ID` is set, the bot will reply to every message in that channel + @mentions anywhere.
If not set, it replies to @mentions and DMs.

### 4. Install and run

```bash
cd scripts/discord-ops-bot
npm install
DISCORD_BOT_TOKEN=xxx node ops-bot.js
```

For persistent running, use `pm2`, `screen`, or a systemd service:

```bash
# With pm2
pm2 start ops-bot.js --name ops-bot
pm2 save

# Or screen
screen -S ops-bot -dm node ops-bot.js
```

## How it works

The bot reads health logs from:
- Repository root (`health-YYYY-MM-DD.log`, `racknerd-health-YYYY-MM-DD.log`)
- `monitoring-fallback/` directory

It parses both log formats and keeps only the latest snapshot per server IP.

Based on your question, it routes to:
- **Action summary** — if you ask about actions, next steps, or "should I..."
- **Health summary** — if you ask about status, health, alerts, or loads
- **Inventory** — if you ask to list servers
- **Help** — for anything else
