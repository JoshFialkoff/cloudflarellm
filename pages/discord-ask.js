import { useState, useCallback, useRef } from 'react'
import Head from 'next/head'

export default function DiscordAskPage() {
  const [question, setQuestion] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const cancelRef = useRef(false)

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    const text = question.trim()
    if (!text) return
    cancelRef.current = false
    setStatus('sending')
    setMessage('')

    try {
      const res = await fetch('/api/ask-discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, name: name.trim(), email: email.trim(), source: window.location.href }),
      })
      const data = await res.json().catch(() => ({}))
      if (!cancelRef.current) {
        if (res.ok) {
          setStatus('sent')
          setMessage('Your question was sent. Thanks!')
          setQuestion('')
        } else {
          setStatus('error')
          setMessage(data.error || 'Something went wrong. Please try again.')
        }
      }
    } catch {
      if (!cancelRef.current) {
        setStatus('error')
        setMessage('Network error. Please check your connection and try again.')
      }
    }
  }, [question, name, email])

  const isSending = status === 'sending'

  return (
    <>
      <Head>
        <title>Ask a Question | Assistedly</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <style jsx global>{`
        .discord-ask-page {
          min-height: 80vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2rem 1rem;
          background: radial-gradient(80% 60% at 20% 30%, rgba(74,124,126,0.10) 0%, transparent 60%),
                      radial-gradient(70% 50% at 80% 70%, rgba(109,18,71,0.08) 0%, transparent 55%),
                      linear-gradient(160deg, #faf8f5 0%, #f0ebe3 40%, #f5f1ec 70%, #faf8f5 100%);
        }
        .discord-ask-card {
          width: 100%;
          max-width: 640px;
          background: rgba(255,255,255,0.75);
          backdrop-filter: blur(14px) saturate(140%);
          border: 1px solid rgba(43,37,32,0.10);
          border-radius: 24px;
          padding: 2.5rem;
          box-shadow: 0 24px 60px rgba(0,0,0,0.08);
        }
        .discord-ask-card h1 {
          font-family: 'Playfair Display', serif;
          font-weight: 700;
          font-size: clamp(1.6rem, 3.2vw, 2.2rem);
          color: #2b2520;
          margin-bottom: 0.4rem;
          text-wrap: balance;
        }
        .discord-ask-card p.lead {
          color: rgba(43,37,32,0.7);
          font-size: 0.98rem;
          margin-bottom: 1.6rem;
          line-height: 1.55;
        }
        .discord-ask-form label {
          display: block;
          font-size: 0.82rem;
          font-weight: 600;
          color: #2b2520;
          margin-bottom: 0.35rem;
        }
        .discord-ask-form input,
        .discord-ask-form textarea {
          width: 100%;
          font-family: inherit;
          font-size: 0.95rem;
          padding: 0.75rem 0.95rem;
          border-radius: 12px;
          border: 1.5px solid rgba(43,37,32,0.12);
          background: rgba(255,255,255,0.6);
          outline: none;
          transition: border-color .25s, box-shadow .25s, background .25s;
          color: #2b2520;
        }
        .discord-ask-form input:focus,
        .discord-ask-form textarea:focus {
          border-color: rgba(196,149,106,0.70);
          background: rgba(255,255,255,0.85);
          box-shadow: 0 0 0 4px rgba(196,149,106,0.18);
        }
        .discord-ask-form textarea {
          resize: vertical;
          min-height: 120px;
        }
        .discord-ask-form .field {
          margin-bottom: 1rem;
        }
        .discord-ask-form .hint {
          font-size: 0.78rem;
          color: rgba(43,37,32,0.55);
          margin-top: 0.25rem;
        }
        .discord-ask-form button {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, #c4956a, #a67c52);
          color: #0a0a0a;
          border: none;
          border-radius: 12px;
          padding: 0.85rem 1.6rem;
          font-weight: 700;
          font-size: 0.98rem;
          cursor: pointer;
          transition: transform .2s, box-shadow .2s;
        }
        .discord-ask-form button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 28px rgba(196,149,106,0.28);
        }
        .discord-ask-form button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .discord-ask-status {
          margin-top: 1rem;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          font-size: 0.9rem;
          font-weight: 500;
        }
        .discord-ask-status.sent {
          background: rgba(45,106,79,0.10);
          color: #2d6a4f;
          border: 1px solid rgba(45,106,79,0.25);
        }
        .discord-ask-status.error {
          background: rgba(185,28,28,0.08);
          color: #991b1b;
          border: 1px solid rgba(185,28,28,0.20);
        }
        @media (max-width: 520px) {
          .discord-ask-card { padding: 1.6rem; border-radius: 18px; }
        }
      `}</style>

      <div className="discord-ask-page">
        <div className="discord-ask-card">
          <h1>Ask us anything</h1>
          <p className="lead">Have an open-ended question? Send it directly to our team and we&apos;ll get back to you.</p>
          <form className="discord-ask-form" onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="qa-name">Name (optional)</label>
              <input id="qa-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoComplete="name" />
            </div>
            <div className="field">
              <label htmlFor="qa-email">Email (optional)</label>
              <input id="qa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
            </div>
            <div className="field">
              <label htmlFor="qa-question">Your question</label>
              <textarea id="qa-question" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What would you like to know?" required />
              <div className="hint">Be as detailed as you like — we read every message.</div>
            </div>
            <button type="submit" disabled={isSending || !question.trim()}>
              {isSending ? 'Sending…' : 'Send Question'}
            </button>
            {status === 'sent' && (
              <div className="discord-ask-status sent">{message}</div>
            )}
            {status === 'error' && (
              <div className="discord-ask-status error">{message}</div>
            )}
          </form>
        </div>
      </div>
    </>
  )
}
