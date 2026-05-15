'use client'

import { useEffect, useRef } from 'react'
import styles from '../styles/Home.module.css'
import { AssistedlyWizard } from './AssistedlyWizard'
import HomeAssistantPlayerBranch from './HomeAssistantPlayerBranch'
import HomeAssistantTypebotBranch from './HomeAssistantTypebotBranch'
import {
  homepageUsesPlayerBranch,
  homepageUsesTypebotEmbed,
} from '../lib/homepageAssistantKind'
import { captureLandingEvent } from '../lib/landingAnalytics'

export default function HomeAssistantShell({ prefilledVariables = {}, homepage_layout = '' }) {
  const startedRef = useRef(false)
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    const assistant_impl = homepageUsesTypebotEmbed()
      ? 'typebot_embed'
      : homepageUsesPlayerBranch()
        ? 'typebot_player'
        : 'assistedly_wizard'
    captureLandingEvent('typebot_started', {
      homepage_layout,
      assistant_impl,
    })
  }, [homepage_layout])

  if (homepageUsesTypebotEmbed()) {
    return (
      <HomeAssistantTypebotBranch
        prefilledVariables={prefilledVariables}
        homepage_layout={homepage_layout}
      />
    )
  }

  if (homepageUsesPlayerBranch()) {
    return (
      <HomeAssistantPlayerBranch
        prefilledVariables={prefilledVariables}
        homepage_layout={homepage_layout}
      />
    )
  }

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
