'use client'

import { useState } from 'react'
import {
  getSatisfactionCommentPrompt,
  isDissatisfiedRating,
  isSatisfiedRating,
  LIKERT_OPTIONS,
  GOOGLE_REVIEW_URL,
  FOUNDER_CONTACT_PATH,
} from '../lib/resultsSatisfaction'
import {
  messagePreview,
  pushChatDataLayer,
  trackResultsSatisfactionComment,
  trackResultsSatisfactionDismissed,
  trackResultsSatisfactionRated,
} from '../lib/chatAnalytics'
import styles from './ResultsSatisfactionPrompt.module.css'

function capturePosthog(event, props) {
  if (typeof window === 'undefined') return
  try {
    const { posthog } = require('../lib/posthogClient')
    if (posthog?.capture) posthog.capture(event, props)
  } catch { /* analytics non-blocking */ }
}

export default function ResultsSatisfactionPrompt({
  surface = 'unknown',
  context = {},
  className = '',
}) {
  const [phase, setPhase] = useState('rating')
  const [rating, setRating] = useState(null)
  const [comment, setComment] = useState('')

  const analyticsProps = {
    satisfaction_surface: surface,
    ...context,
  }

  const handleRate = (value) => {
    setRating(value)
    trackResultsSatisfactionRated({
      ...analyticsProps,
      satisfaction_rating: value,
    })

    // Branch immediately based on rating — skip comment phase
    if (isDissatisfiedRating(value)) {
      setPhase('founder_connect')
    } else {
      setPhase('google_review')
    }
  }

  const handleFounderConnectClick = () => {
    const payload = {
      ...analyticsProps,
      satisfaction_rating: rating,
    }
    // PostHog
    capturePosthog('founder_connect_clicked', payload)
    // Google Analytics / GTM data layer
    pushChatDataLayer('founder_connect_clicked', payload)
    window.open(FOUNDER_CONTACT_PATH, '_self')
  }

  const handleGoogleReviewClick = () => {
    const payload = {
      ...analyticsProps,
      satisfaction_rating: rating,
    }
    // PostHog
    capturePosthog('google_review_clicked', payload)
    // Google Analytics / GTM data layer
    pushChatDataLayer('google_review_clicked', payload)
    window.open(GOOGLE_REVIEW_URL, '_blank', 'noopener,noreferrer')
  }

  const handleDismiss = () => {
    trackResultsSatisfactionDismissed({
      ...analyticsProps,
      satisfaction_rating: rating,
    })
    setPhase('done')
  }

  const handleSubmitComment = () => {
    const trimmed = comment.trim()
    trackResultsSatisfactionComment({
      ...analyticsProps,
      satisfaction_rating: rating,
      comment_preview: trimmed ? messagePreview(trimmed) : undefined,
      has_comment: Boolean(trimmed),
    })
    setPhase('done')
  }

  const handleSkip = () => {
    trackResultsSatisfactionDismissed({
      ...analyticsProps,
      satisfaction_rating: rating,
    })
    setPhase('done')
  }

  if (phase === 'done') {
    return (
      <div className={`${styles.done} ${className}`.trim()}>
        <p>Thanks for your feedback — it helps us improve Assistedly.ai for every family.</p>
      </div>
    )
  }

  if (phase === 'founder_connect') {
    return (
      <div className={`${styles.actionCard} ${className}`.trim()}>
        <p>Want to chat with the founder?</p>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.founderBtn}`}
          onClick={handleFounderConnectClick}
        >
          Talk to Josh
        </button>
        <br />
        <button type="button" className={styles.dismissLink} onClick={handleDismiss}>
          No thanks, I&apos;m all set
        </button>
      </div>
    )
  }

  if (phase === 'google_review') {
    return (
      <div className={`${styles.actionCard} ${className}`.trim()}>
        <p>Love us? Review us on Google!</p>
        <button
          type="button"
          className={`${styles.actionBtn} ${styles.reviewBtn}`}
          onClick={handleGoogleReviewClick}
        >
          Leave a Review
        </button>
        <br />
        <button type="button" className={styles.dismissLink} onClick={handleDismiss}>
          No thanks
        </button>
      </div>
    )
  }

  if (phase === 'comment') {
    return (
      <div className={`${styles.prompt} ${className}`.trim()}>
        <p className={styles.title}>{getSatisfactionCommentPrompt(rating)}</p>
        <textarea
          className={styles.commentInput}
          rows={4}
          placeholder="Optional — share anything that would help our team."
          value={comment}
          onChange={(event) => setComment(event.target.value)}
        />
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={handleSubmitComment}
          >
            Send feedback
          </button>
          <button type="button" className={styles.skipBtn} onClick={handleSkip}>
            Skip
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`${styles.prompt} ${className}`.trim()}>
      <p className={styles.title}>How happy are you with these results?</p>
      <div className={styles.likertOptions} role="group" aria-label="Satisfaction rating">
        {LIKERT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={styles.likertBtn}
            onClick={() => handleRate(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
