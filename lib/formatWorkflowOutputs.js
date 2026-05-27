const PREFERRED_KEYS = ['text', 'result', 'answer', 'output', 'content', 'response']

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function extractPreferredFieldFromJsonishString(text) {
  for (const key of PREFERRED_KEYS) {
    const match = text.match(
      new RegExp(`"${escapeRegex(key)}"\\s*:\\s*"((?:\\\\.|[^"])*)"`, 's')
    )
    if (!match) continue

    const normalized = match[1].replace(/\r?\n/g, '\\n')
    try {
      return JSON.parse(`"${normalized}"`)
    } catch {
      return match[1].trim()
    }
  }

  return ''
}

function parseJsonBlock(source, startIndex) {
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = startIndex; i < source.length; i += 1) {
    const char = source[i]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (char === '\\') {
        escaped = true
        continue
      }
      if (char === '"') inString = false
      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{' || char === '[') {
      depth += 1
      continue
    }

    if (char === '}' || char === ']') {
      depth -= 1
      if (depth === 0) {
        return source.slice(startIndex, i + 1)
      }
    }
  }

  return ''
}

function parseJsonCandidates(raw) {
  const text = String(raw || '').trim()
  if (!text) return []

  try {
    return [JSON.parse(text)]
  } catch {}

  const parsed = []
  let index = 0

  while (index < text.length) {
    while (index < text.length && /\s/.test(text[index])) index += 1
    if (index >= text.length) break
    if (text[index] !== '{' && text[index] !== '[') return []

    const block = parseJsonBlock(text, index)
    if (!block) return []

    try {
      parsed.push(JSON.parse(block))
    } catch {
      return []
    }

    index += block.length
  }

  return parsed
}

export function extractAssistantReply(value, seen = new WeakSet()) {
  if (value == null) return ''

  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return ''

    const jsonCandidates = parseJsonCandidates(trimmed)
    for (const candidate of jsonCandidates) {
      const extracted = extractAssistantReply(candidate, seen)
      if (extracted) return extracted
    }

    const jsonishField = extractPreferredFieldFromJsonishString(trimmed)
    if (jsonishField) return jsonishField

    return trimmed
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractAssistantReply(item, seen)
      if (extracted) return extracted
    }
    return ''
  }

  if (typeof value !== 'object') return ''
  if (seen.has(value)) return ''
  seen.add(value)

  for (const key of PREFERRED_KEYS) {
    const extracted = extractAssistantReply(value[key], seen)
    if (extracted) return extracted
  }

  for (const key of ['data', 'outputs', 'output', 'result']) {
    const extracted = extractAssistantReply(value[key], seen)
    if (extracted) return extracted
  }

  for (const [key, nested] of Object.entries(value)) {
    if (PREFERRED_KEYS.includes(key) || ['data', 'outputs', 'output', 'result', 'files'].includes(key)) {
      continue
    }
    const extracted = extractAssistantReply(nested, seen)
    if (extracted) return extracted
  }

  return ''
}

export function formatWorkflowOutputs(outputs) {
  if (outputs == null) return ''

  const extracted = extractAssistantReply(outputs)
  if (extracted) return extracted

  if (typeof outputs === 'string') return outputs
  if (typeof outputs !== 'object' || Array.isArray(outputs)) {
    return JSON.stringify(outputs, null, 2)
  }

  const parts = []
  for (const [key, val] of Object.entries(outputs)) {
    if (val == null) continue
    if (typeof val === 'string') {
      parts.push(val)
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      parts.push(`${key}: ${String(val)}`)
    } else {
      parts.push(`${key}:\n${JSON.stringify(val, null, 2)}`)
    }
  }

  return parts.join('\n\n')
}

export function extractWorkflowOutputs(json) {
  const data = json?.data
  if (data?.outputs != null) return data.outputs
  if (json?.outputs != null) return json.outputs
  return undefined
}
