// ⚠️ CRITICAL_FEATURE: Ask / Chat — NEVER REMOVE without !!APPROVED
// Primary free-form Q&A interface. Must remain fully functional.
import { useState, useEffect, useRef, useCallback } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { streamDifyChatResponse } from '../../lib/streamDifyChat'
import { trackChatStarted, trackMessageSent, trackChatCompleted, messagePreview } from '../../lib/chatAnalytics'
import { safeIdentify } from '../../lib/posthogClient'
import { pushConversionDataLayer } from '../../lib/conversionDataLayer'
import { captureLandingEvent } from '../../lib/landingAnalytics'
import { syncMarketingTouchFromUrl } from '../../lib/marketingAttribution'

function uid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const arr = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(arr)
  else { for (let i = 0; i < 16; i++) arr[i] = Math.floor(Math.random() * 256) }
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('')
}

function getOrCreateUserId() {
  if (typeof window === 'undefined') return 'anonymous'
  try {
    const key = 'assistedly-dify-user-id-v2'
    let id = window.sessionStorage.getItem(key)
    if (!id) { id = uid(); window.sessionStorage.setItem(key, id) }
    return id
  } catch { return 'u-' + Date.now() }
}

export default function AskPage() {
  const [inputValue, setInputValue] = useState('')
  const [messages, setMessages] = useState([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [conversationId, setConversationId] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [rotatingPlaceholder, setRotatingPlaceholder] = useState("What questions should I ask on a tour?")
  const [showEmailCapture, setShowEmailCapture] = useState(false)
  const [emailValue, setEmailValue] = useState('')
  const [emailSubmitted, setEmailSubmitted] = useState(false)
  const userIdRef = useRef(null)
  const chatThreadRef = useRef(null)
  const chatStartedTracked = useRef(false)

  useEffect(() => { userIdRef.current = getOrCreateUserId() }, [])
  useEffect(() => {
    syncMarketingTouchFromUrl()
    captureLandingEvent('ask_page_mounted', { page_path: '/ask', bot_surface: 'ask_page', assistant_mode: 'dify_inline' })
  }, [])
  useEffect(() => {
    if (chatThreadRef.current) {
      chatThreadRef.current.scrollTop = chatThreadRef.current.scrollHeight
    }
  }, [messages, isStreaming])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const nav = document.getElementById('topnav')
    const onScroll = () => { if (nav) nav.classList.toggle('scrolled', window.scrollY > 40) }
    window.addEventListener('scroll', onScroll, { passive: true })
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObserver.unobserve(e.target); } })
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el))
    const numObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        const el = entry.target
        const target = parseInt(el.dataset.target, 10)
        const suffix = el.dataset.suffix || ''
        const duration = 1600; const start = performance.now()
        const tick = (now) => {
          const p = Math.min(1, (now - start) / duration)
          const ease = 1 - Math.pow(1 - p, 3)
          el.textContent = Math.floor(ease * target).toLocaleString() + suffix
          if (p < 1) requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
        numObserver.unobserve(el)
      })
    }, { threshold: 0.5 })
    document.querySelectorAll('.stat-num').forEach(el => numObserver.observe(el))
    return () => { window.removeEventListener('scroll', onScroll); revealObserver.disconnect(); numObserver.disconnect() }
  }, [])

  useEffect(() => {
    const questions = [
      "What questions should I ask on a tour?",
      "Create a guide for someone just starting their search",
      "What should I ask before putting down a deposit?"
    ]
    let idx = 0; let cancelled = false
    const cycle = async () => { while (!cancelled) { await new Promise(r => setTimeout(r, 4000)); if (cancelled) break; idx = (idx + 1) % questions.length; setRotatingPlaceholder(questions[idx]) } }
    cycle()
    return () => { cancelled = true }
  }, [])

  const handleSend = useCallback(async (textOverride) => {
    let text = (textOverride !== undefined ? textOverride : inputValue).trim()
    if (!text) text = rotatingPlaceholder
    if (isStreaming) return
    if (!text && !isChatOpen) { setIsChatOpen(true); return }
    if (!text) return
    if (!isChatOpen) setIsChatOpen(true)
    setInputValue('')
    setIsStreaming(true)
    setStatusMsg('Thinking…')
    const isFirstMessage = messages.length === 0
    if (isFirstMessage && !chatStartedTracked.current) {
      chatStartedTracked.current = true
      trackChatStarted({ bot_surface: 'ask_page', assistant_mode: 'dify_inline', lead_source: 'ask_page_dify' })
    }
    const userMsgIndex = messages.filter(m => m.role === 'user').length
    setMessages(prev => [...prev, { role: 'user', content: text }])
    trackMessageSent({ message_index: userMsgIndex, message_preview: messagePreview(text), bot_surface: 'ask_page', assistant_mode: 'dify_inline' })

    let assistantContent = ''
    try {
      await streamDifyChatResponse(
        text,
        userIdRef.current,
        conversationId,
        {
          onDelta: (delta) => {
            assistantContent += delta
            setMessages(prev => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last && last.role === 'assistant') {
                next[next.length - 1] = { ...last, content: assistantContent, streaming: true }
              } else {
                next.push({ role: 'assistant', content: assistantContent, streaming: true })
              }
              return next
            })
          },
          onStatus: (msg) => setStatusMsg(msg),
          onConversationId: (id) => setConversationId(id),
          onStreamError: (msg) => {
            setMessages(prev => {
              const next = [...prev]
              const last = next[next.length - 1]
              const errorText = "Oh no! My AI awesomeness is on break. I'll ask my humans for help. Tell me your email or phone number if you want me to let you know when the AI is working."
              if (last && last.role === 'assistant') {
                next[next.length - 1] = { ...last, content: errorText, streaming: false }
              } else {
                next.push({ role: 'assistant', content: errorText, streaming: false })
              }
              return next
            })
            setIsStreaming(false)
            setStatusMsg('')
          },
          onFinal: (answer) => {
            setMessages(prev => {
              const next = [...prev]
              const last = next[next.length - 1]
              if (last && last.role === 'assistant') {
                next[next.length - 1] = { ...last, content: answer, streaming: false }
              } else {
                next.push({ role: 'assistant', content: answer, streaming: false })
              }
              return next
            })
            setIsStreaming(false)
            setStatusMsg('')
            trackChatCompleted({ bot_surface: 'ask_page', assistant_mode: 'dify_inline', lead_source: 'ask_page_dify' })
            setShowEmailCapture(true)
          },
        },
        undefined,
        '/api/ask-chat'
      )
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "Oh no! My AI awesomeness is on break. I'll ask my humans for help. Tell me your email or phone number if you want me to let you know when the AI is working.", streaming: false }])
      setIsStreaming(false)
      setStatusMsg('')
    }
  }, [inputValue, isStreaming, conversationId, isChatOpen, rotatingPlaceholder, messages])

  const handleEmailSubmit = useCallback(() => {
    const email = emailValue.trim()
    if (!email) return
    safeIdentify(email)
    trackChatCompleted({ bot_surface: 'ask_page', assistant_mode: 'dify_inline', lead_source: 'ask_page_email_fallback', funnel_stage: 'lead_submitted', email_provided: true }, { leadOnly: true })
    pushConversionDataLayer({ event: 'lead_submitted', lead_source: 'ask_page_email_fallback', email_provided: true })
    setEmailSubmitted(true)
  }, [emailValue])

  return (
    <>
      <Head>
        <title>Assistedly — Private AI for Assisted Living in Massachusetts</title>
        <meta name="description" content="Private AI for Massachusetts assisted living. No brokers, no data sold. Founded by a son who found care for his mom." />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:ital,wght@0,600;0,700;1,600&display=swap" rel="stylesheet" />
      </Head>
      <style jsx global>{`

  :root {
    --teal: #4a7c7e;
    --plum: #6d1247;
    --gold: #c4956a;
    --bg-warm: #f5f1ec;
    --bg-cream: #faf8f5;
    --text: #2b2520;
    --text-dim: rgba(43,37,32,0.7);
    --radius: 20px;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    font-family: 'Inter', system-ui, sans-serif;
    background: var(--bg-warm);
    color: var(--text);
    line-height: 1.55;
    overflow-x: hidden;
    -webkit-font-smoothing: antialiased;
  }

  nav {
    position: fixed; inset: 0 0 auto; z-index: 1000;
    padding: 1.1rem 2rem;
    display: flex; align-items: center; justify-content: space-between;
    background: transparent;
    transition: background .35s ease, backdrop-filter .35s ease, box-shadow .35s ease;
  }
  nav.scrolled {
    background: rgba(245,241,236,0.88);
    backdrop-filter: blur(14px) saturate(160%);
    box-shadow: 0 1px 0 rgba(43,37,32,0.06);
  }
  .logo { font-family: 'Playfair Display', serif; font-weight: 700; font-size: 1.45rem; color: var(--text); letter-spacing: -0.02em; text-decoration: none; }
  .logo span { color: var(--gold); }
  .nav-links { display: flex; gap: 2rem; align-items: center; list-style: none; }
  .nav-links a { color: var(--text-dim); text-decoration: none; font-size: 0.92rem; font-weight: 500; transition: color .2s; }
  .nav-links a:hover { color: var(--text); }
  .nav-cta {
    background: linear-gradient(135deg, var(--gold), #a67c52);
    color: #0a0a0a; padding: 0.55rem 1.15rem; border-radius: 10px;
    font-weight: 700; font-size: 0.88rem; text-decoration: none;
    transition: transform .2s, box-shadow .2s;
  }
  .nav-cta:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(196,149,106,0.25); }

  .hero {
    position: relative; min-height: 100svh; display: flex; align-items: center; justify-content: center;
    overflow: hidden; padding: 8rem 2rem 6rem;
  }
  .hero-bg {
    position: absolute; inset: 0; z-index: 0;
    background:
      radial-gradient(80% 60% at 20% 30%, rgba(74,124,126,0.18) 0%, transparent 60%),
      radial-gradient(70% 50% at 80% 70%, rgba(109,18,71,0.14) 0%, transparent 55%),
      radial-gradient(60% 40% at 50% 50%, rgba(196,149,106,0.22) 0%, transparent 50%),
      linear-gradient(160deg, #faf8f5 0%, #f0ebe3 40%, #f5f1ec 70%, #faf8f5 100%);
  }
  .hero-grid {
    position: absolute; inset: 0; z-index: 0; opacity: 0.06;
    background-image: linear-gradient(rgba(43,37,32,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(43,37,32,0.08) 1px, transparent 1px);
    background-size: 60px 60px;
    mask-image: radial-gradient(ellipse at center, black 20%, transparent 80%);
    -webkit-mask-image: radial-gradient(ellipse at center, black 20%, transparent 80%);
  }
  .hero-content { position: relative; z-index: 1; max-width: 980px; text-align: center; }
  .hero-kicker {
    display: inline-block; padding: 0.35rem 0.9rem; border-radius: 999px;
    background: rgba(196,149,106,0.15); border: 1px solid rgba(196,149,106,0.35);
    color: #8b5e2e; font-weight: 600; font-size: 0.78rem; letter-spacing: 0.06em; text-transform: uppercase;
    margin-bottom: 1.4rem; opacity: 0; transform: translateY(12px);
    animation: fadeUp .8s .2s ease forwards;
  }
  .hero h1 {
    font-family: 'Playfair Display', serif; font-weight: 700; font-size: clamp(2.4rem, 5.5vw, 4.6rem);
    line-height: 1.1; letter-spacing: -0.02em; margin-bottom: 1.2rem;
    background: linear-gradient(135deg, #2b2520 30%, #5c4d3c 60%, #8b5e2e 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
    opacity: 0; transform: translateY(18px);
    animation: fadeUp .9s .4s ease forwards;
  }
  .hero p.lead {
    font-size: clamp(1.05rem, 2vw, 1.35rem); color: var(--text-dim); max-width: 640px; margin: 0 auto 2.2rem;
    font-weight: 400; line-height: 1.6;
    opacity: 0; transform: translateY(14px);
    animation: fadeUp .9s .6s ease forwards;
  }
  .hero-buttons {
    display: flex; gap: 0.9rem; justify-content: center; flex-wrap: wrap;
    opacity: 0; transform: translateY(10px);
    animation: fadeUp .8s .85s ease forwards;
  }
  .btn-gold {
    display: inline-flex; align-items: center; gap: 0.5rem;
    background: linear-gradient(135deg, var(--gold), #a67c52);
    color: #0a0a0a; padding: 0.85rem 1.8rem; border-radius: 12px;
    font-weight: 700; font-size: 0.98rem; text-decoration: none; border: none; cursor: pointer;
    transition: transform .25s cubic-bezier(.2,.8,.2,1), box-shadow .25s;
  }
  .btn-gold:hover { transform: translateY(-2px) scale(1.02); box-shadow: 0 12px 30px rgba(196,149,106,0.28); }

  .search-box {
    display: flex; align-items: center; gap: 0.6rem;
    background: rgba(255,255,255,0.55);
    border: 1.5px solid rgba(196,149,106,0.40);
    border-radius: 14px;
    padding: 0.85rem 1.2rem;
    transition: border-color .25s, box-shadow .25s, background .25s;
    cursor: text;
  }
  .search-box:focus-within {
    border-color: rgba(196,149,106,0.70);
    background: rgba(255,255,255,0.80);
    box-shadow: 0 0 0 4px rgba(196,149,106,0.20);
  }
  .search-box svg { flex-shrink: 0; opacity: 0.7; }
  .search-typing {
    color: var(--text-dim);
    font-family: inherit;
    font-size: 1rem;
    background: transparent;
    border: none;
    outline: none;
    flex: 1;
    min-width: 0;
    cursor: text;
  }
  .search-box .send-btn {
    background: linear-gradient(135deg, var(--gold), #a67c52);
    color: #0a0a0a;
    border: none;
    border-radius: 10px;
    padding: 0.45rem 1rem;
    font-weight: 700;
    font-size: 0.85rem;
    cursor: pointer;
    transition: transform 0.2s ease;
    flex-shrink: 0;
  }
  .search-box .send-btn:hover { transform: translateY(-1px); }
  .search-box .send-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .search-hint {
    text-align: center; font-size: 0.78rem; color: var(--text-dim); margin-top: 0.5rem; letter-spacing: 0.02em;
  }
  .search-hint span { color: #8b5e2e; font-weight: 500; }

  .hero-float-cards {
    position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
  }
  .float-card {
    position: absolute; background: rgba(255,255,255,0.60); border: 1px solid rgba(43,37,32,0.08);
    backdrop-filter: blur(10px); border-radius: 16px; padding: 1rem 1.2rem;
    color: var(--text-dim); font-size: 0.82rem; font-weight: 500; white-space: nowrap;
    box-shadow: 0 20px 60px rgba(0,0,0,0.08);
  }
  .fc-1 { top: 18%; left: 8%; animation: floatA 7s ease-in-out infinite; }
  .fc-2 { top: 28%; right: 10%; animation: floatA 9s ease-in-out 1s infinite reverse; }
  .fc-3 { bottom: 22%; left: 12%; animation: floatA 8s ease-in-out 2s infinite; }
  .fc-4 { bottom: 18%; right: 8%; animation: floatA 6s ease-in-out 0.5s infinite reverse; }
  @keyframes floatA { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }

  .stats {
    position: relative; z-index: 2; padding: 3.5rem 2rem;
    background: linear-gradient(180deg, transparent, rgba(74,124,126,0.10));
  }
  .stats-inner {
    max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(4, 1fr); gap: 2rem;
  }
  .stat { text-align: center; }
  .stat-num {
    font-family: 'Playfair Display', serif; font-weight: 700; font-size: clamp(2rem, 3.5vw, 3rem);
    background: linear-gradient(135deg, #2b2520, #8b5e2e); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .stat-label { font-size: 0.82rem; color: var(--text-dim); margin-top: 0.2rem; letter-spacing: 0.04em; text-transform: uppercase; font-weight: 500; }

  section { padding: 6rem 2rem; position: relative; }
  .reveal { opacity: 0; transform: translateY(30px); transition: opacity .9s cubic-bezier(.2,.8,.2,1), transform .9s cubic-bezier(.2,.8,.2,1); }
  .reveal.visible { opacity: 1; transform: translateY(0); }

  .section-title {
    font-family: 'Playfair Display', serif; font-weight: 700; font-size: clamp(1.8rem, 3.6vw, 3rem);
    line-height: 1.15; text-wrap: balance; margin-bottom: 0.6rem; color: var(--text);
  }
  .section-sub {
    color: var(--text-dim); font-size: clamp(0.95rem, 1.4vw, 1.1rem); max-width: 600px; line-height: 1.6;
  }

  .hiw { max-width: 1100px; margin: 0 auto; }
  .hiw-item { display: grid; grid-template-columns: 1fr 1fr; gap: 3.5rem; align-items: center; margin-bottom: 5rem; }
  .hiw-item:nth-child(even) .hiw-visual { order: 2; }
  .hiw-visual {
    position: relative; border-radius: var(--radius); overflow: hidden;
    background: linear-gradient(135deg, rgba(74,124,126,0.18), rgba(109,18,71,0.14));
    aspect-ratio: 16/10; display: flex; align-items: center; justify-content: center;
    border: 1px solid rgba(43,37,32,0.08);
  }
  .hiw-visual svg { width: 55%; height: 55%; opacity: 0.8; }
  .step-num {
    position: absolute; top: 1rem; left: 1rem; width: 2.2rem; height: 2.2rem; border-radius: 50%;
    display: grid; place-items: center; font-weight: 800; font-size: 0.85rem;
    background: rgba(196,149,106,0.25); color: #8b5e2e; border: 1px solid rgba(196,149,106,0.45);
  }
  .hiw-body h3 { font-family: 'Playfair Display', serif; font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--text); }
  .hiw-body p { color: var(--text-dim); line-height: 1.7; }
  .hiw-body ul { margin-top: 0.8rem; padding-left: 1.1rem; color: var(--text-dim); }
  .hiw-body li { margin-bottom: 0.35rem; }

  .promo-strip {
    background: linear-gradient(90deg, rgba(109,18,71,0.10), rgba(74,124,126,0.08), rgba(196,149,106,0.15));
    padding: 2.2rem 2rem; text-align: center;
    border-top: 1px solid rgba(196,149,106,0.25);
    border-bottom: 1px solid rgba(196,149,106,0.25);
  }
  .promo-text {
    font-family: 'Playfair Display', serif; font-size: clamp(1.3rem, 2.8vw, 1.8rem);
    font-weight: 600; color: var(--text);
  }
  .promo-text em { color: var(--gold); font-style: italic; }

  .trust { background: linear-gradient(180deg, rgba(74,124,126,0.08), rgba(109,18,71,0.05)); }
  .trust-grid { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.4rem; }
  .trust-card {
    background: linear-gradient(135deg, rgba(255,255,255,0.65), rgba(255,255,255,0.40));
    border: 1px solid rgba(43,37,32,0.08); border-radius: var(--radius);
    padding: 1.8rem; transition: transform .3s, border-color .3s, box-shadow .3s;
  }
  .trust-card:hover { transform: translateY(-4px); border-color: rgba(196,149,106,0.35); box-shadow: 0 20px 60px rgba(0,0,0,0.10); }
  .trust-quote { font-style: italic; color: var(--text-dim); font-size: 0.98rem; line-height: 1.65; margin-bottom: 1.2rem; }
  .trust-author { display: flex; align-items: center; gap: 0.7rem; }
  .trust-avatar { width: 2.4rem; height: 2.4rem; border-radius: 50%; background: linear-gradient(135deg, var(--teal), var(--plum)); }
  .trust-name { font-weight: 600; font-size: 0.9rem; }
  .trust-role { font-size: 0.78rem; color: var(--text-dim); }

  .guides-grid { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.4rem; }
  @media (max-width: 860px) { .guides-grid { grid-template-columns: 1fr; } }
  .guide-card {
    background: linear-gradient(135deg, rgba(255,255,255,0.65), rgba(255,255,255,0.40));
    border: 1px solid rgba(43,37,32,0.08); border-radius: var(--radius);
    padding: 2rem; transition: transform .3s, border-color .3s, box-shadow .3s;
    cursor: pointer; text-decoration: none; color: inherit; display: block;
  }
  .guide-card:hover { transform: translateY(-4px); border-color: rgba(196,149,106,0.40); box-shadow: 0 20px 60px rgba(0,0,0,0.10); }
  .guide-icon { font-size: 1.8rem; margin-bottom: 0.8rem; }
  .guide-card h4 { font-family: 'Playfair Display', serif; font-size: 1.15rem; margin-bottom: 0.4rem; color: var(--text); }
  .guide-card p { font-size: 0.88rem; color: var(--text-dim); line-height: 1.55; }

  .cta-band {
    position: relative; overflow: hidden;
    background:
      radial-gradient(60% 50% at 30% 40%, rgba(74,124,126,0.14), transparent 60%),
      radial-gradient(50% 50% at 70% 60%, rgba(109,18,71,0.12), transparent 55%),
      linear-gradient(135deg, #f0ece6, #ebe6df);
    padding: 7rem 2rem; text-align: center;
  }
  .cta-band h2 { font-family: 'Playfair Display', serif; font-size: clamp(2rem, 4.5vw, 3.4rem); line-height: 1.1; margin-bottom: 1rem; }
  .cta-band p { color: var(--text-dim); max-width: 520px; margin: 0 auto 1.8rem; font-size: 1.05rem; }

  footer { padding: 3rem 2rem 2.5rem; border-top: 1px solid rgba(43,37,32,0.10); }
  .footer-inner { max-width: 1100px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
  .footer-brand { font-family: 'Playfair Display', serif; font-size: 1.2rem; color: var(--text); text-decoration: none; }
  .footer-links { display: flex; gap: 1.4rem; }
  .footer-links a { color: var(--text-dim); text-decoration: none; font-size: 0.85rem; transition: color .2s; }
  .footer-links a:hover { color: var(--text); }
  .footer-copy { font-size: 0.78rem; color: var(--text-dim); opacity: 0.7; }

  @media (max-width: 860px) {
    .nav-links { display: none; }
    .stats-inner { grid-template-columns: repeat(2, 1fr); }
    .hiw-item { grid-template-columns: 1fr; }
    .hiw-item:nth-child(even) .hiw-visual { order: 0; }
    .trust-grid { grid-template-columns: 1fr; }
    .float-card { display: none; }
  }
  @media (max-width: 520px) {
    .hero { padding: 7rem 1.2rem 4rem; }
    section { padding: 4rem 1.2rem; }
    .stats-inner { grid-template-columns: 1fr 1fr; gap: 1.2rem; }
  }
  @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }

  .search-wrap {
    max-width: 640px; margin: 0 auto 3rem;
    position: relative;
    opacity: 0; transform: translateY(10px);
    animation: fadeUp 1s 1.1s ease forwards;
  }
  .chat-thread-inline {
    background: linear-gradient(135deg, rgba(255,255,255,0.65), rgba(255,255,255,0.40));
    border: 1px solid rgba(43,37,32,0.10);
    border-radius: 20px;
    padding: 1.2rem;
    max-height: 45vh;
    overflow-y: auto;
    text-align: left;
    margin-bottom: 0.8rem;
    transition: opacity 0.3s ease;
    opacity: 0;
  }
  .chat-thread-inline.has-messages {
    opacity: 1;
  }
  .chat-msg { margin-bottom: 0.8rem; display: flex; gap: 0.7rem; }
  .chat-msg.user { flex-direction: row-reverse; }
  .chat-msg.user .chat-bubble { background: linear-gradient(135deg, var(--plum), #4a0e30); color: #fff; border-color: transparent; }
  .chat-bubble {
    padding: 0.8rem 1.1rem;
    border-radius: 16px;
    font-size: 0.95rem;
    line-height: 1.55;
    max-width: 82%;
    background: #fff;
    border: 1px solid rgba(43,37,32,0.08);
    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  }
  .chat-status {
    text-align: center;
    font-size: 0.78rem;
    color: var(--text-dim);
    padding: 0.4rem;
    font-weight: 500;
  }

  
      `}</style>


<nav id="topnav">
  <Link href="/ask" className="logo">Assisted<span>ly</span></Link>
  <ul className="nav-links">
    <li><a href="#how">How It Works</a></li>
    <li><a className="nav-cta" href="#" onClick={(e) => { e.preventDefault(); setIsChatOpen(true); document.getElementById("ai-input")?.focus(); }}>Get Started</a></li>
  </ul>
</nav>

<section className="hero">
  <div className="hero-bg" aria-hidden="true"></div>
  <div className="hero-grid" aria-hidden="true"></div>
  <div className="hero-float-cards" aria-hidden="true">
    <div className="float-card fc-1">✨ AI-matched in 90 seconds</div>
    <div className="float-card fc-2">🛡️ 100% Unbiased</div>
    <div className="float-card fc-3">🔒 Private — no data sold</div>
    <div className="float-card fc-4">💰 Transparent costs</div>
  </div>
  <div className="hero-content">
    <div className="hero-kicker">Private AI for Massachusetts families</div>
    <h1>Keep Your Family&apos;s Questions<br />Private — Get Real Answers</h1>
    <p className="lead">Founded by a son forced to find 3 assisted living facilities for his mom. No brokers, no salespeople, no data sold. Just private AI answering the questions you don&apos;t want to post on Facebook.</p>

    <div className="search-wrap">
      <div className={"chat-thread-inline " + (messages.length > 0 ? "has-messages" : "")} ref={chatThreadRef}>
        {messages.map((msg, i) => (
          <div key={i} className={"chat-msg " + msg.role}>
            <div className="chat-bubble">
              {msg.role === "assistant" && !msg.streaming ? (
                <div dangerouslySetInnerHTML={{ __html: msg.content }} />
              ) : (
                <div style={{ whiteSpace: "pre-wrap" }}>{msg.content}</div>
              )}
            </div>
          </div>
        ))}
        {isStreaming && statusMsg && (
          <div className="chat-status">{statusMsg}</div>
        )}
      </div>

      {showEmailCapture && !emailSubmitted && !isStreaming && messages.length > 0 && (
        <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 16, padding: '1rem 1.2rem', marginBottom: '0.8rem', border: '1px solid rgba(196,149,106,0.35)', textAlign: 'left' }}>
          <p style={{ fontSize: '0.9rem', color: '#2b2520', marginBottom: '0.6rem', fontWeight: 500 }}>Want us to follow up with personalized Massachusetts facility matches?</p>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input type="email" placeholder="your@email.com" value={emailValue} onChange={(e) => setEmailValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleEmailSubmit() }} style={{ flex: 1, padding: '0.55rem 0.9rem', borderRadius: 10, border: '1px solid rgba(43,37,32,0.15)', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }} />
            <button onClick={handleEmailSubmit} style={{ background: 'linear-gradient(135deg, #c4956a, #a67c52)', color: '#0a0a0a', border: 'none', borderRadius: 10, padding: '0.55rem 1.1rem', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer', transition: 'transform .2s' }}>Send</button>
          </div>
        </div>
      )}
      {emailSubmitted && (
        <div style={{ textAlign: 'center', padding: '0.8rem', color: '#2d6a4f', fontWeight: 600, fontSize: '0.9rem' }}>✓ We&apos;ll be in touch soon.</div>
      )}

      <div className="search-box" onClick={() => document.getElementById("ai-input")?.focus()}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#8b5e2e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
        <input type="text" id="ai-input" className="search-typing" placeholder={messages.length > 0 ? "Ask a follow-up..." : rotatingPlaceholder} autoComplete="off" value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }} disabled={isStreaming} />
        <button className="send-btn" onClick={(e) => { e.stopPropagation(); handleSend(); }} disabled={isStreaming}>Send</button>
      </div>
      {messages.length === 0 && <div className="search-hint">Try: <span>{rotatingPlaceholder}</span></div>}
    </div>

    <div className="hero-buttons">
      <button className="btn-gold" onClick={() => { if (inputValue.trim()) { handleSend(); } else { document.getElementById("ai-input")?.focus(); } }}>Get AI Help</button>
    </div>
  </div>
</section>

<section className="stats">
  <div className="stats-inner">
    <div className="stat reveal"><div className="stat-num" data-target="47000">0</div><div className="stat-label">Facilities Evaluated</div></div>
    <div className="stat reveal"><div className="stat-num" data-target="1200">0</div><div className="stat-label">Massachusetts Homes</div></div>
    <div className="stat reveal"><div className="stat-num" data-target="98" data-suffix="%">0</div><div className="stat-label">Unbiased Matching</div></div>
    <div className="stat reveal"><div className="stat-num" data-target="5">0</div><div className="stat-label">Min. To First Match</div></div>
  </div>
</section>

<section className="promo-strip reveal">
  <div className="promo-text">You&apos;re not alone in this. <em>We&apos;re here to help.</em></div>
</section>

<section id="how">
  <div className="hiw">
    <div style={{ textAlign: "center", marginBottom: "3.5rem" }} className="reveal">
      <h2 className="section-title">How Assistedly Works</h2>
      <p className="section-sub" style={{ margin: "0 auto" }}>Three steps from confusion to clarity.</p>
    </div>

    <div className="hiw-item reveal">
      <div className="hiw-visual">
        <div className="step-num">1</div>
        <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="20" width="180" height="100" rx="12" fill="rgba(74,124,126,0.18)" stroke="rgba(43,37,32,0.12)" strokeWidth="1.5"/><circle cx="100" cy="70" r="24" fill="rgba(196,149,106,0.30)"/><path d="M90 70l7 7 13-14" stroke="#c4956a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/><rect x="30" y="38" width="40" height="6" rx="3" fill="rgba(43,37,32,0.12)"/><rect x="30" y="52" width="28" height="6" rx="3" fill="rgba(43,37,32,0.07)"/></svg>
      </div>
      <div className="hiw-body">
        <h3>Tell us what matters</h3>
        <p>Answer a few questions about care needs, location, and budget. Our AI understands nuance — from diabetes management to memory care requirements — so we surface truly relevant options.</p>
        <ul>
          <li>Natural-language questionnaire</li>
          <li>Budget and insurance preferences</li>
          <li>Medical and lifestyle needs</li>
        </ul>
      </div>
    </div>

    <div className="hiw-item reveal">
      <div className="hiw-visual">
        <div className="step-num">2</div>
        <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="30" width="85" height="80" rx="10" fill="rgba(109,18,71,0.14)" stroke="rgba(43,37,32,0.10)" strokeWidth="1.5"/><rect x="105" y="30" width="85" height="80" rx="10" fill="rgba(74,124,126,0.12)" stroke="rgba(43,37,32,0.10)" strokeWidth="1.5"/><circle cx="52" cy="70" r="14" fill="rgba(196,149,106,0.25)"/><circle cx="148" cy="70" r="14" fill="rgba(196,149,106,0.25)"/><path d="M95 70h10M66 70l24-18M66 70l24 18" stroke="rgba(43,37,32,0.15)" strokeWidth="2" strokeLinecap="round"/></svg>
      </div>
      <div className="hiw-body">
        <h3>Get unbiased matches</h3>
        <p>We rank facilities using proprietary data — inspections, staff ratios, complaint histories, and resident sentiment — never kickbacks or placement fees. What you see is what families actually experience.</p>
        <ul>
          <li>No paid placements or sponsored listings</li>
          <li>Real-time state inspection data</li>
          <li>Resident & family sentiment analysis</li>
        </ul>
      </div>
    </div>

    <div className="hiw-item reveal">
      <div className="hiw-visual">
        <div className="step-num">3</div>
        <svg viewBox="0 0 200 140" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="20" y="15" width="160" height="110" rx="14" fill="rgba(74,124,126,0.14)" stroke="rgba(43,37,32,0.10)" strokeWidth="1.5"/><rect x="40" y="38" width="120" height="10" rx="5" fill="rgba(196,149,106,0.28)"/><rect x="40" y="58" width="90" height="8" rx="4" fill="rgba(43,37,32,0.08)"/><rect x="40" y="74" width="100" height="8" rx="4" fill="rgba(43,37,32,0.08)"/><rect x="40" y="96" width="60" height="16" rx="8" fill="rgba(196,149,106,0.35)"/></svg>
      </div>
      <div className="hiw-body">
        <h3>Book tours with confidence</h3>
        <p>Compare side-by-side, read curated inspection highlights, and schedule visits directly. We even generate a personalized question checklist for every tour so you never miss the details that matter.</p>
        <ul>
          <li>Side-by-side comparison tool</li>
          <li>Custom tour question checklists</li>
          <li>Cost & contract transparency</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<section id="trust" className="trust">
  <div style={{ textAlign: "center", marginBottom: "3rem" }} className="reveal">
    <h2 className="section-title">Stories from the families we&apos;ve helped</h2>
    <p className="section-sub" style={{ margin: "0 auto" }}>Because we&apos;ve been there. Every recommendation is built on data, not dollars.</p>
  </div>
  <div className="trust-grid">
    <div className="trust-card reveal">
      <div className="trust-quote">&quot;In 4 days we went from panicked to prepared. The inspection history feature alone saved us from a facility that looked great online but had 12 violations.&quot;</div>
      <div className="trust-author"><div className="trust-avatar"></div><div><div className="trust-name">Margaret T.</div><div className="trust-role">Daughter, Newton MA</div></div></div>
    </div>
    <div className="trust-card reveal">
      <div className="trust-quote">&quot;Finally, a site that tells you what things actually cost. We budgeted $6,200 and found a beautiful place for $5,400. That transparency is priceless.&quot;</div>
      <div className="trust-author"><div className="trust-avatar"></div><div><div className="trust-name">James R.</div><div className="trust-role">Son, Worcester MA</div></div></div>
    </div>
    <div className="trust-card reveal">
      <div className="trust-quote">&quot;Memory care is overwhelming. Assistedly narrowed 40 options to 3 that fit mom&apos;s exact care plan. We signed the lease within a week.&quot;</div>
      <div className="trust-author"><div className="trust-avatar"></div><div><div className="trust-name">Elena V.</div><div className="trust-role">Granddaughter, Brookline MA</div></div></div>
    </div>
  </div>
</section>

<section id="guides">
  <div style={{ textAlign: "center", marginBottom: "3rem" }} className="reveal">
    <h2 className="section-title">Free guides to light your way</h2>
    <p className="section-sub" style={{ margin: "0 auto" }}>The questions everyone&apos;s asking — answered honestly.</p>
  </div>
  <div className="guides-grid">
    <a className="guide-card reveal" href="https://assistedly.ai/questions-to-ask-on-a-tour" target="_blank" rel="noopener">
      <div className="guide-icon">📝</div>
      <h4>What questions should I ask on a tour?</h4>
      <p>Don&apos;t leave without knowing the right questions. From staffing ratios to medication management, get the checklist that makes every tour count.</p>
    </a>
    <a className="guide-card reveal" href="https://assistedly.ai/just-starting-search" target="_blank" rel="noopener">
      <div className="guide-icon">🧭</div>
      <h4>Just starting your search?</h4>
      <p>Overwhelmed? Start here. A gentle, step-by-step guide to understanding options, timelines, and budgets when senior care first becomes a conversation.</p>
    </a>
    <a className="guide-card reveal" href="https://assistedly.ai/before-you-sign" target="_blank" rel="noopener">
      <div className="guide-icon">✍️</div>
      <h4>What to ask before putting down a deposit</h4>
      <p>The hidden fees, the fine print, the red flags. Know exactly what you&apos;re committing to — and what you can negotiate — before you sign anything.</p>
    </a>
  </div>
</section>

<section className="cta-band">
  <div className="reveal">
    <h2>Ready to find peace of mind?</h2>
    <p>Join thousands of Massachusetts families who found the right care without the runaround.</p>
    <button className="btn-gold" style={{ fontSize: "1.05rem", padding: "1rem 2.2rem" }} onClick={() => { if (inputValue.trim()) { handleSend(); } else { setIsChatOpen(true); } }}>Get AI Help →</button>
  </div>
</section>

<footer>
  <div className="footer-inner">
    <a href="https://assistedly.ai" className="footer-brand" target="_blank" rel="noopener">Assisted<span style={{ color: "var(--gold)" }}>ly</span></a>
    <div className="footer-links">
      <a href="https://assistedly.ai/search" target="_blank" rel="noopener">Search</a>
      <a href="https://assistedly.ai/compare" target="_blank" rel="noopener">Compare</a>
      <a href="https://assistedly.ai/concierge" target="_blank" rel="noopener">Concierge</a>
      <a href="https://assistedly.ai/privacy" target="_blank" rel="noopener">Privacy</a>
    </div>
    <div className="footer-copy">© Assistedly.ai — All rights reserved.</div>
  </div>
</footer>



    </>
  )
}