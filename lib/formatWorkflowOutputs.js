export function formatWorkflowOutputs(outputs) {
  if (outputs == null) return ''
  if (typeof outputs === 'string') return outputs
  if (typeof outputs !== 'object' || Array.isArray(outputs)) {
    return JSON.stringify(outputs, null, 2)
  }

  const preferredKeys = ['text', 'result', 'answer', 'output', 'content', 'response']
  for (const key of preferredKeys) {
    const v = outputs[key]
    if (typeof v === 'string' && v.length > 0) return v
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
