'use client'

import { PostHogProvider } from 'posthog-js/react'
import posthog from '../lib/posthogClient'

export default function PHProvider({ children }) {
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>
}
