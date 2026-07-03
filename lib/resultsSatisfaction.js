/** Five-point Likert options shown after initial results. */
export const LIKERT_OPTIONS = [
  { value: 1, label: 'Very unhappy' },
  { value: 2, label: 'Unhappy' },
  { value: 3, label: 'Neutral' },
  { value: 4, label: 'Happy' },
  { value: 5, label: 'Very happy' },
]

const COMMENT_PROMPTS = {
  5: 'Thanks for giving Assistedly.ai the top ranking! Can you tell our humans why you ranked the site so high?',
  4: 'Thanks for the positive rating! What stood out most about these results?',
  3: 'Thanks for your honest feedback. What would make these results more helpful for your family?',
  2: "We're sorry these results weren't quite right. What could we improve?",
  1: "We're sorry we missed the mark. Please tell us what went wrong so we can do better.",
}

export function getSatisfactionCommentPrompt(rating) {
  const value = Number(rating)
  return COMMENT_PROMPTS[value] || 'Thanks for your feedback. Anything else you want our team to know?'
}

export function isTopLikertRating(rating) {
  return Number(rating) === 5
}

/** Likert threshold: ratings below this trigger "Founder Connect" path. */
export const FOUNDER_CONNECT_THRESHOLD = 4

/** Returns true if the rating indicates the user is dissatisfied (wants founder chat). */
export function isDissatisfiedRating(rating) {
  return Number(rating) < FOUNDER_CONNECT_THRESHOLD
}

/** Returns true if the rating indicates the user is satisfied (candidate for Google review prompt). */
export function isSatisfiedRating(rating) {
  return Number(rating) >= FOUNDER_CONNECT_THRESHOLD
}

/** Google review URL for social proof amplification. */
export const GOOGLE_REVIEW_URL = 'https://g.page/r/assistedly-ai/review'

/** Founder contact URL (high-intent conversion path). */
export const FOUNDER_CONTACT_PATH = '/concierge'
