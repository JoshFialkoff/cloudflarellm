import { normalizeDifyApiBaseUrl, resolveDifyServiceUrls } from '../../lib/difyEndpoints'
import { extractWorkflowOutputs, formatWorkflowOutputs } from '../../lib/formatWorkflowOutputs'
import { singleAnswerSseStream } from '../../lib/singleAnswerSse'
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

async function runWorkflowBlocking({ workflowsRunUrl, apiKey, user, query, extraInputs }) {
  const inputKey = String(process.env.DIFY_WORKFLOW_INPUT_KEY || '').trim() || 'query'
  const inputs = {
    ...workflowDefaultsFromEnv(),
    ...extraInputs,
    [inputKey]: query,
  }

  const res = await fetch(workflowsRunUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs,
      response_mode: 'blocking',
      user,
    }),
  })

  const text = await res.text()
  if (!res.ok) {
    return jsonUpstreamFailure({
      status: res.status,
      attemptedUrl: workflowsRunUrl,
      mode: 'workflow',
      upstreamBody: text || res.statusText,
    })
  }

  let json
  try {
    json = JSON.parse(text)
  } catch {
    return new Response(JSON.stringify({ error: 'Workflow returned non-JSON response.' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  const data = json?.data
  const status = typeof data?.status === 'string' ? data.status : ''
  if (status && status !== 'succeeded') {
    const errMsg =
      (typeof data?.error === 'string' && data.error) ||
      (typeof json?.message === 'string' && json.message) ||
      `Workflow status: ${status}`
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    })
  }

  const rawOutputs = extractWorkflowOutputs(json)
  const reply = formatWorkflowOutputs(rawOutputs)

  if (!String(reply || '').trim()) {
    return new Response(
      JSON.stringify({
        error:
          'Workflow finished but outputs were empty. Check Dify workflow end node outputs and DIFY_WORKFLOW_INPUT_KEY.',
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    )
  }

  return new Response(singleAnswerSseStream(reply), {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const baseRaw = normalizeDifyApiBaseUrl(
      String(process.env.DIFY_API_BASE_URL || 'https://dify.forwardjump.com/api/v1').replace(/\/$/, '')
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
    String(process.env.DIFY_API_BASE_URL || 'https://dify.forwardjump.com/api/v1').replace(/\/$/, '')
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
    const workflowResponse = await runWorkflowBlocking({
      workflowsRunUrl: workflowsRun,
      apiKey,
      user,
      query,
      extraInputs,
    })

    res.setHeader('Content-Type', workflowResponse.headers.get('Content-Type') || 'text/plain')
    res.setHeader('Cache-Control', workflowResponse.headers.get('Cache-Control') || 'no-store')
    if (workflowResponse.headers.get('Connection')) {
      res.setHeader('Connection', workflowResponse.headers.get('Connection'))
    }
    res.statusCode = workflowResponse.status
    const text = await workflowResponse.text()
    res.end(text)
    return
  }

  const upstream = await fetch(chatMessages, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: extraInputs,
      query,
      response_mode: 'blocking',
      conversation_id: conversationId,
      user,
    }),
  })

  const upstreamText = await upstream.text()
  if (!upstream.ok) {
    const failed = jsonUpstreamFailure({
      status: upstream.status,
      attemptedUrl: chatMessages,
      mode: 'chat',
      upstreamBody: upstreamText || upstream.statusText,
    })
    res.status(failed.status)
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    res.end(await failed.text())
    return
  }

  let json
  try {
    json = JSON.parse(upstreamText)
  } catch {
    return res.status(502).json({ error: 'Chat returned non-JSON response.' })
  }

  const answer = typeof json.answer === 'string' ? json.answer : ''
  if (!answer.trim()) {
    return res.status(502).json({ error: 'Chat finished but answer was empty.' })
  }

  const sseResponse = new Response(
    singleAnswerSseStream(answer, {
      conversationId: typeof json.conversation_id === 'string' ? json.conversation_id : undefined,
      messageId: typeof json.message_id === 'string' ? json.message_id : undefined,
    }),
    {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    }
  )

  res.setHeader('Content-Type', sseResponse.headers.get('Content-Type'))
  res.setHeader('Cache-Control', sseResponse.headers.get('Cache-Control'))
  res.setHeader('Connection', sseResponse.headers.get('Connection'))
  res.status(200)
  res.end(await sseResponse.text())
}
