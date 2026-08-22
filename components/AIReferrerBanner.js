import { getAIReferrer } from '../lib/marketingAttribution'

const META = {
  chatgpt: { label: 'ChatGPT', emoji: '💬', sub: "Get transparent, unbiased assisted living matches—instantly." },
  perplexity: { label: 'Perplexity', emoji: '🔍', sub: "Every claim is sourced. Every match is unbiased." },
  claude: { label: 'Claude', emoji: '🧠', sub: "Thoughtful answers, transparent data, zero paywalls." },
  gemini: { label: 'Gemini', emoji: '✨', sub: "AI-powered matches with real pricing and availability." },
  copilot: { label: 'Copilot', emoji: '🤖', sub: "Find the best Massachusetts senior care options, fast." },
  meta_ai: { label: 'Meta AI', emoji: '👾', sub: "Unbiased assisted living matching, no hidden fees." },
  grok: { label: 'Grok', emoji: '🚀', sub: "Straight-talking assisted living insights for Massachusetts." },
  poe: { label: 'Poe', emoji: '📚', sub: "Ask anything about senior care—then get matched." },
  you: { label: 'You.com', emoji: '🌐', sub: "Privacy-first search leads to transparent matches." },
  phind: { label: 'Phind', emoji: '👨‍💻', sub: "Developer-grade search meets senior-care transparency." },
  kagi: { label: 'Kagi', emoji: '🔑', sub: "Premium search, premium matches—no ads, no bias." },
  duckduckgo_ai: { label: 'DuckDuckGo AI', emoji: '🦆', sub: "Private search. Transparent senior care matching." },
}

export default function AIReferrerBanner({ referrer }) {
  const ref = referrer || (typeof window !== 'undefined' ? getAIReferrer() : null)
  if (!ref) return null

  const source = META[ref] || {
    label: String(ref).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    emoji: '🤖',
    sub: "Answer a few quick questions to get your unbiased matches.",
  }

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #f4f5f7 0%, #e8f4f4 100%)',
        border: '1px solid #4a7c7e',
        borderRadius: 12,
        padding: '1rem 1.25rem',
        marginBottom: '1.25rem',
        textAlign: 'center',
      }}
    >
      <span style={{ fontWeight: 600 }}>
        {source.emoji} Coming from {source.label}? You&apos;re in the right place.
      </span>
      <span
        style={{
          display: 'block',
          marginTop: 4,
          fontSize: '0.95rem',
          color: '#4a7c7e',
          fontWeight: 500,
        }}
      >
        {source.sub}
      </span>
    </div>
  )
}
