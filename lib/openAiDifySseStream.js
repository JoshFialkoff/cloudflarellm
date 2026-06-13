/**
 * Stream OpenAI chat/completions SSE into Dify-compatible SSE for AssistedlyWizard.
 */

export function writeDifySseEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

export function flushDifySse(res) {
  if (typeof res.flush === 'function') res.flush()
}

export function beginDifyCompatibleSse(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, no-transform')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
  res.setHeader('CDN-Cache-Control', 'no-store')
  res.setHeader('Cloudflare-CDN-Cache-Control', 'no-store')
  res.setHeader('X-Accel-Buffering', 'no')
  res.setHeader('Connection', 'keep-alive')
  res.status(200)
  if (typeof res.flushHeaders === 'function') res.flushHeaders()
}

export function endDifyCompatibleSseWithError(res, message) {
  writeDifySseEvent(res, { event: 'error', message: String(message || 'Stream failed') })
  writeDifySseEvent(res, { event: 'message_end' })
  res.end()
}

export async function pipeOpenAiChatCompletionToDifySse(upstreamBody, res, { prefixText = '' } = {}) {
  if (prefixText) {
    writeDifySseEvent(res, { event: 'message', answer: prefixText })
  }

  const reader = upstreamBody.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    let chunk = await reader.read()
    while (!chunk.done) {
      buffer += decoder.decode(chunk.value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data:')) continue
        const payload = trimmed.slice(5).trim()
        if (!payload || payload === '[DONE]') continue

        try {
          const json = JSON.parse(payload)
          const delta = json?.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta.length > 0) {
            writeDifySseEvent(res, { event: 'message', answer: delta })
          }
        } catch {
          // ignore malformed SSE lines
        }
      }

      chunk = await reader.read()
    }
  } finally {
    writeDifySseEvent(res, { event: 'message_end' })
    res.end()
  }
}
