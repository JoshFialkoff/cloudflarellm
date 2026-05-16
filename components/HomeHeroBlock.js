'use client'

import { useState } from 'react'
import styles from '../styles/Home.module.css'
import HomeHeroHeadline from './HomeHeroHeadline'
import HeroYouTubeFacade from './HeroYouTubeFacade'
import HomeAssistantShell from './HomeAssistantShell'

/**
 * Hero + assistant only — keeps `assistantEngaged` state local so urgency clicks
 * do not re-render the landing banner or the rest of the page.
 */
export default function HomeHeroBlock({
  useDementiaHeadline,
  useFallbackRotation,
  rotationStep,
  kicker = '',
  videoInviteTitle = 'Watch why I created this service.',
  typebotPrefill = {},
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
        <HomeAssistantShell
          prefilledVariables={typebotPrefill}
          homepage_layout={homepage_layout}
          assistantEngaged={assistantEngaged}
          onEngagedChange={setAssistantEngaged}
        />
      </div>
    </section>
  )
}
