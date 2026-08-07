import { consumeDifySseLines, extractAnswerFromDifySseText } from './difySse'
import { facilitiesFromKbRetrievalResult } from './difyKbFacilities'
import { formatWorkflowOutputs } from './formatWorkflowOutputs'
import { normalizeFastTop3AnswerIntro } from './fastTop3WorkflowConfig'
import { normalizeIfHtmlPageResponse } from './htmlToReadable'
import { sanitize } from './security/sanitizer.js'

export async function streamDifyChatResponse(
  query,
  userId,
  conversationId,
  handlers,
  extraWorkflowInputs,
  endpoint = '/api/chat'
) {
  const safeQuery = sanitize(query || '')
  const safeInputs = sanitize(extraWorkflowInputs || {})
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: safeQuery,
      user: userId,
      conversation_id: conversationId,
      ...(safeInputs && Object.keys(safeInputs).length > 0
        ? { inputs: safeInputs }
        : {}),
    }),
  })

  if (!res.ok) {
    const errText = await res.text()
    let msg = `Request failed (${res.status})`
    try {
      const j = JSON.parse(errText)
      const parts = [j.error || j.message, j.hint].filter(Boolean)
      msg = parts.length ? parts.join(' - ') : msg
    } catch {
      if (errText) msg = errText.slice(0, 500)
    }
    throw new Error(msg)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response stream.')

  const decoder = new TextDecoder()
  let sseBuffer = ''
  let rawStreamText = ''
  let sawDelta = false
  let kbFacilities = []
  let accumulatedAnswer = ''
  let streamEnded = false
  let convId = ''
  let workflowOutputs = null

  const consumeHandlers = {
    onAnswerDelta: (delta) => {
      sawDelta = true
      accumulatedAnswer += delta
      handlers?.onDelta?.(delta)
    },
    onMeta: (meta) => {
      if (meta.conversationId) {
        convId = meta.conversationId
        handlers?.onConversationId?.(meta.conversationId)
      }
    },
    onError: (m) => {
      handlers?.onStreamError?.(m)
    },
    onStatus: (message) => {
      handlers?.onStatus?.(message)
    },
    onKbRetrieval: (result) => {
      kbFacilities = facilitiesFromKbRetrievalResult(result)
      if (kbFacilities.length > 0) handlers?.onKbFacilities?.(kbFacilities)
    },
    onEnd: () => {
      streamEnded = true
    },
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const decoded = decoder.decode(value, { stream: true })
    rawStreamText += decoded
    sseBuffer = consumeDifySseLines(sseBuffer, decoded, consumeHandlers)
  }

  // Flush any remaining buffer
  if (sseBuffer.trim()) {
    consumeDifySseLines('', sseBuffer, consumeHandlers)
  }

  // If we didn't get KB facilities from streaming events, try extracting from raw SSE
  if (kbFacilities.length === 0) {
    kbFacilities = facilitiesFromKbRetrievalResult(
      extractKbRetrievalFromRawSse(rawStreamText)
    )
  }

  // Try to extract workflow outputs from raw SSE for the final answer
  const extracted = extractAnswerFromDifySseText(rawStreamText)
  if (extracted.workflowOutputs) {
    workflowOutputs = extracted.workflowOutputs
  }

  // Determine the final answer:
  // 1. Workflow outputs (if present)
  // 2. Deltas accumulated during streaming (most common path)
  // 3. Raw SSE fallback parsing
  let finalAnswer = ''

  if (workflowOutputs) {
    finalAnswer = formatWorkflowOutputs(workflowOutputs)
  }

  if (!finalAnswer && accumulatedAnswer.trim()) {
    finalAnswer = accumulatedAnswer.trim()
  }

  if (!finalAnswer) {
    const streamDeltaAnswer = typeof extracted.answer === 'string' ? extracted.answer.trim() : ''
    if (streamDeltaAnswer) {
      finalAnswer = streamDeltaAnswer
    }
  }

  if (!finalAnswer) {
    const plainFallback = normalizeFromRawSsePayload(rawStreamText)
    if (plainFallback) {
      finalAnswer = plainFallback
    }
  }

  if (finalAnswer) {
    const normalized = normalizeFastTop3AnswerIntro(finalAnswer)
    handlers?.onFinal?.(normalized)
    // Use the conversation ID from streaming meta, or fall back to extracted
    const cid = convId || extracted.conversationId
    if (cid) handlers?.onConversationId?.(cid)
    return { answer: normalized.trim(), kbFacilities }
  }

  return { answer: '', kbFacilities }
}

function extractKbRetrievalFromRawSse(sseText) {
  for (const line of String(sseText || '').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue
    try {
      const data = JSON.parse(trimmed.slice(5).trim())
      if (
        data?.event === 'node_finished' &&
        data?.data?.node_type === 'knowledge-retrieval' &&
        Array.isArray(data?.data?.outputs?.result)
      ) {
        return data.data.outputs.result
      }
    } catch {
      // ignore malformed SSE lines
    }
  }
  return []
}

function normalizeFromRawSsePayload(sseText) {
  const chunks = []

  for (const line of String(sseText || '').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('data:')) continue

    const payload = trimmed.slice(5).trim()
    if (!payload || payload === '[DONE]') continue

    try {
      const data = JSON.parse(payload)

      const directAnswer =
        typeof data?.answer === 'string'
          ? data.answer
          : typeof data?.data?.answer === 'string'
            ? data.data.answer
            : ''
      if (directAnswer.trim()) chunks.push(directAnswer.trim())

      const textField =
        typeof data?.text === 'string'
          ? data.text
          : typeof data?.data?.text === 'string'
            ? data.data.text
            : ''
      if (textField.trim()) chunks.push(textField.trim())

      const workflowText =
        typeof data?.data?.outputs?.text === 'string'
          ? data.data.outputs.text
          : typeof data?.data?.outputs?.answer === 'string'
            ? data.data.outputs.answer
            : ''
      if (workflowText.trim()) chunks.push(workflowText.trim())
    } catch {
      // ignore malformed/non-JSON lines
    }
  }

  if (chunks.length === 0) return ''
  const joined = chunks.join('\n').trim()
  return joined ? normalizeIfHtmlPageResponse(joined).trim() : ''
}

export function normalizeAssistantHtml(raw) {
  return normalizeIfHtmlPageResponse(raw)
}
