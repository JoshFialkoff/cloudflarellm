import { consumeDifySseLines, extractAnswerFromDifySseText } from './difySse'
import { facilitiesFromKbRetrievalResult } from './difyKbFacilities'
import { formatWorkflowOutputs } from './formatWorkflowOutputs'
import { normalizeFastTop3AnswerIntro } from './fastTop3WorkflowConfig'
import { normalizeIfHtmlPageResponse } from './htmlToReadable'

export async function streamDifyChatResponse(
  query,
  userId,
  conversationId,
  handlers,
  extraWorkflowInputs
) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      user: userId,
      conversation_id: conversationId,
      ...(extraWorkflowInputs && Object.keys(extraWorkflowInputs).length > 0
        ? { inputs: extraWorkflowInputs }
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

  const consumeHandlers = {
    onAnswerDelta: (delta) => {
      sawDelta = true
      handlers?.onDelta?.(delta)
    },
    onMeta: (meta) => {
      if (meta.conversationId) handlers?.onConversationId?.(meta.conversationId)
    },
    onError: (m) => {
      handlers?.onStreamError?.(m)
    },
    onKbRetrieval: (result) => {
      kbFacilities = facilitiesFromKbRetrievalResult(result)
      if (kbFacilities.length > 0) handlers?.onKbFacilities?.(kbFacilities)
    },
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const decoded = decoder.decode(value, { stream: true })
    rawStreamText += decoded
    sseBuffer = consumeDifySseLines(sseBuffer, decoded, consumeHandlers)
  }

  if (sseBuffer.trim()) {
    consumeDifySseLines('', sseBuffer, consumeHandlers)
  }

  if (kbFacilities.length === 0) {
    kbFacilities = facilitiesFromKbRetrievalResult(
      extractKbRetrievalFromRawSse(rawStreamText)
    )
  }

  const extracted = extractAnswerFromDifySseText(rawStreamText)
  const workflowAnswer = extracted.workflowOutputs
    ? formatWorkflowOutputs(extracted.workflowOutputs)
    : ''

  const streamDeltaAnswer = typeof extracted.answer === 'string' ? extracted.answer.trim() : ''
  const mergedAnswer = (workflowAnswer || streamDeltaAnswer || '').trim()

  if (mergedAnswer) {
    const normalized = normalizeFastTop3AnswerIntro(mergedAnswer)
    handlers?.onFinal?.(normalized)
    if (extracted.conversationId) handlers?.onConversationId?.(extracted.conversationId)
    return { answer: normalized.trim(), kbFacilities }
  }

  if (sawDelta && streamDeltaAnswer) {
    const normalized = normalizeFastTop3AnswerIntro(streamDeltaAnswer)
    handlers?.onFinal?.(normalized)
    if (extracted.conversationId) handlers?.onConversationId?.(extracted.conversationId)
    return { answer: normalized.trim(), kbFacilities }
  }

  if (rawStreamText.trim()) {
    const plainFallback = normalizeFromRawSsePayload(rawStreamText)
    if (plainFallback) {
      const normalized = normalizeFastTop3AnswerIntro(plainFallback)
      handlers?.onFinal?.(normalized)
      if (extracted.conversationId) handlers?.onConversationId?.(extracted.conversationId)
      return { answer: normalized.trim(), kbFacilities }
    }
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
