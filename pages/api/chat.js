import { normalizeDifyApiBaseUrl, resolveDifyServiceUrls } from '../../lib/difyEndpoints'
import { extractAnswerFromDifySseText } from '../../lib/difySse'
import { formatWorkflowOutputs, extractWorkflowOutputs } from '../../lib/formatWorkflowOutputs'
import { handleNativeFastTop3Chat, shouldUseNativeFastTop3Chat } from '../../lib/nativeFastTop3Chat'
import { normalizeDifyChatInputs } from '../../lib/normalizeDifyInputs'
import { singleAnswerSseStream } from '../../lib/singleAnswerSse'
import { jsonUpstreamFailure } from '../../lib/upstreamError'
import { captureAiGeneration, flushPosthogServer } from '../../lib/posthogServer'

const DEFAULT_DIFY_API_BASE_URL = 'https://dify.forwardjump.com/v1'

function isWorkflowMode() {
  const k = String(process.env.DIFY_APP_KIND || '').trim().toLowerCase()
  return k === 'workflow' || Boolean(String(process.env.DIFY_WORKFLOW_API_KEY || '').trim())
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

function extractReplyFromDifyJson(json, isWorkflow) {
  if (isWorkflow) {
    return formatWorkflowOutputs(extractWorkflowOutputs(json))
  }
  return typeof json?.answer === 'string' ? json.answer : ''
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

async function writeReadableStream(res, stream) {
  const reader = stream.getReader()
  try {
    let chunk = await reader.read()
    while (!chunk.done) {
      res.write(Buffer.from(chunk.value))
      chunk = await reader.read()
    }
  } catch {
    // stream interrupted - client disconnected
  } finally {
    res.end()
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      route: '/api/chat',
      engine: shouldUseNativeFastTop3Chat() ? 'native-fast-top-3' : 'dify',
    })
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST')
    return res.status(405).json({ error: 'Method not allowed' })
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

  const { inputs: difyInputs, missing: missingInputs } = normalizeDifyChatInputs(extraInputs)
  if (missingInputs.length > 0) {
    return res.status(400).json({
      error: `Missing required input${missingInputs.length > 1 ? 's' : ''}: ${missingInputs.join(', ')}.`,
      hint: 'AssistedlyWizard must send Location and monthly_budget before calling /api/chat.',
    })
  }

  if (shouldUseNativeFastTop3Chat()) {
    return handleNativeFastTop3Chat(req, res, { query, inputs: difyInputs })
  }

  const isWorkflow = isWorkflowMode()
  const workflowApiKey = String(process.env.DIFY_WORKFLOW_API_KEY || '')
    .replace(/^Bearer\s+/i, '')
    .trim()
  const apiKey = String(
    (isWorkflow && workflowApiKey) ? workflowApiKey : (process.env.DIFY_API_KEY || '')
  )
    .replace(/^Bearer\s+/i, '')
    .trim()
  const baseRaw = normalizeDifyApiBaseUrl(
    String(process.env.DIFY_API_BASE_URL || DEFAULT_DIFY_API_BASE_URL).replace(/\/$/, '')
  )
  if (!baseRaw) {
    return res.status(503).json({ error: 'DIFY_API_BASE_URL is not configured on the server.' })
  }
  const { chatMessages, workflowsRun } = resolveDifyServiceUrls(baseRaw)

  if (!apiKey) {
    return res.status(503).json({
      error: `Missing ${isWorkflow ? 'DIFY_WORKFLOW_API_KEY or DIFY_API_KEY' : 'DIFY_API_KEY'} on the server.`,
      hint: 'Set CHAT_ENGINE=native and OPENAI_API_KEY to run without Dify.',
    })
  }

  const url = isWorkflow ? workflowsRun : chatMessages

  let body
  if (isWorkflow) {
    const inputKey = String(process.env.DIFY_WORKFLOW_INPUT_KEY || '').trim() || 'query'
    const inputs = {
      ...workflowDefaultsFromEnv(),
      ...difyInputs,
      [inputKey]: query,
    }
    body = JSON.stringify({ inputs, response_mode: 'streaming', user })
  } else {
    body = JSON.stringify({
      inputs: difyInputs,
      query,
      response_mode: 'streaming',
      conversation_id: conversationId,
      user,
    })
  }

  let upstream
  try {
    upstream = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body,
    })
  } catch (error) {
    console.error('Dify upstream transport failed', {
      attemptedUrl: url,
      mode: isWorkflow ? 'workflow' : 'chat',
      error: error instanceof Error ? error.message : String(error),
    })
    return res.status(502).json({
      error: `Unable to reach Dify ${isWorkflow ? 'workflow' : 'chat'} endpoint.`,
      hint: 'Check DIFY_API_BASE_URL, network egress, DNS, and TLS connectivity to Dify.',
    })
  }

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

  const upstreamContentType = upstream.headers.get('Content-Type') || ''
  if (!upstream.body) {
    return res.status(502).json({
      error: `Dify ${isWorkflow ? 'workflow' : 'chat'} response had no body.`,
      hint: 'Check Dify app logs and response mode configuration.',
    })
  }
  setStreamHeaders(res)
  res.status(200)
  if (typeof res.flushHeaders === 'function') res.flushHeaders()

  const aiStartedAt = Date.now()
  const reportDifyGeneration = async () => {
    captureAiGeneration(user, {
      $ai_trace_id: conversationId || user,
      $ai_model: isWorkflow ? 'dify-workflow' : 'dify-chat',
      $ai_provider: 'dify',
      $ai_latency: (Date.now() - aiStartedAt) / 1000,
      $ai_base_url: baseRaw,
      care_type: difyInputs?.care_type,
      chat_engine: 'dify',
    })
    await flushPosthogServer()
  }

  if (upstreamContentType.includes('text/event-stream')) {
    await writeReadableStream(res, upstream.body)
    await reportDifyGeneration()
    return
  }

  const upstreamText = await upstream.text()
  let answer = ''
  let convId = ''
  let msgId = ''

  try {
    const json = JSON.parse(upstreamText)
    answer = extractReplyFromDifyJson(json, isWorkflow)
    convId = typeof json.conversation_id === 'string' ? json.conversation_id : ''
    msgId = typeof json.message_id === 'string' ? json.message_id : ''
  } catch {
    const extracted = extractAnswerFromDifySseText(upstreamText)
    answer = extracted.workflowOutputs != null
      ? formatWorkflowOutputs(extracted.workflowOutputs)
      : extracted.answer
    convId = extracted.conversationId
    msgId = extracted.messageId
  }

  if (!String(answer || '').trim()) {
    res.write(
      `data: ${JSON.stringify({ event: 'error', message: 'Dify finished but answer was empty.' })}\n\n`
    )
    res.end()
    return
  }

  await writeReadableStream(
    res,
    singleAnswerSseStream(answer, {
      conversationId: convId || undefined,
      messageId: msgId || undefined,
    })
  )
  await reportDifyGeneration()
}
