/**
 * Dify API URL resolution.
 *
 * ⚠️ CRITICAL: DIFY_API_BASE_URL must NOT include /api/ prefix.
 *   CORRECT:   https://dify.forwardjump.com/v1
 *   WRONG:     https://dify.forwardjump.com/api/v1  ← causes 404 (hits Console API, not public API)
 *
 * The Dify nginx proxy routes:
 *   /api  → Console API (login, apps CRUD). Does NOT serve chat-messages.
 *   /v1   → Public API  (chat-messages, workflows/run, parameters). This is the correct path.
 */
export function normalizeDifyApiBaseUrl(raw) {
  let base = String(raw || '').replace(/\/$/, '')

  // Strip known API-path suffixes so the caller always gets a clean base.
  for (const suffix of ['/chat-messages', '/workflows/run', '/v1/chat-messages', '/v1/workflows/run']) {
    if (base.endsWith(suffix)) {
      base = base.slice(0, -suffix.length).replace(/\/$/, '')
      break
    }
  }

  // Runtime guard: detect the common /api/v1 mistake.
  if (/\/api\/v1/i.test(base)) {
    console.error(
      'CRITICAL CONFIG ERROR: DIFY_API_BASE_URL contains /api/v1 — this will 404.\n' +
      '  CORRECT:   https://dify.forwardjump.com/v1\n' +
      '  WRONG:     https://dify.forwardjump.com/api/v1\n' +
      `  Current value: ${base}`
    )
  }

  return base
}

export function resolveDifyServiceUrls(baseRaw) {
  const base = String(baseRaw || '').replace(/\/$/, '')
  const hasV1Suffix = base.endsWith('/v1')
  return {
    chatMessages: hasV1Suffix ? `${base}/chat-messages` : `${base}/v1/chat-messages`,
    workflowsRun: hasV1Suffix ? `${base}/workflows/run` : `${base}/v1/workflows/run`,
    parameters: hasV1Suffix ? `${base}/parameters` : `${base}/v1/parameters`,
  }
}
