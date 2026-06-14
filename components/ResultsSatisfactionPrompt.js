'use client'

import { useState } from 'react'
import {
  getSatisfactionCommentPrompt,
  LIKERT_OPTIONS,
} from '../lib/resultsSatisfaction'
import {
  messagePreview,
  trackResultsSatisfactionComment,
  trackResultsSatisfactionDismissed,
  trackResultsSatisfactionRated,
} from '../lib/chatAnalytics'
import styles from './ResultsSatisfactionPrompt.module.css'

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
    setPhase('comment')
    trackResultsSatisfactionRated({
      ...analyticsProps,
      satisfaction_rating: value,
    })
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
