'use client'

import styles from '../styles/Home.module.css'
import { AssistedlyWizard } from './AssistedlyWizard'

/** Homepage hero uses AssistedlyWizard + Dify/native chat. In-house TypebotPlayer lives on `/bots/[slug]`. */
export default function HomeAssistantShell({
  prefilledVariables = {},
  homepage_layout = '',
  assistantEngaged = false,
  onEngagedChange,
}) {
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
            homepage_layout={homepage_layout}
            assistantEngaged={assistantEngaged}
            onEngagedChange={onEngagedChange}
          />
        </div>
      </section>
    </div>
  )
}
