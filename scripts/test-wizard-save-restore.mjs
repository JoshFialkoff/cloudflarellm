import assert from 'node:assert/strict'
import test from 'node:test'

const { resolveWizardRestoreUi } = await import('../lib/wizardSaveRestore.js')

test('resolveWizardRestoreUi: completed save with step idle restores end prompts', () => {
  const ui = resolveWizardRestoreUi({
    urgency: 'Within a month',
    zip_code: '02139',
    step: 'idle',
  })
  assert.deepEqual(ui, { step: 'idle', wizardComplete: true })
})

test('resolveWizardRestoreUi: wizard_complete flag restores end prompts', () => {
  const ui = resolveWizardRestoreUi({
    urgency: 'Within a month',
    step: 'budget',
    wizard_complete: true,
  })
  assert.deepEqual(ui, { step: 'idle', wizardComplete: true })
})

test('resolveWizardRestoreUi: mid-wizard save keeps step and incomplete', () => {
  const ui = resolveWizardRestoreUi({
    urgency: 'Within a month',
    step: 'budget',
  })
  assert.deepEqual(ui, { step: 'budget', wizardComplete: false })
})

test('resolveWizardRestoreUi: null/empty defaults to urgency', () => {
  assert.deepEqual(resolveWizardRestoreUi(null), { step: 'urgency', wizardComplete: false })
  assert.deepEqual(resolveWizardRestoreUi({}), { step: 'urgency', wizardComplete: false })
})
