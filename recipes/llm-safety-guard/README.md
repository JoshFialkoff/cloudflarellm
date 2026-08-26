# LLM Safety Guard Recipe

This recipe prevents LLMs from introducing specific classes of errors into the Assistedly.ai codebase.

## Forbidden Patterns
- **Code Errors:** Usage of Node `Buffer` in browser/TS snippets, incorrect `require` ordering for `path`.
- **UI Leaks:** Displaying "KB analysis:" labels or document filenames (e.g., "PDF v. 9-18-2024_LR") in facility names.

## Usage
This recipe is triggered automatically on Pull Requests and Pushes via the CI/CD workflow. It ensures deterministic output and prevents regression of the bugs fixed in June 2026.

## Maintenance
Update `FORBIDDEN_PATTERNS` in `validate.js` when new error classes are discovered.
