import {
  GENERAL_QUESTIONS_LLM,
  buildGeneralQuestionsSystemPrompt,
  composeGeneralQuestionsContext,
} from './generalQuestionsWorkflowConfig'
import {
  beginDifyCompatibleSse,
  endDifyCompatibleSseWithError,
  pipeOpenAiChatCompletionToDifySse,
  writeDifySseEvent,
} from './openAiDifySseStream'
import { captureAiGeneration, flushPosthogServer } from './posthogServer'
import { sanitize, hashForAudit } from './security/sanitizer.js'
import { auditPrompt, safeError } from './security/auditLog.js'
import { mergeZdr } from './security/zdr.js'

function resolveOllamaConfig() {
  const baseUrl = String(process.env.OLLAMA_API_URL || '').replace(/\/$/, '')
  const model = String(process.env.OLLAMA_CHAT_MODEL || GENERAL_QUESTIONS_LLM.defaultModel).trim()
  return { baseUrl, model, provider: 'ollama' }
}

export function shouldUseNativeGeneralQuestionsChat() {
  const engine = String(process.env.CHAT_ENGINE || '').trim().toLowerCase()
  if (engine === 'dify') return false
  if (engine === 'native') return true
  const difyAskKey = String(process.env.DIFY_ASK_API_KEY || '').trim()
  const ollamaUrl = String(process.env.OLLAMA_API_URL || '').trim()
  return Boolean(ollamaUrl) && !difyAskKey
}

export async function handleNativeGeneralQuestionsChat(req, res, { query, inputs }) {
  const user = typeof req.body?.user === 'string' && req.body.user ? req.body.user : 'anonymous'
  const sessionId =
    (typeof req.body?.conversation_id === 'string' && req.body.conversation_id) ||
    user
  const startedAt = Date.now()

  const { baseUrl, model, provider } = resolveOllamaConfig()
  if (!baseUrl) {
    return res.status(503).json({ error: 'AI service is not configured.' })
  }

  const { context, sourcesCount } = composeGeneralQuestionsContext(query)
  const systemPrompt = buildGeneralQuestionsSystemPrompt({ context })

  // HIPAA: sanitize user query before dispatch
  const safeQuery = sanitize(String(query || ''))
  const promptHash = hashForAudit(safeQuery)
  auditPrompt({ actor: user, model, provider: provider || 'ollama', promptHash, status: 'dispatched' })

  beginDifyCompatibleSse(res)
  writeDifySseEvent(res, { event: 'status', message: 'Thinking…' })

  let upstream
  try {
    upstream = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: mergeZdr({
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      }, 'ollama'),
      body: JSON.stringify({
        model,
        temperature: GENERAL_QUESTIONS_LLM.temperature,
        top_p: GENERAL_QUESTIONS_LLM.top_p,
        max_tokens: GENERAL_QUESTIONS_LLM.max_tokens,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: safeQuery },
        ]
      }),
    })
  } catch (error) {
    safeError('Native general questions OpenAI transport failed', { baseUrl, model, error: error instanceof Error ? error.message : String(error) })
    endDifyCompatibleSseWithError(res, 'Unable to reach AI service. Please try again.')
    return
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => upstream.statusText)
    safeError('Native general questions OpenAI upstream error', `status=${upstream.status} detail=${String(detail).slice(0, 300)}`)
    endDifyCompatibleSseWithError(res, 'Chat request failed.')
    return
  }

  const llmStartedAt = Date.now()
  const { usage } = await pipeOpenAiChatCompletionToDifySse(upstream.body, res)

  captureAiGeneration(user, {
    $ai_trace_id: sessionId,
    $ai_model: model,
    $ai_provider: provider || 'openai',
    $ai_input_tokens: usage?.prompt_tokens,
    $ai_output_tokens: usage?.completion_tokens,
    $ai_latency: (Date.now() - llmStartedAt) / 1000,
    $ai_base_url: baseUrl,
    rag_sources_count: sourcesCount,
    chat_engine: 'native-general-questions',
  })
  await flushPosthogServer()
}
