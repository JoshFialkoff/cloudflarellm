import { consumeDifySseLines } from './difySse'
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

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    sseBuffer = consumeDifySseLines(sseBuffer, decoder.decode(value, { stream: true }), {
      onAnswerDelta: (delta) => handlers?.onDelta?.(delta),
      onMeta: (meta) => {
        if (meta.conversationId) handlers?.onConversationId?.(meta.conversationId)
      },
      onError: (m) => handlers?.onStreamError?.(m),
      onEnd: () => {},
    })
  }

  if (sseBuffer.trim()) {
    consumeDifySseLines('', sseBuffer, {
      onAnswerDelta: (delta) => handlers?.onDelta?.(delta),
      onMeta: (meta) => {
        if (meta.conversationId) handlers?.onConversationId?.(meta.conversationId)
      },
      onError: (m) => handlers?.onStreamError?.(m),
    })
  }
}

export function normalizeAssistantHtml(raw) {
  return normalizeIfHtmlPageResponse(raw)
}
