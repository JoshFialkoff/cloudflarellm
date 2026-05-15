export function consumeDifySseLines(buffer, textChunk, handlers) {
  const combined = `${buffer || ''}${textChunk || ''}`
  const lines = combined.split('\n')
  const endsWithNewline = combined.endsWith('\n')
  const remainder = endsWithNewline ? '' : lines.pop() || ''

  for (const line of lines) {
    const data = parseEventPayload(line)
    if (!data) continue

    const event = typeof data.event === 'string' ? data.event : ''

    if (event === 'error') {
      const msg =
        typeof data.message === 'string'
          ? data.message
          : typeof data.code === 'string'
            ? data.code
            : 'Dify stream error'
      handlers?.onError?.(msg)
      continue
    }

    if (
      (event === 'message' || event === 'agent_message') &&
      typeof data.answer === 'string' &&
      data.answer.length > 0
    ) {
      handlers?.onAnswerDelta?.(data.answer)
    }

    const meta = {}
    if (typeof data.conversation_id === 'string') {
      meta.conversationId = data.conversation_id
    }
    if (typeof data.message_id === 'string') {
      meta.messageId = data.message_id
    }
    if (meta.conversationId || meta.messageId) {
      handlers?.onMeta?.(meta)
    }

    if (event === 'message_end') {
      handlers?.onEnd?.()
    }
  }

  return remainder
}

function parseEventPayload(line) {
  const trimmed = String(line || '').trim()
  if (!trimmed.startsWith('data:')) return null
  const jsonStr = trimmed.slice(5).trim()
  if (!jsonStr || jsonStr === '[DONE]') return null
  try {
    return JSON.parse(jsonStr)
  } catch {
    return null
  }
}
