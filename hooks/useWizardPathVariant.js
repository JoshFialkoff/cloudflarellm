import { useEffect, useState } from 'react'
import { posthog } from '../lib/posthogClient'
import {
  readWizardPathVariantFromPostHog,
  WIZARD_PATH_VARIANT,
} from '../lib/wizardBudgetScenariosExperiment'

/**
 * Wait for PostHog feature flags, then expose the wizard path variant.
 * @returns {{ wizardPathVariant: string, flagsReady: boolean, scenariosFirstPath: boolean }}
 */
export function useWizardPathVariant() {
  const posthogEnabled = Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY)

  const [flagsReady, setFlagsReady] = useState(() => !posthogEnabled)
  const [wizardPathVariant, setWizardPathVariant] = useState(() =>
    readWizardPathVariantFromPostHog()
  )

  useEffect(() => {
    if (!posthogEnabled) return undefined

    let cancelled = false
    const syncVariant = () => {
      if (cancelled) return
      setWizardPathVariant(readWizardPathVariantFromPostHog())
      setFlagsReady(true)
    }

    const timeout = window.setTimeout(syncVariant, 2500)

    if (posthog.config?.token) {
      syncVariant()
      return () => {
        cancelled = true
        window.clearTimeout(timeout)
      }
    }

    posthog.onFeatureFlags(syncVariant)
    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      posthog.onFeatureFlags(() => {})
    }
  }, [posthogEnabled])

  return {
    wizardPathVariant,
    flagsReady,
    scenariosFirstPath: wizardPathVariant === WIZARD_PATH_VARIANT.SCENARIOS_FIRST,
  }
}
