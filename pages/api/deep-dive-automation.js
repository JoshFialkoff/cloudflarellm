import { normalizeDifyApiBaseUrl, resolveDifyServiceUrls } from '../../lib/difyEndpoints'
import { jsonUpstreamFailure } from '../../lib/upstreamError'

function isWorkflowMode() {
  const k = String(process.env.DEEP_DIVE_AUTOMATION_DIFY_APP_KIND || 'workflow').trim().toLowerCase()
  return k === 'workflow'
}

function workflowDefaultsFromEnv() {
  const raw = String(process.env.DEEP_DIVE_AUTOMATION_WORKFLOW_DEFAULTS_JSON || '').trim()
  if (!raw) return {}
  try {
    const j = JSON.parse(raw)
    return typeof j === 'object' && j !== null && !Array.isArray(j) ? j : {}
  } catch {
    return {}
  }
}

function setStreamHeaders(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, no-transform')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('CDN-Cache-Control', 'no-store')
  res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store')
  res.setHeader('X-Accel-Buffering', 'no')
  res.setHeader('Connection', 'keep-alive')
}

function flushSse(res) {
  if (typeof res.flush === 'function') res.flush()
}

async function pipeDifyStreamToClient(res, upstream, { onErrorStatus }) {
  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => upstream.statusText)
    onErrorStatus(upstream.status, errText)
    return false
  }
  setStreamHeaders(res)
  res.status(200)
  if (typeof res.flushHeaders === 'function') res.flushHeaders()
  const reader = upstream.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let closed = false
  function safeWrite(chunk) {
    if (closed) return
    try {
      res.write(chunk)
      flushSse(res)
    } catch {
      closed = true
    }
  }
  try {
    while (!closed) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let newlineIdx
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx)
        buffer = buffer.slice(newlineIdx + 1)
        if (line.length > 0) safeWrite(`${line}\n`)
      }
    }
    if (buffer.length > 0) safeWrite(buffer)
  } catch (err) {
    if (!closed) {
      console.error('deep-dive-automation stream read error', err instanceof Error ? err.message : String(err))
      try { res.end() } catch { }
    }
    return false
  } finally {
    if (!closed) {
      try { reader.cancel() } catch { }
    }
  }
  if (!closed) res.end()
  return true
}

async function pipeWorkflowStream(req, res, { workflowsRunUrl, apiKey, user, query, extraInputs }) {
  const inputKey = String(process.env.DEEP_DIVE_AUTOMATION_WORKFLOW_INPUT_KEY || '').trim() || 'query'
  const inputs = {
    ...workflowDefaultsFromEnv(),
    ...extraInputs,
    [inputKey]: query,
  }
  let upstream
  try {
    upstream = await fetch(workflowsRunUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs,
        response_mode: 'streaming',
        user,
      }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(502).json({ error: 'Unable to reach AI service. Please try again.' })
    return
  }
  await pipeDifyStreamToClient(res, upstream, {
    onErrorStatus(status, errText) {
      const failed = jsonUpstreamFailure({
        status,
        attemptedUrl: workflowsRunUrl,
        mode: 'workflow',
        upstreamBody: errText || upstream.statusText,
      })
      res.status(failed.status)
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(failed.text ? failed.text : JSON.stringify({ error: 'Workflow request failed.' }))
    },
  })
}

async function pipeChatStream(req, res, { chatMessagesUrl, apiKey, query, user, conversationId, extraInputs }) {
  let upstream
  try {
    upstream = await fetch(chatMessagesUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: extraInputs,
        query,
        response_mode: 'streaming',
        conversation_id: conversationId,
        user,
      }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    res.status(502).json({ error: 'Unable to reach AI service. Please try again.' })
    return
  }
  await pipeDifyStreamToClient(res, upstream, {
    onErrorStatus(status, errText) {
      const failed = jsonUpstreamFailure({
        status,
        attemptedUrl: chatMessagesUrl,
        mode: 'chat',
        upstreamBody: errText || upstream.statusText,
      })
      res.status(failed.status)
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(failed.text ? failed.text : JSON.stringify({ error: 'Chat request failed.' }))
    },
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = String(process.env.DEEP_DIVE_AUTOMATION_DIFY_API_KEY || '').replace(/^Bearer\s+/i, '').trim()
  const baseRaw = normalizeDifyApiBaseUrl(
    String(process.env.DEEP_DIVE_AUTOMATION_DIFY_API_BASE_URL || 'https://dify.forwardjump.com/v1').replace(/\/$/, '')
  )
  const { chatMessages, workflowsRun } = resolveDifyServiceUrls(baseRaw)

  if (!apiKey) {
    return res.status(503).json({ error: 'Missing DEEP_DIVE_AUTOMATION_DIFY_API_KEY on the server.' })
  }

  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
  if (!query) {
    return res.status(400).json({ error: 'Field "query" is required.' })
  }

  const user = typeof req.body?.user === 'string' && req.body.user ? req.body.user : 'anonymous'
  const conversationId = typeof req.body?.conversation_id === 'string' ? req.body.conversation_id : ''
  const extraInputs =
    req.body?.inputs && typeof req.body.inputs === 'object' && !Array.isArray(req.body.inputs)
      ? req.body.inputs
      : {}

  if (isWorkflowMode()) {
    await pipeWorkflowStream(req, res, {
      workflowsRunUrl: workflowsRun,
      apiKey,
      user,
      query,
      extraInputs,
    })
    return
  }

  await pipeChatStream(req, res, {
    chatMessagesUrl: chatMessages,
    apiKey,
    query,
    user,
    conversationId,
    extraInputs,
  })
}
