const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '..', 'components', 'AssistedlyWizard.js')
const source = fs.readFileSync(filePath, 'utf8')

function extractCallback(name) {
  const marker = `const ${name} = useCallback(`
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`Missing ${name} callback in AssistedlyWizard.js`)
  const next = source.indexOf('\n  const ', start + marker.length)
  return source.slice(start, next === -1 ? source.length : next)
}

const submitBudget = extractCallback('submitBudget')
const pickScenario = extractCallback('pickScenario')

if (submitBudget.includes("setStep('scenarios')") || submitBudget.includes('COMMON_SCENARIOS_PROMPT')) {
  throw new Error(
    'Wizard scenario-loop guard failed: budget-form path must start the search directly after Continue, never show scenario choices after budget.'
  )
}

if (!submitBudget.includes('runDifyQuery(') || !submitBudget.includes("setStep('idle')")) {
  throw new Error(
    'Wizard scenario-loop guard failed: submitBudget must set idle and run the Dify/native search directly.'
  )
}

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

console.log('✅ wizard no-repeat budget/scenario guard passed')
