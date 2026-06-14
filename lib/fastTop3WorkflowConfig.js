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

export function formatHowUrgentPhrase(howUrgent) {
  const urgencyRaw = String(howUrgent || '').trim()
  if (!urgencyRaw) return ''
  if (urgencyRaw === 'Right away') return 'right away'
  if (urgencyRaw === 'In the next month') return 'in the next month'
  if (urgencyRaw === 'In more than one month') return 'in more than one month'
  return urgencyRaw.charAt(0).toLowerCase() + urgencyRaw.slice(1)
}

const FAST_TOP3_INTRO_PATTERN =
  /Based on your goal of finding assisted living in (.+?) for (\$[\d,]+|your budget) per month\s+(.+?)\s*,?\s*here are your best options:/i

export function normalizeFastTop3AnswerIntro(text) {
  return String(text || '').replace(FAST_TOP3_INTRO_PATTERN, (match, location, budget, urgencyPart) => {
    const phrase = formatHowUrgentPhrase(String(urgencyPart || '').trim())
    const urgencyClause = phrase ? ` ${phrase}` : ''
    return `Based on your goal of finding assisted living in ${location} for ${budget} per month${urgencyClause}, here are your best options:`
  })
}

export function buildFastTop3AnswerPrefix({ location, monthlyBudget, howUrgent }) {
  const budget =
    monthlyBudget != null && Number.isFinite(Number(monthlyBudget))
      ? `$${Number(monthlyBudget).toLocaleString('en-US')}`
      : 'your budget'
  const urgencyClause = formatHowUrgentPhrase(howUrgent)
    ? ` ${formatHowUrgentPhrase(howUrgent)}`
    : ''
  const locationText = location || 'Massachusetts'

  return `Based on your goal of finding assisted living in ${locationText} for ${budget} per month${urgencyClause}, here are your best options:\n\n`
}
