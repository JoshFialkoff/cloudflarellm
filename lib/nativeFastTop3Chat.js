import { buildFacilityRetrievalContext, buildInstantTop3MatchLines } from './facilityChatFallback'
import {
  FAST_TOP3_LLM,
  FAST_TOP3_RETRIEVAL_TOP_K,
  buildFastTop3AnswerPrefix,
  buildFastTop3SystemPrompt,
  composeSearchContext,
} from './fastTop3WorkflowConfig'
import {
  beginDifyCompatibleSse,
  endDifyCompatibleSseWithError,
  flushDifySse,
  pipeOpenAiChatCompletionToDifySse,
  writeDifySseEvent,
} from './openAiDifySseStream'

function resolveOpenAiConfig() {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim()
  const baseUrl = String(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '')
  const model = String(process.env.OPENAI_CHAT_MODEL || FAST_TOP3_LLM.defaultModel).trim()
  return { apiKey, baseUrl, model }
}

function useNativeLlmRefinement() {
  return String(process.env.NATIVE_CHAT_USE_LLM || '').trim() === '1'
}

export function shouldUseNativeFastTop3Chat() {
  const engine = String(process.env.CHAT_ENGINE || '').trim().toLowerCase()
  if (engine === 'dify') return false
  if (engine === 'native') return true
  const difyKey = String(process.env.DIFY_API_KEY || '').trim()
  const openaiKey = String(process.env.OPENAI_API_KEY || '').trim()
  return Boolean(openaiKey) && !difyKey
}

function streamInstantTop3Matches(res, query, inputs) {
  const lines = buildInstantTop3MatchLines(query, inputs)
  for (let i = 0; i < lines.length; i += 1) {
    const chunk = i === 0 ? lines[i] : `\n\n${lines[i]}`
    writeDifySseEvent(res, { event: 'message', answer: chunk })
    flushDifySse(res)
  }
}

export async function handleNativeFastTop3Chat(req, res, { query, inputs }) {
  const location = String(inputs?.Location || '').trim()
  const howUrgent = String(inputs?.how_urgent || '').trim()
  const monthlyBudget = inputs?.monthly_budget

  const answerPrefix = buildFastTop3AnswerPrefix({
    location,
    monthlyBudget,
    howUrgent,
  })

  beginDifyCompatibleSse(res)
  writeDifySseEvent(res, { event: 'message', answer: answerPrefix })
  flushDifySse(res)
  streamInstantTop3Matches(res, query, inputs)

  if (!useNativeLlmRefinement()) {
    writeDifySseEvent(res, { event: 'message_end' })
    res.end()
    return
  }

  const { apiKey, baseUrl, model } = resolveOpenAiConfig()
  if (!apiKey) {
    endDifyCompatibleSseWithError(
      res,
      'NATIVE_CHAT_USE_LLM=1 requires OPENAI_API_KEY on the server.'
    )
    return
  }

  const searchContext = composeSearchContext({
    location,
    monthlyBudget,
    howUrgent,
    query,
  })

  const retrievalContext = buildFacilityRetrievalContext(
    `${searchContext}\n${query}`,
    inputs,
    FAST_TOP3_RETRIEVAL_TOP_K
  )

  const systemPrompt = buildFastTop3SystemPrompt({
    context: retrievalContext,
    location,
    monthlyBudget,
    howUrgent,
    query,
  })

  let upstream
  try {
    upstream = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model,
        temperature: FAST_TOP3_LLM.temperature,
        top_p: FAST_TOP3_LLM.top_p,
        max_tokens: FAST_TOP3_LLM.max_tokens,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
      }),
    })
  } catch (error) {
    console.error('Native Fast Top-3 OpenAI transport failed', {
      baseUrl,
      model,
      error: error instanceof Error ? error.message : String(error),
    })
    endDifyCompatibleSseWithError(res, 'Unable to reach OpenAI chat completions endpoint.')
    return
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => upstream.statusText)
    console.error('Native Fast Top-3 OpenAI upstream error', {
      status: upstream.status,
      detail: String(detail).slice(0, 300),
    })
    endDifyCompatibleSseWithError(res, 'OpenAI chat completions request failed.')
    return
  }

  writeDifySseEvent(res, { event: 'message', answer: '\n\n---\n\n' })
  flushDifySse(res)
  await pipeOpenAiChatCompletionToDifySse(upstream.body, res)
}
