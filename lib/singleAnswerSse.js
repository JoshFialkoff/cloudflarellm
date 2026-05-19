export function singleAnswerSseStream(answer, meta = {}) {
  const text = String(answer || '')
  const encoder = new TextEncoder()

  return new ReadableStream({
    start(controller) {
      if (meta.conversationId || meta.messageId) {
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              event: 'message',
              answer: '',
              conversation_id: meta.conversationId,
              message_id: meta.messageId,
            })}\n\n`
          )
        )
      }

      if (text) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ event: 'message', answer: text })}\n\n`)
        )
      }

      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ event: 'message_end' })}\n\n`))
      controller.close()
    },
  })
}
