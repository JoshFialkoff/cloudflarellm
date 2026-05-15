export function normalizeDifyApiBaseUrl(raw) {
  let base = String(raw || '').replace(/\/$/, '')
  for (const suffix of ['/chat-messages', '/workflows/run', '/v1/chat-messages', '/v1/workflows/run']) {
    if (base.endsWith(suffix)) {
      base = base.slice(0, -suffix.length).replace(/\/$/, '')
      break
    }
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
