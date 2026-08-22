#!/usr/bin/env node
/**
 * Discord ops Q&A bot for Racknerd server management + codebase knowledge.
 *
 * Usage:
 *   cd scripts/discord-ops-bot
 *   npm install
 *   DISCORD_BOT_TOKEN=xxx node ops-bot.js
 *
 * Env:
 *   DISCORD_BOT_TOKEN           Required.
 *   DISCORD_APPROVAL_CHANNEL_ID Optional. Reply to every message in this channel.
 */

const { Client, GatewayIntentBits, Partials } = require('discord.js')
const { route } = require('./intent-router')

const TOKEN = process.env.DISCORD_BOT_TOKEN || ''
const APPROVAL_CHANNEL_ID = process.env.DISCORD_APPROVAL_CHANNEL_ID || ''

if (!TOKEN) {
  console.error('Missing DISCORD_BOT_TOKEN. Set it in your environment or .env file.')
  process.exit(1)
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message],
})

function shouldReply(message) {
  if (message.author.bot) return false
  const isDM = message.channel.isDMBased?.()
  const isMentioned = message.mentions.has(client.user)
  const isApprovalChannel = APPROVAL_CHANNEL_ID && message.channelId === APPROVAL_CHANNEL_ID
  const text = message.content.toLowerCase()
  const meName = client.user?.username?.toLowerCase() || ''
  return isDM || isMentioned || isApprovalChannel || text.includes('ops bot') || (meName && text.includes(meName))
}

function splitForDiscord(text, maxLen = 1950) {
  if (text.length <= maxLen) return [text]
  const chunks = []
  let rest = text
  while (rest.length) {
    if (rest.length <= maxLen) { chunks.push(rest); break }
    let slice = rest.slice(0, maxLen)
    const nl = slice.lastIndexOf('\n')
    if (nl > maxLen * 0.6) slice = slice.slice(0, nl)
    chunks.push(slice.trimEnd())
    rest = rest.slice(slice.length).trimStart()
  }
  return chunks
}

client.on('clientReady', () => {
  console.log(`Ops bot logged in as ${client.user.tag}`)
  console.log(`Channels: ${client.channels.cache.size} cached`)
  if (APPROVAL_CHANNEL_ID) {
    const ch = client.channels.cache.get(APPROVAL_CHANNEL_ID)
    console.log(`Approval channel: #${ch?.name || 'unknown'} (${APPROVAL_CHANNEL_ID})`)
  }
})

client.on('messageCreate', async (message) => {
  if (!shouldReply(message)) return

  const text = message.content.replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '').trim()
  if (!text) {
    await message.reply('👋 Ask me about your Racknerd servers, this codebase, or Dify.')
    return
  }

  try {
    const response = route(text)
    const chunks = splitForDiscord(response.content)
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      if (i === 0) {
        await message.reply(chunk)
      } else {
        await message.channel.send(chunk)
      }
    }
  } catch (err) {
    console.error('Reply error:', err)
    await message.reply('❌ Something went wrong processing your question.')
  }
})

client.on('error', (err) => {
  console.error('Discord client error:', err)
})

client.login(TOKEN).catch((err) => {
  console.error('Login failed:', err.message)
  process.exit(1)
})
