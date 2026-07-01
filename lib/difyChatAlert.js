/**
 * Sends a Discord alert when the Dify chat (/api/chat) fails, so goose (or a human)
 * can triage and fix the problem.
 *
 * The embed includes a structured "goose prompt" with exact triage commands.
 *
 * Config: set DISCORD_CHAT_ALERT_WEBHOOK_URL in .env.production.
 * Falls back to DISCORD_SERVER_OPS_WEBHOOK_URL, then DISCORD_CONCIERGE_WEBHOOK_URL.
 */
export async function sendDifyChatAlert({ error, status, attemptedUrl, mode, upstreamBody, query }) {
  const webhookUrl =
    process.env.DISCORD_CHAT_ALERT_WEBHOOK_URL ||
    process.env.DISCORD_SERVER_OPS_WEBHOOK_URL ||
    process.env.DISCORD_CONCIERGE_WEBHOOK_URL ||
    process.env.DISCORD_WEBHOOK_URL

  if (!webhookUrl?.startsWith('https://discord.com/api/webhooks/')) return

  const isWrongApiPrefix = /\/api\/v1\//i.test(attemptedUrl)
  const upstreamPreview = String(upstreamBody || '').slice(0, 2000)

  const description = [
    `**Status:** ${status || 'unknown'}`,
    `**Mode:** ${mode || 'chat'}`,
    `**Attempted URL:** \`${attemptedUrl}\``,
    `**Detected /api/v1?** ${isWrongApiPrefix ? '⚠️ YES — this is the known bug' : 'No'}`,
    query ? `**Query preview:** ${query.slice(0, 200)}` : '',
    `**Upstream response:**`,
    upstreamPreview ? `\`\`\`${upstreamPreview.slice(0, 1000)}\`\`\`` : '*(empty)*',
  ]
    .filter(Boolean)
    .join('\n')

  const goosePrompt = [
    `## goose — triage this Dify chat failure`,
    ``,
    `The /api/chat endpoint returned HTTP ${status} when calling ${mode} mode on \`${attemptedUrl}\`.`,
    isWrongApiPrefix
      ? `**Likely cause:** DIFY_API_BASE_URL contains /api/v1 instead of /v1 (the nginx /api route goes to the Console API, not the Public API).`
      : `**Check:** Is the Dify app running? Is the API key valid?`,
    ``,
    `### Triage commands (SSH joshfialkoff@75.127.14.185):`,
    `\`\`\``,
    `# 1. Check DIFY_API_BASE_URL (must be http://api:5001/v1 on Dify host)`,
    `grep DIFY_API_BASE /opt/assistedly/.env.production`,
    ``,
    `# 2. Test Dify parameters endpoint internally`,
    `DIFY_KEY=$(grep ^DIFY_API_KEY= /opt/assistedly/.env.production | cut -d= -f2)`,
    `curl -sI -H "Authorization: Bearer $DIFY_KEY" "http://api:5001/v1/parameters"`,
    ``,
    `# 3. Test /api/chat probe`,
    `curl -s "https://assistedly.ai/api/chat?probe=1" | jq .`,
    ``,
    `# 4. Check server logs for runtime guard or TypeError`,
    `docker logs assistedly-web-1 2>&1 | grep -iE "CRITICAL|TypeError"`,
    ``,
    `# 5. Check for empty lib files (can cause TypeError at runtime)`,
    `# ls -la /opt/assistedly/lib/ | grep ' 0 '`,
    ``,
    `# 6. If URL is wrong, fix and rebuild with --no-cache:`,
    `# sed -i 's|https://dify.forwardjump.com/v1|http://api:5001/v1|g' /opt/assistedly/.env.production`,
    `# cd /home/joshfialkoff/assistedly-deploy-* && docker build --no-cache -t assistedly-web:local .`,
    `# docker compose -f compose.dify-host.yaml -p assistedly up -d --force-recreate`,
    `\`\`\``,
    isWrongApiPrefix
      ? `**Quick fix:** \`sed -i 's|/api/v1|/v1|g' /opt/assistedly/.env.production && docker compose -p assistedlyai restart web\``
      : '',
    ``,
    `After fixing, verify:`,
    `\`\`\``,
    `curl -s "https://assistedly.ai/api/chat?probe=1" | jq .parametersUrl`,
    `PRODUCTION_SMOKE_URL=https://assistedly.ai/ npm run smoke:production`,
    `\`\`\``,
  ]
    .filter(Boolean)
    .join('\n')

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: `@here 🚨 **Dify chat failure** — HTTP ${status} on ${mode} (${new Date().toISOString()})`,
        embeds: [
          {
            title: 'Dify Chat Failure — Auto-detected',
            description,
            color: 0xdc2626,
            timestamp: new Date().toISOString(),
            fields: [
              {
                name: '🔧 goose prompt',
                value: goosePrompt.slice(0, 1024),
              },
            ],
          },
        ],
      }),
    })
  } catch (err) {
    console.error('Failed to send Dify chat alert to Discord:', err.message)
  }
}
