'use client'

import React, { useState } from 'react'
import styles from '../styles/Home.module.css'
import HomeHeroHeadline from './HomeHeroHeadline'
import HeroYouTubeFacade from './HeroYouTubeFacade'
import HomeAssistantShell from './HomeAssistantShell'
import HomeOverviewChart from './HomeOverviewChart'
import HomeScoresTabs from './HomeScoresTabs'

/**
 * Hero + assistant or chart — keeps `assistantEngaged` state local so urgency clicks
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
  useChart = false,
  scoresTab = null,
  children,
}) {
  const [assistantEngaged, setAssistantEngaged] = useState(false)
  const [scoresExpanded, setScoresExpanded] = useState(false)

  const resolvedScoresTab = scoresTab
    ? React.cloneElement(scoresTab, {
        expanded: scoresExpanded,
        onExpandToggle: () => setScoresExpanded((p) => !p),
      })
    : null

  return (
    <section
      className={`${styles.hero} ${
        assistantEngaged ? styles.heroAssistantEngaged : ''
      } ${scoresExpanded ? styles.heroScoresExpanded : ''}`}
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
        {resolvedScoresTab ? (
          <div className={styles.heroVideoSlot}>{resolvedScoresTab}</div>
        ) : useChart ? (
          <div className={styles.heroChartSlot}>
            <HomeOverviewChart />
          </div>
        ) : (
          <HomeAssistantShell
            prefilledVariables={typebotPrefill}
            homepage_layout={homepage_layout}
            assistantEngaged={assistantEngaged}
            onEngagedChange={setAssistantEngaged}
          />
        )}
      </div>
    </section>
  )
}
