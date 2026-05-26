const MAX_EXTRACTED_LENGTH = 12000

export function isLikelyHtmlDocument(s) {
  const t = String(s || '').trim()
  if (t.length < 20) return false
  const head = t.slice(0, 200).toLowerCase()
  if (head.startsWith('<!doctype') || head.startsWith('<html')) return true
  if (t.length > 400 && /<html[\s>]/i.test(t) && /<\/html>/i.test(t)) return true
  return false
}

export function htmlDocumentToPlainText(html) {
  if (typeof document === 'undefined') {
    return String(html || '')
      .replace(/<script[\s\S]*?<\/script[^>]*>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style[^>]*>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html')
  const text = doc.body?.textContent || ''
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (cleaned.length > MAX_EXTRACTED_LENGTH) {
    return `${cleaned.slice(0, MAX_EXTRACTED_LENGTH)}...`
  }
  return cleaned
}

const NOTE =
  'The assistant returned a full web page (HTML) instead of a short answer. Below is the visible text only. In Dify, add a step to summarize or filter tool/HTTP output so users do not see raw HTML.\n\n---\n\n'

export function normalizeIfHtmlPageResponse(content) {
  if (!isLikelyHtmlDocument(content)) return content
  const plain = htmlDocumentToPlainText(content)
  if (!plain) {
    return `${NOTE}(No visible text could be extracted from the HTML.)`
  }
  return `${NOTE}${plain}`
}
