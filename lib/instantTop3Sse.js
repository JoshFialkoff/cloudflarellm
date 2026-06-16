import { buildFastTop3AnswerPrefix } from './fastTop3WorkflowConfig'
import { buildInstantTop3MatchLines } from './facilityChatFallback'
import {
  beginDifyCompatibleSse,
  flushDifySse,
  writeDifySseEvent,
} from './openAiDifySseStream'

/** Stream intro + local top-3 facility rows as Dify-compatible SSE (no upstream wait). */
export function streamInstantTop3ToSse(res, query, inputs) {
  const answerPrefix = buildFastTop3AnswerPrefix({
    location: String(inputs?.Location || inputs?.location || '').trim(),
    monthlyBudget: inputs?.monthly_budget,
    howUrgent: inputs?.how_urgent,
  })

  beginDifyCompatibleSse(res)
  writeDifySseEvent(res, { event: 'message', answer: answerPrefix })
  flushDifySse(res)

  const lines = buildInstantTop3MatchLines(query, inputs)
  for (let i = 0; i < lines.length; i += 1) {
    const chunk = i === 0 ? lines[i] : `\n\n${lines[i]}`
    writeDifySseEvent(res, { event: 'message', answer: chunk })
    flushDifySse(res)
  }
}
