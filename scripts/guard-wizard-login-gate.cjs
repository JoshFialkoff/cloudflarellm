#!/usr/bin/env node
/**
 * CI/CD guard: Prevents the passwordless login gate from becoming the FIRST
 * step of the AssistedlyWizard. The login gate must ONLY appear AFTER a user
 * has found facilities they like (post-results), never as an entry barrier.
 *
 * Background: commit 7fa1cf7 changed the default step from 'urgency' to 'login'
 * and auto-triggered a deep-dive before users ever saw facility results.
 * This regressed the core UX and was deployed multiple times despite explicit
 * instructions against it. This guard fails the build if those patterns return.
 *
 * Must run AFTER `npm run build` (or during lint) and BEFORE deploy.
 */
const fs = require("fs");
const path = require("path");

const WIZARD_PATH = path.join(process.cwd(), "components", "AssistedlyWizard.js");

let source = "";
try {
  source = fs.readFileSync(WIZARD_PATH, "utf8");
} catch (error) {
  console.error("[guard:wizard-login-gate] Failed reading components/AssistedlyWizard.js");
  console.error(String(error && error.message ? error.message : error));
  process.exit(1);
}

let failed = false;

// 1. Forbidden exact phrase — this was the intro text shown to every visitor.
const FORBIDDEN_PHRASE = "Login with no passwords ever and get information on Massachusetts assisted living facilities.";
if (source.includes(FORBIDDEN_PHRASE)) {
  console.error(
    "[guard:wizard-login-gate] ❌ FORBIDDEN PHRASE found in AssistedlyWizard.js:\n" +
    `   "${FORBIDDEN_PHRASE}"\n` +
    "   → This text must NEVER appear as the wizard entry point.\n" +
    "   → Passwordless login may ONLY be offered AFTER facility results."
  );
  failed = true;
}

// 2. Default step must be 'urgency', never 'login'.
//    Use a regex that finds the state declaration even with line breaks.
const DEFAULT_STEP_PATTERN = /const\s+\[step\s*,\s*setStep\s*\]\s*=\s*useState\s*\(\s*['"`]/;
const defaultStepMatch = source.match(DEFAULT_STEP_PATTERN);
if (!defaultStepMatch) {
  console.error(
    "[guard:wizard-login-gate] ❌ Could not find default step declaration (useState for 'step').\n" +
    "   → The wizard must explicitly declare its initial step."
  );
  failed = true;
} else {
  // Look at the next few characters after the quote
  const idx = defaultStepMatch.index + defaultStepMatch[0].length;
  const nextChars = source.slice(idx, idx + 20);
  if (nextChars.startsWith("login") || nextChars.startsWith('login')) {
    console.error(
      "[guard:wizard-login-gate] ❌ Default wizard step is 'login'.\n" +
      "   → Initial step must be 'urgency' so users see facility results first.\n" +
      "   → Any login gating must happen AFTER results, never before."
    );
    failed = true;
  } else if (!nextChars.startsWith("urgency") && !nextChars.startsWith('urgency')) {
    console.error(
      "[guard:wizard-login-gate] ⚠️ Default wizard step is neither 'login' nor 'urgency'.\n" +
      `   → Found: "${nextChars.replace(/['"].*/, '')}"\n` +
      "   → Expected: 'urgency' (or a step that leads to facility results first)."
    );
    failed = true;
  }
}

// 3. Initial intro bubble must be UrgencyIntroBubble, not LoginIntroBubble.
const initialLinesPattern = /setLines\s*\(\s*\(\)\s*=>\s*\[/;
const linesMatch = source.match(initialLinesPattern);
if (linesMatch) {
  const blockStart = linesMatch.index;
  // Grab a generous chunk after setLines(() => [
  const blockCandidate = source.slice(blockStart, blockStart + 600);
  if (blockCandidate.includes("<LoginIntroBubble")) {
    console.error(
      "[guard:wizard-login-gate] ❌ LoginIntroBubble is present in the initial lines array.\n" +
      "   → The first thing a visitor sees must be UrgencyIntroBubble, not a login prompt.\n" +
      "   → LoginIntroBubble may only be injected after facility results are shown."
    );
    failed = true;
  }
  if (!blockCandidate.includes("<UrgencyIntroBubble")) {
    console.error(
      "[guard:wizard-login-gate] ⚠️ UrgencyIntroBubble is missing from the initial lines array.\n" +
      "   → Ensure the first bot message is the urgency question, not a login gate."
    );
    failed = true;
  }
}

// 4. Auto-triggered deep-dive automation must not run before results.
//    The runDeepDiveAutomation callback must NOT be invoked in useEffect or
//    directly during mount before the user has selected facilities.
const DEEP_DIVE_AUTO_TRIGGER = /useEffect\s*\(\s*\(\)\s*=>\s*\{[\s\S]{0,400}?runDeepDiveAutomation\s*\(\)/;
if (source.match(DEEP_DIVE_AUTO_TRIGGER)) {
  console.error(
    "[guard:wizard-login-gate] ❌ runDeepDiveAutomation is auto-triggered on mount.\n" +
    "   → Deep-dive reports must only run after the user has found facilities.\n" +
    "   → Remove any useEffect or direct mount call that fires it automatically."
  );
  failed = true;
}

if (failed) {
  console.error(
    "\n[guard:wizard-login-gate] FATAL: Login-gate regression detected.\n" +
    "  → If you intentionally need login BEFORE results, update this guard AND\n" +
    "    get explicit sign-off from the product owner.\n"
  );
  process.exit(1);
}

console.log("[guard:wizard-login-gate] ✅ OK — login gate is not the entry step.");
