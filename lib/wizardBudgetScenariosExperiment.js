import posthog, { WIZARD_BUDGET_SCENARIOS_EXPERIMENT_FLAG } from './posthogClient'

/** PostHog multivariate keys — 50/50 in experiment `homepage-wizard-budget-vs-scenarios`. */
export const WIZARD_PATH_VARIANT = {
  BUDGET_FORM: 'budget-form',
  SCENARIOS_FIRST: 'scenarios-first',
}

export { WIZARD_BUDGET_SCENARIOS_EXPERIMENT_FLAG }

export function resolveWizardPathVariant(flagVariant) {
  if (flagVariant === WIZARD_PATH_VARIANT.SCENARIOS_FIRST) {
    return WIZARD_PATH_VARIANT.SCENARIOS_FIRST
  }
  return WIZARD_PATH_VARIANT.BUDGET_FORM
}

/** Read variant via posthog.getFeatureFlag after flags have loaded. */
export function readWizardPathVariantFromPostHog() {
  if (typeof window === 'undefined') return WIZARD_PATH_VARIANT.BUDGET_FORM
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return WIZARD_PATH_VARIANT.BUDGET_FORM

  try {
    return resolveWizardPathVariant(
      posthog.getFeatureFlag(WIZARD_BUDGET_SCENARIOS_EXPERIMENT_FLAG)
    )
  } catch {
    return WIZARD_PATH_VARIANT.BUDGET_FORM
  }
}

export function captureWizardPathVariantShown(wizardPathVariant, extra = {}) {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

  try {
    const variant =
      posthog.getFeatureFlag(WIZARD_BUDGET_SCENARIOS_EXPERIMENT_FLAG) ?? wizardPathVariant

    posthog.capture('wizard_path_variant_shown', {
      wizard_path_variant: wizardPathVariant,
      homepage_layout: extra.homepage_layout,
      $feature_flag: WIZARD_BUDGET_SCENARIOS_EXPERIMENT_FLAG,
      $feature_flag_response: variant,
    })
  } catch {
    // Analytics must not break the wizard.
  }
}
