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

    const delta = extractAnswerDelta(data)
    if (delta) {
      handlers?.onAnswerDelta?.(delta)
    } else if (event === 'workflow_finished') {
      const finalAnswer = extractWorkflowFinishedAnswer(data)
      if (finalAnswer) handlers?.onAnswerDelta?.(finalAnswer)
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

    if (event === 'message_end' || event === 'workflow_finished') {
      handlers?.onEnd?.()
    }
  }

  return remainder
}

function extractAnswerDelta(data) {
  const event = typeof data?.event === 'string' ? data.event : ''
  if (event === 'message' || event === 'agent_message') {
    return asNonEmptyString(data?.answer)
  }
  if (event === 'workflow_chunk' || event === 'workflow_message' || event === 'text_chunk') {
    return (
      asNonEmptyString(data?.answer) ||
      asNonEmptyString(data?.text) ||
      asNonEmptyString(data?.delta) ||
      asNonEmptyString(data?.content) ||
      asNonEmptyString(data?.chunk) ||
      asNonEmptyString(data?.data?.answer) ||
      asNonEmptyString(data?.data?.text) ||
      asNonEmptyString(data?.data?.delta) ||
      asNonEmptyString(data?.data?.content) ||
      asNonEmptyString(data?.data?.chunk)
    )
  }
  return ''
}

function extractWorkflowFinishedAnswer(data) {
  const outputs = data?.data?.outputs
  if (!outputs || typeof outputs !== 'object') return ''

  const priorityKeys = ['answer', 'output', 'text', 'result']
  for (const key of priorityKeys) {
    const v = asNonEmptyString(outputs[key])
    if (v) return v
  }

  for (const v of Object.values(outputs)) {
    const asText = asNonEmptyString(v)
    if (asText) return asText
  }
  return ''
}

function asNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0 ? value : ''
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
