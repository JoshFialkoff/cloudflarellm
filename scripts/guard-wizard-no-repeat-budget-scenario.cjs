const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '..', 'components', 'AssistedlyWizard.js')
const source = fs.readFileSync(filePath, 'utf8')

function extractCallback(name) {
  const marker = `const ${name} = useCallback(`
  const start = source.indexOf(marker)
  if (start === -1) {
    return null // Return null if callback doesn't exist
  }
  const next = source.indexOf('\n  const ', start + marker.length)
  return source.slice(start, next === -1 ? source.length : next)
}

const submitBudget = extractCallback('submitBudget')
const pickUrgency = extractCallback('pickUrgency')
const pickScenario = extractCallback('pickScenario')

if (source.includes('Click on a common scenario') || source.includes('75 year-old woman with dementia in Winchester, MA')) {
  throw new Error(
    'Wizard scenario-loop guard failed: homepage wizard bundle must not contain scenario prompt/chip copy.'
  )
}

if (pickUrgency) {
  if (pickUrgency.includes("setStep('scenarios')") || pickUrgency.includes('activeScenariosFirst')) {
    throw new Error(
      'Wizard scenario-loop guard failed: urgency must always proceed to the budget/location form, never branch to scenario choices.'
    )
  }

  if (!pickUrgency.includes('<BudgetIntroBubble />') || !pickUrgency.includes("setStep('budget')")) {
    throw new Error(
      'Wizard scenario-loop guard failed: pickUrgency must show the budget/location form immediately after urgency.'
    )
  }
}

if (pickScenario) {
  if (pickScenario.includes("setStep('budget')") || pickScenario.includes('<BudgetIntroBubble')) {
    throw new Error(
      'Wizard scenario-loop guard failed: choosing a preset scenario must start search directly, not ask the budget/location form again.'
    )
  }

  if (!pickScenario.includes('runDifyQuery(') || !pickScenario.includes("setStep('idle')")) {
    throw new Error(
      'Wizard scenario-loop guard failed: pickScenario must set idle and run the Dify/native search directly.'
    )
  }
}

console.log('✅ wizard no-repeat budget/scenario guard passed')