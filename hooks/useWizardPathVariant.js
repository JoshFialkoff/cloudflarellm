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

    const syncVariant = () => {
      setWizardPathVariant(readWizardPathVariantFromPostHog())
      setFlagsReady(true)
    }

    if (posthog.config?.token) {
      syncVariant()
      return undefined
    }

    posthog.onFeatureFlags(syncVariant)
    return () => {
      posthog.onFeatureFlags(() => {})
    }
  }, [posthogEnabled])

  return {
    wizardPathVariant,
    flagsReady,
    scenariosFirstPath: wizardPathVariant === WIZARD_PATH_VARIANT.SCENARIOS_FIRST,
  }
}
