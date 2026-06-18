/** Cached result from GET /api/chat — `dify` or `native`. */
let cachedEngine = null
let inflight = null

export async function prefetchChatEngine() {
  if (cachedEngine) return cachedEngine
  if (inflight) return inflight
  inflight = fetch('/api/chat', { method: 'GET', cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) return 'native'
      const data = await res.json().catch(() => ({}))
      cachedEngine = data?.engine === 'dify' ? 'dify' : 'native'
      return cachedEngine
    })
    .catch(() => {
      cachedEngine = 'native'
      return cachedEngine
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

export function getCachedChatEngine() {
  return cachedEngine
}

export function isDifyChatEngine(engine) {
  return engine === 'dify'
}
