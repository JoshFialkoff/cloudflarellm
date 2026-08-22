'use client'

import React, { useEffect, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import AuthCapture from '../components/AuthCapture'

// ── Constants ──────────────────────────────────────────────────────────────
const COLORS = {
  teal: '#4a7c7e',
  burgundy: '#6d1247',
  gold: '#c4956a',
  offWhite: '#f4f5f7',
  text: '#333333',
  textLight: '#666666',
  border: '#e6e6e9',
  footer: '#071e18',
}

// Generic fake facility for anonymous preview (clearly non-real)
const GENERIC_FACILITY = {
  name: 'Acme Assisted Living',
  slug: 'acme-assisted-living',
  city: 'Springfield',
  state: 'MA',
  county: 'Hampden',
  tagline: 'Sample data for preview purposes',
}

// ── Utility components ─────────────────────────────────────────────────────
function StatCard({ label, value, sub, trend, trendUp }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      padding: '1.5rem',
      border: `1px solid ${COLORS.border}`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      flex: '1 1 220px',
    }}>
      <div style={{ fontSize: '0.8rem', fontWeight: 600, color: COLORS.textLight, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.5rem' }}>
        {label}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: COLORS.teal, lineHeight: 1.1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '0.82rem', color: COLORS.textLight, marginTop: '0.35rem' }}>{sub}</div>
      )}
      {trend && (
        <div style={{
          fontSize: '0.8rem', fontWeight: 600, marginTop: '0.5rem',
          color: trendUp ? '#2e7d32' : '#c62828',
        }}>
          {trendUp ? '↑' : '↓'} {trend}
        </div>
      )}
    </div>
  )
}

function FilterBar({ data }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
      {data.map((f) => (
        <div key={f.label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '0.2rem' }}>
            <span>{f.label}</span>
            <span style={{ fontWeight: 700, color: f.color }}>{f.pct}%</span>
          </div>
          <div style={{ height: 6, background: '#eee', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${f.pct}%`, background: f.color, borderRadius: 3,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function InsightRow({ icon, title, detail }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.75rem 0', borderBottom: `1px solid ${COLORS.border}` }}>
      <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 600, color: COLORS.text, fontSize: '0.9rem' }}>{title}</div>
        <div style={{ fontSize: '0.82rem', color: COLORS.textLight, marginTop: '0.15rem' }}>{detail}</div>
      </div>
    </div>
  )
}

function LoadingCard() {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '1.5rem',
      border: `1px solid ${COLORS.border}`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: COLORS.textLight, fontSize: '0.9rem',
    }}>
      Loading insights…
    </div>
  )
}

function LoginPromptCard({ redirectTo, onLoginSuccess }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 16,
      padding: '2rem',
      border: `1px solid ${COLORS.border}`,
      boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
      textAlign: 'center',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '1rem',
    }}>
      <div style={{ fontSize: '2.5rem' }}>🔒</div>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: COLORS.text, margin: 0 }}>
        Unlock Full Facility Insights
      </h3>
      <p style={{ fontSize: '0.9rem', color: COLORS.textLight, maxWidth: 400, margin: 0 }}>
        See detailed filter breakdowns, competitor comparisons, and actionable recommendations tailored to your facility.
      </p>
      <AuthCapture
        authSurface="facility_insights_interstitial"
        redirectTo={redirectTo}
        reason="Enter your email to unlock full insights."
        buttonLabel="Send my magic link"
        successMessage="Check your email for the sign-in link."
        onSuccess={() => {
          // After successful request, reload after a short delay to pick up session
          setTimeout(() => window.location.reload(), 2000)
        }}
      />
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────
export default function FacilityInsightsPreview() {
  const router = useRouter()
  const [session, setSession] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [timeRange, setTimeRange] = useState('30d')
  const [data, setData] = useState(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [showInterstitial, setShowInterstitial] = useState(false)
  const sentinelRef = useRef(null)

  const isAuth = Boolean(session?.authenticated)

  // Facility context: from query params when auth'd, otherwise generic fake
  const queryFacility = router.query
  const facility = isAuth ? {
    name: queryFacility.name || 'Your Facility',
    slug: queryFacility.facility || 'your-facility',
    city: queryFacility.city || 'Massachusetts',
    state: 'MA',
    tagline: 'Personalized intelligence dashboard',
  } : GENERIC_FACILITY

  const days = timeRange === '7d' ? 7 : timeRange === '90d' ? 90 : 30
  const redirectTo = typeof window !== 'undefined'
    ? window.location.pathname + window.location.search
    : '/facility-insights-preview'

  // Check auth session on mount
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(json => setSession(json))
      .catch(() => setSession({ authenticated: false }))
      .finally(() => setSessionLoading(false))
  }, [])

  // Fetch insights data
  useEffect(() => {
    setDataLoading(true)
    fetch(`/api/facility-insights?slug=${encodeURIComponent(facility.slug)}&days=${days}`)
      .then(r => r.json())
      .then(json => { setData(json); setDataLoading(false) })
      .catch(() => setDataLoading(false))
  }, [facility.slug, days, isAuth])

  // Scroll interstitial: when sentinel scrolls out of view, show prompt
  useEffect(() => {
    if (isAuth || sessionLoading) return
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) {
          setShowInterstitial(true)
        }
      },
      { threshold: 0 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [isAuth, sessionLoading])

  const d = data || {}
  const dailyTrend = d.dailyTrend || []
  const topCities = d.topCities || []
  const radiusBreakdown = d.radiusBreakdown || []
  const maxFeeBreakdown = d.maxFeeBreakdown || []
  const taxStatusBreakdown = d.taxStatusBreakdown || []
  const memoryCareBreakdown = d.memoryCareBreakdown || []
  const insuranceBreakdown = d.insuranceBreakdown || []
  const sortPreferences = d.sortPreferences || []
  const competitors = d.competitors || []
  const insights = d.insights || []
  const source = d.source || 'mock'

  const totalImpressions = dailyTrend.reduce((a, d) => a + (d.impressions || 0), 0)
  const totalClicks = dailyTrend.reduce((a, d) => a + (d.clicks || 0), 0)
  const clickRate = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0.0'

  const LoadingCharts = dataLoading || sessionLoading

  return (
    <>
      <Head>
        <title>{isAuth ? `Facility Insights — ${facility.name}` : `Facility Intelligence Preview — Assistedly`}</title>
      </Head>

      <main style={{ background: COLORS.offWhite, minHeight: '100vh', paddingBottom: '4rem' }}>
        {/* Hero header */}
        <div style={{
          background: COLORS.teal,
          color: '#fff',
          padding: isAuth ? '2.5rem 1rem' : '2rem 1rem',
          textAlign: 'center',
        }}>
          <div style={{ maxWidth: 960, margin: '0 auto' }}>
            <div style={{
              fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.08em', opacity: 0.85, marginBottom: '0.5rem',
            }}>
              {isAuth
                ? (source === 'd1' ? 'Live Data — Facility Intelligence Dashboard' : 'Facility Intelligence Dashboard')
                : 'Preview — Facility Intelligence Dashboard'}
            </div>

            {isAuth && queryFacility.logo && (
              <div style={{ marginBottom: '0.75rem' }}>
                <img
                  src={queryFacility.logo}
                  alt={`${facility.name} logo`}
                  style={{
                    maxHeight: 48,
                    maxWidth: 180,
                    filter: 'brightness(0) invert(1)',
                    objectFit: 'contain',
                  }}
                />
              </div>
            )}

            <h1 style={{ fontSize: isAuth ? '1.6rem' : '1.4rem', fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
              {facility.name}
            </h1>
            <p style={{
              opacity: 0.9, marginTop: '0.5rem', fontSize: '1rem',
              maxWidth: 540, margin: '0.5rem auto 0',
            }}>
              {facility.tagline}
            </p>
            {!isAuth && (
              <div style={{
                display: 'inline-block',
                marginTop: '1rem',
                padding: '0.35rem 0.9rem',
                borderRadius: 999,
                background: 'rgba(255,255,255,0.15)',
                fontSize: '0.78rem',
                fontWeight: 600,
              }}>
                This is a sample preview with fake data
              </div>
            )}
          </div>
        </div>

        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
          {/* Time range selector (auth only) */}
          {(isAuth || LoadingCharts) && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1.5rem' }}>
              {[
                { key: '7d', label: 'Last 7 days' },
                { key: '30d', label: 'Last 30 days' },
                { key: '90d', label: 'Last 90 days' },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTimeRange(t.key)}
                  style={{
                    padding: '0.45rem 1rem',
                    borderRadius: 8,
                    border: 'none',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: timeRange === t.key ? COLORS.teal : '#fff',
                    color: timeRange === t.key ? '#fff' : COLORS.text,
                    boxShadow: timeRange === t.key ? '0 2px 8px rgba(74,124,126,0.3)' : '0 1px 3px rgba(0,0,0,0.08)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}

          {/* KPI cards — visible to all */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
            <StatCard
              label="Search Impressions"
              value={totalImpressions.toLocaleString()}
              sub="Times shown in search results"
              trend="12% vs last period"
              trendUp={true}
            />
            <StatCard
              label="Profile Clicks"
              value={totalClicks.toLocaleString()}
              sub="Clicks from results to your profile"
              trend="8% vs last period"
              trendUp={true}
            />
            <StatCard
              label="Click-Through Rate"
              value={`${clickRate}%`}
              sub="Industry avg: 3.2%"
              trend="0.4pp vs last period"
              trendUp={true}
            />
            <StatCard
              label="Avg. Search Radius"
              value="15.3 mi"
              sub="Families search this far from their target city"
              trend="−1.2 mi vs last period"
              trendUp={false}
            />
          </div>

          {/* Charts row — visible to all */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
            <div style={{
              background: '#fff', borderRadius: 16, padding: '1.5rem',
              border: `1px solid ${COLORS.border}`,
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: COLORS.text, margin: '0 0 0.25rem' }}>
                Daily Search Impressions
              </h3>
              <p style={{ fontSize: '0.82rem', color: COLORS.textLight, margin: '0 0 1rem' }}>
                How often families see your facility in search results
              </p>
              {LoadingCharts ? <LoadingCard /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={dailyTrend}>
                    <defs>
                      <linearGradient id="impGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.teal} stopOpacity={0.15} />
                        <stop offset="95%" stopColor={COLORS.teal} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#888' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#888' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${COLORS.border}` }} />
                    <Area type="monotone" dataKey="impressions" stroke={COLORS.teal} fill="url(#impGradient)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={{
              background: '#fff', borderRadius: 16, padding: '1.5rem',
              border: `1px solid ${COLORS.border}`,
              boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: COLORS.text, margin: '0 0 0.25rem' }}>
                Top Search Origins
              </h3>
              <p style={{ fontSize: '0.82rem', color: COLORS.textLight, margin: '0 0 1rem' }}>
                Cities families search from when they see your facility
              </p>
              {LoadingCharts ? <LoadingCard /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={topCities} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#888' }} />
                    <YAxis dataKey="city" type="category" tick={{ fontSize: 11, fill: '#333' }} width={100} />
                    <Tooltip contentStyle={{ borderRadius: 10, border: `1px solid ${COLORS.border}` }} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                      {topCities.map((entry, index) => (
                        <Cell key={index} fill={index === 0 ? COLORS.teal : index === 1 ? COLORS.burgundy : COLORS.gold} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Sentinel: when this scrolls away, interstitial triggers (anonymous only) */}
          <div ref={sentinelRef} style={{ height: 1 }} />

          {/* ── GATED CONTENT BEGINS ── */}

          {isAuth ? (
            <>
              {/* Second charts row — auth only */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
                <div style={{
                  background: '#fff', borderRadius: 16, padding: '1.5rem',
                  border: `1px solid ${COLORS.border}`,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: COLORS.text, margin: '0 0 0.25rem' }}>
                    Search Radius Preferences
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: COLORS.textLight, margin: '0 0 1rem' }}>
                    How far families are willing to travel
                  </p>
                  {LoadingCharts ? <LoadingCard /> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      {radiusBreakdown.map((f) => (
                        <div key={f.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                            <span>{f.label}</span>
                            <span style={{ fontWeight: 700, color: f.color }}>{f.pct}%</span>
                          </div>
                          <div style={{ height: 8, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${f.pct}%`, background: f.color, borderRadius: 4,
                              transition: 'width 0.6s ease',
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{
                  background: '#fff', borderRadius: 16, padding: '1.5rem',
                  border: `1px solid ${COLORS.border}`,
                  boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: COLORS.text, margin: '0 0 0.25rem' }}>
                    Nearby Competing Facilities
                  </h3>
                  <p style={{ fontSize: '0.82rem', color: COLORS.textLight, margin: '0 0 1rem' }}>
                    Facilities families view in the same search sessions
                  </p>
                  {LoadingCharts ? <LoadingCard /> : (
                    <table style={{ width: '100%', fontSize: '0.82rem', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                          <th style={{ textAlign: 'left', padding: '0.5rem 0', color: COLORS.textLight, fontWeight: 600 }}>Facility</th>
                          <th style={{ textAlign: 'right', padding: '0.5rem 0', color: COLORS.textLight, fontWeight: 600 }}>Impressions</th>
                          <th style={{ textAlign: 'right', padding: '0.5rem 0', color: COLORS.textLight, fontWeight: 600 }}>CTR</th>
                        </tr>
                      </thead>
                      <tbody>
                        {competitors.map((c) => (
                          <tr key={c.name} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                            <td style={{ padding: '0.6rem 0' }}>
                              <div style={{ fontWeight: 600, color: COLORS.text }}>{c.name}</div>
                              <div style={{ fontSize: '0.75rem', color: COLORS.textLight }}>{c.city}, MA</div>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600 }}>{c.impressions.toLocaleString()}</td>
                            <td style={{ textAlign: 'right' }}>
                              <span style={{
                                display: 'inline-block',
                                padding: '0.15rem 0.5rem',
                                borderRadius: '999px',
                                fontWeight: 600,
                                fontSize: '0.78rem',
                                background: c.clickRate >= 4.5 ? '#e8f5e9' : c.clickRate >= 4.0 ? '#fff3e0' : '#fce4ec',
                                color: c.clickRate >= 4.5 ? '#2e7d32' : c.clickRate >= 4.0 ? '#e65100' : '#c62828',
                              }}>
                                {c.clickRate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* What families searched for — auth only */}
              <div style={{
                background: '#fff', borderRadius: 16, padding: '1.5rem',
                border: `1px solid ${COLORS.border}`,
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
                marginBottom: '2rem',
              }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: COLORS.text, margin: '0 0 0.25rem' }}>
                  🔍 What Families Searched For
                </h3>
                <p style={{ fontSize: '0.82rem', color: COLORS.textLight, margin: '0 0 1.25rem' }}>
                  Filter and sort criteria families used when your facility appeared in results
                </p>
                {LoadingCharts ? <LoadingCard /> : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.teal, marginBottom: '0.75rem' }}>
                        Search Radius
                      </div>
                      <FilterBar data={radiusBreakdown} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.teal, marginBottom: '0.75rem' }}>
                        Max Monthly Fee Budget
                      </div>
                      <FilterBar data={maxFeeBreakdown} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.teal, marginBottom: '0.75rem' }}>
                        Tax Status Filter
                      </div>
                      <FilterBar data={taxStatusBreakdown} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.teal, marginBottom: '0.75rem' }}>
                        Memory Care Requirement
                      </div>
                      <FilterBar data={memoryCareBreakdown} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.teal, marginBottom: '0.75rem' }}>
                        Insurance Filter
                      </div>
                      <FilterBar data={insuranceBreakdown} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: COLORS.teal, marginBottom: '0.75rem' }}>
                        Sort Preference
                      </div>
                      <FilterBar data={sortPreferences} />
                    </div>
                  </div>
                )}
              </div>

              {/* Actionable insights — auth only */}
              <div style={{
                background: '#fff', borderRadius: 16, padding: '1.5rem',
                border: `1px solid ${COLORS.border}`,
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: COLORS.text, margin: '0 0 0.25rem' }}>
                  💡 Actionable Insights
                </h3>
                <p style={{ fontSize: '0.82rem', color: COLORS.textLight, margin: '0 0 1rem' }}>
                  Recommendations based on search behavior around your facility
                </p>
                {LoadingCharts ? <LoadingCard /> : (
                  <>
                    {insights.map((insight, i) => (
                      <InsightRow key={i} icon={insight.icon} title={insight.title} detail={insight.detail} />
                    ))}
                  </>
                )}
              </div>

              {/* CTA — auth only */}
              <div style={{ textAlign: 'center', marginTop: '2.5rem', padding: '2rem', background: COLORS.footer, borderRadius: 16, color: '#fff' }}>
                <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem' }}>Want to grow your visibility?</h3>
                <p style={{ margin: '0 0 1.25rem', opacity: 0.85, fontSize: '0.95rem', maxWidth: 500, margin: '0 auto 1.25rem' }}>
                  Contact us to feature your facility more prominently and reach more families actively searching.
                </p>
                <a
                  href="https://calendly.com/joshfialkoff/30min"
                  style={{
                    display: 'inline-block',
                    padding: '0.75rem 1.5rem',
                    background: COLORS.gold,
                    color: '#fff',
                    fontWeight: 700,
                    borderRadius: 12,
                    textDecoration: 'none',
                    fontSize: '0.95rem',
                  }}
                >
                  Schedule a Call
                </a>
              </div>
            </>
          ) : (
            <>
              {!sessionLoading && (
                <div style={{ maxWidth: 500, margin: '0 auto 2rem' }}>
                  <LoginPromptCard redirectTo={redirectTo} />
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Scroll interstitial overlay (anonymous only) */}
      {!isAuth && showInterstitial && !sessionLoading && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(7,30,24,0.72)',
          backdropFilter: 'blur(4px)',
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1.5rem',
        }} onClick={(e) => { if (e.target === e.currentTarget) setShowInterstitial(false) }}>
          <div style={{
            background: '#fff',
            borderRadius: 20,
            padding: '2.5rem',
            maxWidth: 520,
            width: '100%',
            boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
          }}>
            <button
              onClick={() => setShowInterstitial(false)}
              style={{
                float: 'right',
                background: 'none',
                border: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
                color: COLORS.textLight,
                lineHeight: 1,
              }}
              aria-label="Close"
            >
              ×
            </button>

            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>📊</div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: COLORS.text, margin: 0 }}>
                Unlock Full Facility Insights
              </h2>
              <p style={{ fontSize: '0.9rem', color: COLORS.textLight, marginTop: '0.5rem' }}>
                You&apos;ve seen a preview with sample data. Enter your email to access the complete dashboard with real data for your facility.
              </p>
            </div>

            <AuthCapture
              authSurface="facility_insights_scroll_gate"
              redirectTo={redirectTo}
              reason="Enter your email to unlock full insights."
              buttonLabel="Send my magic link"
              successMessage="Check your email for the sign-in link."
              onSuccess={() => {
                setTimeout(() => window.location.reload(), 2000)
              }}
            />

            <p style={{ textAlign: 'center', fontSize: '0.8rem', color: COLORS.textLight, marginTop: '1.25rem' }}>
              Or <button
                onClick={() => setShowInterstitial(false)}
                style={{
                  background: 'none', border: 'none', padding: 0,
                  color: COLORS.teal, fontWeight: 600, cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                continue browsing the preview
              </button>
            </p>
          </div>
        </div>
      )}
    </>
  )
}
