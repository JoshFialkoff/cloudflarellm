'use client'

import { useEffect, useRef } from 'react'
import styles from '../styles/Home.module.css'
import { AssistedlyWizard } from './AssistedlyWizard'
import { captureLandingEvent } from '../lib/landingAnalytics'

/** Homepage hero always uses AssistedlyWizard + Dify (`/api/chat`). In-house TypebotPlayer lives on `/bots/[slug]`. */
export default function HomeAssistantShell({
  prefilledVariables = {},
  homepage_layout = '',
  assistantEngaged = false,
  onEngagedChange,
}) {
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    captureLandingEvent('typebot_started', {
      homepage_layout,
      assistant_impl: 'assistedly_wizard',
    })
  }, [homepage_layout])

  return (
    <div className={styles.heroVideoSlot}>
      <section
        className={`${styles.typebotEmbed} ${styles.heroTypebotAside}`}
        id="assistant"
        aria-label="AI assistant chat"
        data-homepage-layout={homepage_layout}
      >
        <div className={styles.heroTypebotFrame}>
          <AssistedlyWizard
            prefilledVariables={prefilledVariables}
            assistantEngaged={assistantEngaged}
            onEngagedChange={onEngagedChange}
          />
        </div>
      </section>
    </div>
  )
}
