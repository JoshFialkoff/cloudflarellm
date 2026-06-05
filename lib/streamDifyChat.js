import { consumeDifySseLines, extractAnswerFromDifySseText } from './difySse'
import { formatWorkflowOutputs } from './formatWorkflowOutputs'
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

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const decoded = decoder.decode(value, { stream: true })
    rawStreamText += decoded
    console.log('Raw decoded chunk:', decoded)
    sseBuffer = consumeDifySseLines(sseBuffer, decoded, {
      onAnswerDelta: (delta) => {
        sawDelta = true
        console.log('Delta received:', delta)
        handlers?.onDelta?.(delta)
      },
      onMeta: (meta) => {
        console.log('Meta received:', meta)
        if (meta.conversationId) handlers?.onConversationId?.(meta.conversationId)
      },
      onError: (m) => {
        console.error('SSE Error:', m)
        handlers?.onStreamError?.(m)
      },
      onEnd: () => {
        console.log('SSE stream ended (consumed)')
      },
    })
  }

  console.log('Finished reading stream. Raw text:', rawStreamText)

  if (sseBuffer.trim()) {
    console.log('Processing remaining SSE buffer:', sseBuffer)
    consumeDifySseLines('', sseBuffer, {
      onAnswerDelta: (delta) => {
        sawDelta = true
        console.log('Delta received:', delta)
        handlers?.onDelta?.(delta)
      },
      onMeta: (meta) => {
        console.log('Meta received:', meta)
        if (meta.conversationId) handlers?.onConversationId?.(meta.conversationId)
      },
      onError: (m) => {
        console.error('SSE Error:', m)
        handlers?.onStreamError?.(m)
      },
      onEnd: () => {
        console.log('SSE stream ended (consumed)')
      },
    })
  }

  if (!sawDelta && rawStreamText.trim()) {
    console.log('No delta saw, attempting fallback extraction.')
    const extracted = extractAnswerFromDifySseText(rawStreamText)
    console.log('Extracted fallback:', extracted)
    const fallbackText =
      extracted.answer ||
      (extracted.workflowOutputs ? formatWorkflowOutputs(extracted.workflowOutputs) : '')

    if (fallbackText) {
      handlers?.onDelta?.(fallbackText)
      if (extracted.conversationId) handlers?.onConversationId?.(extracted.conversationId)
    }
  }
}

export function normalizeAssistantHtml(raw) {
  return normalizeIfHtmlPageResponse(raw)
}
