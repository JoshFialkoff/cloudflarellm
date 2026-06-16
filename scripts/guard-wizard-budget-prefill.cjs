#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const wizardPath = path.join(process.cwd(), "components", "AssistedlyWizard.js");
const defaultsPath = path.join(process.cwd(), "lib", "wizardFieldDefaults.js");

let wizardSource = "";
let defaultsSource = "";
try {
  wizardSource = fs.readFileSync(wizardPath, "utf8");
  defaultsSource = fs.readFileSync(defaultsPath, "utf8");
} catch (error) {
  console.error("[guard:wizard-budget-prefill] Failed reading wizard prefill sources");
  console.error(String(error && error.message ? error.message : error));
  process.exit(1);
}

if (!defaultsSource.includes("export function hasPinnedMonthlyBudget")) {
  console.error(
    "[guard:wizard-budget-prefill] lib/wizardFieldDefaults.js must export hasPinnedMonthlyBudget().",
  );
  process.exit(1);
}

if (!wizardSource.includes("hasPinnedMonthlyBudget")) {
  console.error(
    "[guard:wizard-budget-prefill] AssistedlyWizard must import and use hasPinnedMonthlyBudget before auto-suggesting budget.",
  );
  process.exit(1);
}

const budgetEffectMatch = wizardSource.match(
  /useEffect\(\(\) => \{[\s\S]*?step !== 'budget'[\s\S]*?\}, \[[^\]]+\]\)/,
);

if (!budgetEffectMatch) {
  console.error(
    "[guard:wizard-budget-prefill] Could not find budget-step useEffect in AssistedlyWizard.js.",
  );
  process.exit(1);
}

const budgetEffect = budgetEffectMatch[0];
if (
  budgetEffect.includes("suggestedMonthlyBudget") &&
  !budgetEffect.includes("hasPinnedMonthlyBudget")
) {
  console.error(
    "[guard:wizard-budget-prefill] Budget auto-suggest must gate on hasPinnedMonthlyBudget(prefilledVariables) so campaign/stored monthly_budget is never overwritten.",
  );
  process.exit(1);
}

console.log("[guard:wizard-budget-prefill] OK");
