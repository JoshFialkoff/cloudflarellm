# PostHog: homepage wizard budget vs scenarios (50/50)

Flag key: **`homepage-wizard-budget-vs-scenarios`**

## Variants (code expects these exact keys)

| Key | Share | UX after urgency |
|-----|-------|------------------|
| `budget-form` | 50% | Monthly budget / ZIP / care type form, then scenario choices |
| `scenarios-first` | 50% | Scenario choices immediately (budget/ZIP/care prefilled silently) |

## Create in PostHog

1. **Feature flags → New** (or **Experiments → New** linked to the flag).
2. Key: `homepage-wizard-budget-vs-scenarios`.
3. Multivariate: **50%** `budget-form`, **50%** `scenarios-first`.
4. Rollout: **100%** of users (split is 50/50 inside the flag).
5. Launch experiment.

## Exposure & metrics

- **Exposure:** `$feature_flag_called` for this flag, or custom event **`wizard_path_variant_shown`** (fires on first urgency click).
- **Primary goal:** `facility_contact_clicked`.
- **Secondary:** `typebot_started` / chat completion funnel, `wizard_path_variant` breakdown on `search_submitted` if applicable.

## Verify

After deploy, open homepage → pick urgency → confirm PostHog Live shows `wizard_path_variant_shown` with `wizard_path_variant` = `budget-form` or `scenarios-first`.
