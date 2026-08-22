'use client'

import { useState } from 'react'
import styles from '../styles/Home.module.css'
import HomeHeroHeadline from './HomeHeroHeadline'
import HeroYouTubeFacade from './HeroYouTubeFacade'
import HomeFreeTextWizard from './HomeFreeTextWizard'

/**
 * Variant homepage hero for A/B test: free-text chat entry instead of
 * step-by-step wizard buttons. Keeps the same left-column layout so the
 * experiment isolates the entry UX, not visual design.
 */
export default function HomeFreeTextHero({
  useDementiaHeadline,
  useFallbackRotation,
  rotationStep,
  kicker = '',
  videoInviteTitle = 'Watch why I created this service.',
  homepage_layout = '',
  children,
}) {
  const [assistantEngaged, setAssistantEngaged] = useState(false)

  return (
    <section
      className={`${styles.hero} ${assistantEngaged ? styles.heroAssistantEngaged : ''}`}
    >
      <div className={styles.heroInner}>
        <div className={`${styles.heroContent} ${styles.heroHomeContent}`}>
          <HomeHeroHeadline
            useDementiaHeadline={useDementiaHeadline}
            useFallbackRotation={useFallbackRotation}
            rotationStep={rotationStep}
          />
          {kicker ? <p className={styles.heroProof}>{kicker}</p> : null}
          {children}
          <div className={styles.heroHomeVideo}>
            <HeroYouTubeFacade
              homepageLayout={homepage_layout}
              inviteTitle={videoInviteTitle}
              iframeTitle={videoInviteTitle}
            />
          </div>
        </div>
        <div className={styles.heroVideoSlot}>
          <section
            className={`${styles.typebotEmbed} ${styles.heroTypebotAside}`}
            id="assistant"
            aria-label="AI assistant chat"
            data-homepage-layout={homepage_layout}
            data-variant="free_text_entry"
          >
            <div className={styles.heroTypebotFrame}>
              <HomeFreeTextWizard
                homepage_layout={homepage_layout}
                onEngagedChange={setAssistantEngaged}
              />
            </div>
          </section>
        </div>
      </div>
    </section>
  )
}
