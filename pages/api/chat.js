import { normalizeDifyApiBaseUrl, resolveDifyServiceUrls } from '../../lib/difyEndpoints'
import { jsonUpstreamFailure } from '../../lib/upstreamError'

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

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const baseRaw = normalizeDifyApiBaseUrl(
      String(process.env.DIFY_API_BASE_URL || '').replace(/\/$/, '')
    )
    if (!baseRaw) {
      return res.status(503).json({ error: 'DIFY_API_BASE_URL is not configured on the server.' })
    }
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
    String(process.env.DIFY_API_BASE_URL || '').replace(/\/$/, '')
  )
  if (!baseRaw) {
    return res.status(503).json({ error: 'DIFY_API_BASE_URL is not configured on the server.' })
  }
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

  const isWorkflow = isWorkflowMode()
  const url = isWorkflow ? workflowsRun : chatMessages

  let body
  if (isWorkflow) {
    const inputKey = String(process.env.DIFY_WORKFLOW_INPUT_KEY || '').trim() || 'query'
    const inputs = {
      ...workflowDefaultsFromEnv(),
      ...extraInputs,
      [inputKey]: query,
    }
    body = JSON.stringify({ inputs, response_mode: 'streaming', user })
  } else {
    body = JSON.stringify({
      inputs: extraInputs,
      query,
      response_mode: 'streaming',
      conversation_id: conversationId,
      user,
    })
  }

  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
  })

  if (!upstream.ok) {
    const upstreamText = await upstream.text()
    const failed = jsonUpstreamFailure({
      status: upstream.status,
      attemptedUrl: url,
      mode: isWorkflow ? 'workflow' : 'chat',
      upstreamBody: upstreamText || upstream.statusText,
    })
    res.status(failed.status)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(await failed.text())
    return
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.status(200)

  const reader = upstream.body.getReader()
  try {
    let chunk = await reader.read()
    while (!chunk.done) {
      res.write(Buffer.from(chunk.value))
      chunk = await reader.read()
    }
  } catch {
    // stream interrupted — client disconnected
  } finally {
    res.end()
  }
}
