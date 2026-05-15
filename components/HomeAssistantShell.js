import { useEffect, useRef } from 'react'
import styles from '../styles/Home.module.css'
import { AssistedlyWizard } from './AssistedlyWizard'
import { captureLandingEvent } from '../lib/landingAnalytics'

export default function HomeAssistantShell({ prefilledVariables = {}, homepage_layout = '' }) {
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
          <AssistedlyWizard prefilledVariables={prefilledVariables} />
        </div>
      </section>
    </div>
  )
}
