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
    sseBuffer = consumeDifySseLines(sseBuffer, decoded, {
      onAnswerDelta: (delta) => {
        sawDelta = true
        handlers?.onDelta?.(delta)
      },
      onMeta: (meta) => {
        if (meta.conversationId) handlers?.onConversationId?.(meta.conversationId)
      },
      onError: (m) => handlers?.onStreamError?.(m),
      onEnd: () => {},
    })
  }

  if (sseBuffer.trim()) {
    consumeDifySseLines('', sseBuffer, {
      onAnswerDelta: (delta) => {
        sawDelta = true
        handlers?.onDelta?.(delta)
      },
      onMeta: (meta) => {
        if (meta.conversationId) handlers?.onConversationId?.(meta.conversationId)
      },
      onError: (m) => handlers?.onStreamError?.(m),
    })
  }

  if (!sawDelta && rawStreamText.trim()) {
    const extracted = extractAnswerFromDifySseText(rawStreamText)
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
