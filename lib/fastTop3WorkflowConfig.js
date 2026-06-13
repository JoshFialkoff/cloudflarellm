/**
 * Runtime config mirrored from dify/fast-top-3-ma-assisted-living-finder.dsl.yml
 * (6-13-26 export). Native /api/chat uses this instead of a live Dify app.
 */

export const FAST_TOP3_RETRIEVAL_TOP_K = 3

export const FAST_TOP3_LLM = {
  temperature: 0.1,
  top_p: 0.9,
  max_tokens: 450,
  defaultModel: 'gpt-4o-mini',
}

export function composeSearchContext({ location, monthlyBudget, howUrgent, query }) {
  const budget =
    monthlyBudget != null && Number.isFinite(Number(monthlyBudget))
      ? String(monthlyBudget)
      : ''
  return [
    `Location: ${location || ''}`,
    `Budget: ${budget}`,
    `Urgency: ${howUrgent || ''}`,
    `Question: ${query || ''}`,
  ].join('\n')
}

export function buildFastTop3SystemPrompt({ context, location, monthlyBudget, howUrgent, query }) {
  const budget =
    monthlyBudget != null && Number.isFinite(Number(monthlyBudget))
      ? String(monthlyBudget)
      : ''

  return `Massachusetts AI Assisted Living Consumer Advocate — top 3 only, rest in ONE follow-up.

Context:
${context}

Budget: ${budget}
Urgency: ${howUrgent || ''}
Location: ${location || ''}
Question: ${query || ''}

Rules: No promotion/guarantees; no hidden reasoning. Unknown compliance → Unknown. NO follow-up questions!

Top 3 matches:
1) <Facility> — <Town>
   - Memory care: <Yes/No/Unknown>
   - Why (≤12 words)
2) <Facility> — <Town>
   - Memory care: <Yes/No/Unknown>
   - Why (≤12 words)
3) <Facility> — <Town>
   - Memory care: <Yes/No/Unknown>
   - Why (≤12 words)
NEVER ask a follow up question!!`
}

export function buildFastTop3AnswerPrefix({ location, monthlyBudget, howUrgent }) {
  const budget =
    monthlyBudget != null && Number.isFinite(Number(monthlyBudget))
      ? `$${Number(monthlyBudget).toLocaleString('en-US')}`
      : 'your budget'
  const urgencySuffix = howUrgent ? ` ${howUrgent}` : ''
  const locationText = location || 'Massachusetts'

  return `Based on your goal of finding assisted living in ${locationText} for ${budget} per month${urgencySuffix} here are your best options:\n\n`
}
