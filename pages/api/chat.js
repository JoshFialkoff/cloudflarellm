import { normalizeDifyApiBaseUrl, resolveDifyServiceUrls } from '../../lib/difyEndpoints'
import { jsonUpstreamFailure } from '../../lib/upstreamError'
import { sendDifyChatAlert } from '../../lib/difyChatAlert'
import { buildInstantTop3SseChunks } from '../../lib/instantTop3Sse'

/** Fire alert in background for any Dify chat error (fire-and-forget). */
function alertDifyFailure({ error, status, attemptedUrl, mode, upstreamBody, query }) {
  sendDifyChatAlert({ error, status, attemptedUrl, mode, upstreamBody, query }).catch(() => {})
}

function isWorkflowMode() {
  const k = String(process.env.DIFY_APP_KIND || '').trim().toLowerCase()
  return k === 'workflow'
}

function workflowDefaultsFromEnv() {
  const raw = String(process.env.DIFY_WORKFLOW_EXTRA_INPUTS_JSON || '').trim()
  if (!raw) return {}
  try {
    const j = JSON.parse(raw)
    return typeof j === 'object' && j !== null && !Array.isArray(j) ? j : {}
  } catch {
    return {}
  }
}

/** Set SSE response headers for streaming. */
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

function writeSseEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
  flushSse(res)
}

function endSseError(res, message, hint) {
  writeSseEvent(res, { event: 'error', message, hint })
  res.end()
}

function beginSseStream(res, { statusMessage, preludeChunks = [] } = {}) {
  setStreamHeaders(res)
  res.status(200)
  if (typeof res.flushHeaders === 'function') res.flushHeaders()

  if (statusMessage) {
    writeSseEvent(res, { event: 'status', message: statusMessage })
  }

  if (Array.isArray(preludeChunks) && preludeChunks.length > 0) {
    for (const chunk of preludeChunks) {
      try {
        res.write(chunk)
        flushSse(res)
      } catch {
        break
      }
    }
  }
}

function buildSearchingStatusMessage(extraInputs) {
  const locationLabel =
    typeof extraInputs?.Location === 'string' && extraInputs.Location.trim()
      ? extraInputs.Location.trim()
      : ''

  return locationLabel
    ? `Searching Massachusetts facilities near ${locationLabel}…`
    : 'Searching Massachusetts facilities…'
}

/**
 * Pipe a Dify streaming response body to the client as SSE.
 * Forwards each raw SSE `data:` line verbatim, preserving all Dify event types
 * (including `node_finished` for knowledge-retrieval, which the client uses).
 *
 * Options:
 *   onErrorStatus(status, errText) — called when upstream returns an error
 */
async function pipeDifyStreamToClient(res, upstream, { onErrorStatus }) {
  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => upstream.statusText)
    onErrorStatus(upstream.status, errText)
    return false
  }


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

      // Process complete lines from the buffer
      let newlineIdx
      while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newlineIdx)
        buffer = buffer.slice(newlineIdx + 1)

        // Forward every complete line. SSE lines always end in \n, so
        // each data: line + trailing \n is written atomically.
        if (line.length > 0) {
          safeWrite(`${line}\n`)
        }
      }
    }

    // Flush remaining buffer
    if (buffer.length > 0) {
      safeWrite(buffer)
    }
  } catch (err) {
    if (!closed) {
      console.error('chat.js stream read error', err instanceof Error ? err.message : String(err))
      try { res.end() } catch { /* ignore */ }
    }
    return false
  } finally {
    if (!closed) {
      try { reader.cancel() } catch { /* ignore */ }
    }
  }

  if (!closed) {
    res.end()
  }
  return true
}

/**
 * Pipe Dify chat-messages in streaming mode.
 * Streams instant local facility data before the Dify response starts.
 */
async function pipeChatStream(req, res, { chatMessagesUrl, apiKey, query, user, conversationId, extraInputs }) {
  const statusMessage = buildSearchingStatusMessage(extraInputs)
  const preludeChunks = buildInstantTop3SseChunks(query, {
    ...extraInputs,
    Location: 'Massachusetts',
    monthly_budget: 5000,
  })

  beginSseStream(res, { statusMessage, preludeChunks })

  let upstream
  try {
    upstream = await fetch(chatMessagesUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: { Location: 'Massachusetts', monthly_budget: 5000, ...extraInputs },
        query,
        response_mode: 'streaming',
        conversation_id: conversationId,
        user,
      }),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    alertDifyFailure({ error: msg, status: 0, attemptedUrl: chatMessagesUrl, mode: 'chat', query })
    endSseError(res, 'Unable to reach AI service. Please try again.')
    return
  }

  const streamed = await pipeDifyStreamToClient(res, upstream, {
    onErrorStatus(status, errText) {
      alertDifyFailure({ status, attemptedUrl: chatMessagesUrl, mode: 'chat', upstreamBody: errText, query })
      const failed = jsonUpstreamFailure({
        status,
        attemptedUrl: chatMessagesUrl,
        mode: 'chat',
        upstreamBody: errText || upstream.statusText,
      })
      let message = 'Chat request failed.'
      let hint = ''
      try {
        const parsed = JSON.parse(failed.text)
        message = parsed.error || message
        hint = parsed.hint || ''
      } catch {
        message = failed.text || message
      }
      endSseError(res, message, hint)
    },
  })

  if (!streamed) {
    // pipeDifyStreamToClient already handled the error response
  }
}

/**
 * Pipe Dify workflows/run in streaming mode.
 */
async function pipeWorkflowStream(req, res, { workflowsRunUrl, apiKey, user, query, extraInputs }) {
  const inputKey = String(process.env.DIFY_WORKFLOW_INPUT_KEY || '').trim() || 'query'
  const inputs = {
    ...workflowDefaultsFromEnv(),
    ...extraInputs,
    [inputKey]: query,
  }

  const statusMessage = buildSearchingStatusMessage(extraInputs)
  const preludeChunks = buildInstantTop3SseChunks(query, {
    ...extraInputs,
    Location: 'Massachusetts',
    monthly_budget: 5000,
  })

  beginSseStream(res, { statusMessage, preludeChunks })

  let upstream
  try {
    upstream = await fetch(workflowsRunUrl, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
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
    alertDifyFailure({ error: msg, status: 0, attemptedUrl: workflowsRunUrl, mode: 'workflow', query })
    endSseError(res, 'Unable to reach AI service. Please try again.')
    return
  }

  const streamed = await pipeDifyStreamToClient(res, upstream, {
    onErrorStatus(status, errText) {
      alertDifyFailure({ status, attemptedUrl: workflowsRunUrl, mode: 'workflow', upstreamBody: errText, query })
      const failed = jsonUpstreamFailure({
        status,
        attemptedUrl: workflowsRunUrl,
        mode: 'workflow',
        upstreamBody: errText || upstream.statusText,
      })
      let message = 'Workflow request failed.'
      let hint = ''
      try {
        const parsed = JSON.parse(failed.text)
        message = parsed.error || message
        hint = parsed.hint || ''
      } catch {
        message = failed.text || message
      }
      endSseError(res, message, hint)
    },
  })

  if (!streamed) {
    // pipeDifyStreamToClient already handled the error response
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const baseRaw = normalizeDifyApiBaseUrl(
      String(process.env.DIFY_API_BASE_URL || 'https://dify.forwardjump.com/v1').replace(/\/$/, '')
    )
    const urls = resolveDifyServiceUrls(baseRaw)

    if (req.query?.probe === '1') {
      const apiKey = String(process.env.DIFY_API_KEY || '').replace(/^Bearer\s+/i, '').trim()
      if (!apiKey) {
        return res.status(503).json({ error: 'Missing DIFY_API_KEY for probe.' })
      }
      const probeRes = await fetch(urls.parameters, {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
      const text = await probeRes.text()
      try {
        const payload = JSON.parse(text)
        return res.status(probeRes.ok ? 200 : probeRes.status).json({
          ok: probeRes.ok,
          parametersUrl: urls.parameters,
          upstreamStatus: probeRes.status,
          payload,
        })
      } catch {
        alertDifyFailure({ status: probeRes.status, attemptedUrl: urls.parameters, mode: 'probe', upstreamBody: text })
        return res.status(502).json({
          error: 'Non-JSON from parameters endpoint',
          parametersUrl: urls.parameters,
          upstreamStatus: probeRes.status,
          bodyPreview: text.slice(0, 600),
        })
      }
    }

    return res.status(200).json({
      ok: true,
      route: '/api/chat',
      difyAppKind: isWorkflowMode() ? 'workflow' : 'chat',
      difyApiBaseUrl: baseRaw,
      resolvedChatMessagesUrl: urls.chatMessages,
      resolvedWorkflowsRunUrl: urls.workflowsRun,
      resolvedParametersUrl: urls.parameters,
      hasDifyApiKey: Boolean(String(process.env.DIFY_API_KEY || '').trim()),
      workflowInputKey: String(process.env.DIFY_WORKFLOW_INPUT_KEY || '').trim() || 'query',
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = String(process.env.DIFY_API_KEY || '').replace(/^Bearer\s+/i, '').trim()
  const baseRaw = normalizeDifyApiBaseUrl(
    String(process.env.DIFY_API_BASE_URL || 'https://dify.forwardjump.com/v1').replace(/\/$/, '')
  )
  const { chatMessages, workflowsRun } = resolveDifyServiceUrls(baseRaw)

  if (!apiKey) {
    return res.status(503).json({ error: 'Missing DIFY_API_KEY on the server.' })
  }

  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : ''
  if (!query) {
    return res.status(400).json({ error: 'Field "query" is required.' })
  }

  const user = typeof req.body?.user === 'string' && req.body.user ? req.body.user : 'anonymous'
  const conversationId =
    typeof req.body?.conversation_id === 'string' ? req.body.conversation_id : ''
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
