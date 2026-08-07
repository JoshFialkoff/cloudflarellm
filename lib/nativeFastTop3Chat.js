import { buildFacilityRetrievalContext } from './facilityChatFallback'
import {
  FAST_TOP3_LLM,
  FAST_TOP3_RETRIEVAL_TOP_K,
  buildFastTop3SystemPrompt,
  composeSearchContext,
} from './fastTop3WorkflowConfig'
import { streamInstantTop3ToSse } from './instantTop3Sse'
import {
  endDifyCompatibleSseWithError,
  flushDifySse,
  pipeOpenAiChatCompletionToDifySse,
  writeDifySseEvent,
} from './openAiDifySseStream'
import { captureAiGeneration, flushPosthogServer } from './posthogServer'
import { sanitize, hashForAudit } from './security/sanitizer.js'
import { auditPrompt, safeError } from './security/auditLog.js'
import { mergeZdr } from './security/zdr.js'

function resolveOllamaConfig() {
  const baseUrl = String(process.env.OLLAMA_API_URL || '').replace(/\/$/, '')
  const model = String(process.env.OLLAMA_CHAT_MODEL || FAST_TOP3_LLM.defaultModel).trim()
  return { baseUrl, model }
}

function useNativeLlmRefinement() {
  return String(process.env.NATIVE_CHAT_USE_LLM || '').trim() === '1'
}

export function shouldUseNativeFastTop3Chat() {
  const engine = String(process.env.CHAT_ENGINE || '').trim().toLowerCase()
  if (engine === 'dify') return false
  if (engine === 'native') return true
  const difyKey = String(process.env.DIFY_API_KEY || '').trim()
  const ollamaUrl = String(process.env.OLLAMA_API_URL || '').trim()
  return Boolean(ollamaUrl) && !difyKey
}

export async function handleNativeFastTop3Chat(req, res, { query, inputs }) {
  const user = typeof req.body?.user === 'string' && req.body.user ? req.body.user : 'anonymous'
  const sessionId =
    (typeof req.body?.conversation_id === 'string' && req.body.conversation_id) ||
    user
  const startedAt = Date.now()
  const location = String(inputs?.Location || '').trim()
  const howUrgent = String(inputs?.how_urgent || '').trim()
  const monthlyBudget = inputs?.monthly_budget

  streamInstantTop3ToSse(res, query, inputs)

  if (!useNativeLlmRefinement()) {
    writeDifySseEvent(res, { event: 'message_end' })
    res.end()
    captureAiGeneration(user, {
      $ai_trace_id: sessionId,
      $ai_model: 'instant-retrieval',
      $ai_provider: 'assistedly-native',
      $ai_latency: (Date.now() - startedAt) / 1000,
      $ai_base_url: 'assistedly-native',
      rag_sources_count: FAST_TOP3_RETRIEVAL_TOP_K,
      care_type: inputs?.care_type,
      chat_engine: 'native-fast-top-3',
    })
    await flushPosthogServer()
    return
  }

  const { baseUrl, model } = resolveOllamaConfig()
  if (!baseUrl) {
    endDifyCompatibleSseWithError(
      res,
      'NATIVE_CHAT_USE_LLM=1 requires OLLAMA_API_URL on the server.'
    )
    return
  }

  const safeQuery = sanitize(query)
  const searchContext = composeSearchContext({
    location,
    monthlyBudget,
    howUrgent,
    query: safeQuery,
  })

  const retrievalContext = buildFacilityRetrievalContext(
    `${searchContext}\n${safeQuery}`,
    inputs,
    FAST_TOP3_RETRIEVAL_TOP_K
  )

  const systemPrompt = buildFastTop3SystemPrompt({
    context: retrievalContext,
    location,
    monthlyBudget,
    howUrgent,
    query: safeQuery,
  })

  const promptHash = hashForAudit(safeQuery)
  auditPrompt({ actor: user, model, provider: 'ollama', promptHash, status: 'dispatched' })

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
        temperature: FAST_TOP3_LLM.temperature,
        top_p: FAST_TOP3_LLM.top_p,
        max_tokens: FAST_TOP3_LLM.max_tokens,
        stream: true,
        stream_options: { include_usage: true },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: safeQuery },
        ],
      }),
    })
  } catch (error) {
    safeError('Native Fast Top-3 OpenAI transport failed', { baseUrl, model, error: error instanceof Error ? error.message : String(error) })
    endDifyCompatibleSseWithError(res, 'Unable to reach Ollama chat completions endpoint.')
    return
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => upstream.statusText)
    safeError('Native Fast Top-3 OpenAI upstream error', `status=${upstream.status} detail=${String(detail).slice(0, 300)}`)
    endDifyCompatibleSseWithError(res, 'Ollama chat completions request failed.')
    return
  }

  writeDifySseEvent(res, { event: 'message', answer: '\n\n---\n\n' })
  flushDifySse(res)
  const llmStartedAt = Date.now()
  const { usage } = await pipeOpenAiChatCompletionToDifySse(upstream.body, res)
  captureAiGeneration(user, {
    $ai_trace_id: sessionId,
    $ai_model: model,
    $ai_provider: 'openai',
    $ai_input_tokens: usage?.prompt_tokens,
    $ai_output_tokens: usage?.completion_tokens,
    $ai_latency: (Date.now() - llmStartedAt) / 1000,
    $ai_base_url: baseUrl,
    rag_sources_count: retrievalContext ? FAST_TOP3_RETRIEVAL_TOP_K : 0,
    care_type: inputs?.care_type,
    chat_engine: 'native-fast-top-3',
  })
  await flushPosthogServer()
}
