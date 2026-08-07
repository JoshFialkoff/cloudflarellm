'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Send,
  MessageCircle,
  MapPin,
  Star,
  Users,
  Clock,
  ShieldCheck,
  Database,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  HeartHandshake,
  Building2,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  JOURNEY_OPTIONS,
  SUGGESTED_PROMPTS,
  KEY_QUESTIONS,
  FAQS,
  SCROLL_QUESTIONS,
  type JourneyStage,
} from './data';
import styles from './AISearch.module.css';

/* ─── Utility ─── */
function currency(n: number) {
  return `$${n.toLocaleString()}`;
}

/* ─── Smart Question Picker ─── */
function SmartQuestionPicker({
  value,
  onChange,
  onSubmit,
}: {
  value: string;
  onChange: (q: string) => void;
  onSubmit: (q: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [idx, setIdx] = useState(SCROLL_QUESTIONS.indexOf(value) >= 0 ? SCROLL_QUESTIONS.indexOf(value) : 0);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const goUp = useCallback(() => {
    const ni = (idx - 1 + SCROLL_QUESTIONS.length) % SCROLL_QUESTIONS.length;
    setIdx(ni);
    onChange(SCROLL_QUESTIONS[ni]);
  }, [idx, onChange]);

  const goDown = useCallback(() => {
    const ni = (idx + 1) % SCROLL_QUESTIONS.length;
    setIdx(ni);
    onChange(SCROLL_QUESTIONS[ni]);
  }, [idx, onChange]);

  const stages = [
    { title: 'Just starting', id: 'starting' as JourneyStage, questions: SUGGESTED_PROMPTS.starting.slice(0, 3) },
    { title: 'Comparing options', id: 'comparing' as JourneyStage, questions: SUGGESTED_PROMPTS.comparing.slice(0, 3) },
    { title: 'Ready to contact', id: 'contacting' as JourneyStage, questions: SUGGESTED_PROMPTS.contacting.slice(0, 3) },
  ];

  return (
    <div className={styles.pickerWrap} ref={panelRef}>
      <div className={styles.pickerRow}>
        <div className={styles.pickerInputWrap}>
          <Search size={16} color="#999" />
          <input
            ref={inputRef}
            className={styles.pickerInput}
            type="text"
            value={value}
            onChange={(e) => { onChange(e.target.value); }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onSubmit(value); setIsOpen(false); }
              if (e.key === 'ArrowUp') { e.preventDefault(); goUp(); }
              if (e.key === 'ArrowDown') { e.preventDefault(); goDown(); }
            }}
            placeholder="Ask anything or pick a common question..."
            aria-label="Ask a question about assisted living"
          />
        </div>
        <button className={styles.pickerSubmit} onClick={() => { onSubmit(value); setIsOpen(false); }} aria-label="Ask the AI">
          <Sparkles size={16} /> Ask
        </button>
      </div>
      {isOpen && (
        <div className={styles.pickerPanel} role="dialog" aria-label="Popular questions">
          {stages.map((s) => (
            <div key={s.id}>
              <div className={styles.pickerStageTitle}>{s.title}</div>
              <div className={styles.pickerGrid} role="list">
                {s.questions.map((q) => (
                  <button
                    key={q}
                    className={styles.pickerChip}
                    role="listitem"
                    onClick={() => { onChange(q); setIsOpen(false); inputRef.current?.focus(); }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Journey Selector ─── */
function JourneySelector({
  active,
  onSelect,
}: {
  active: JourneyStage;
  onSelect: (s: JourneyStage) => void;
}) {
  return (
    <section className={styles.section} aria-label="Search journey">
      <h2 className={styles.sectionTitle}>Where are you in your search?</h2>
      <p className={styles.sectionSubtitle}>
        Everyone moves at their own pace. Choose the path that feels right for you.
      </p>
      <div className={styles.journeyGrid} role="radiogroup" aria-label="Search stage">
        {JOURNEY_OPTIONS.map((opt) => {
          const isActive = active === opt.id;
          return (
            <button
              key={opt.id}
              className={`${styles.journeyCard} ${isActive ? styles.journeyCardActive : ''}`}
              onClick={() => onSelect(opt.id)}
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
            >
              <div className={styles.journeyCardTitle}>{opt.title}</div>
              <div className={styles.journeyCardSubtitle}>{opt.subtitle}</div>
              <ul className={styles.journeyCardQuestions} aria-label="Example questions">
                {opt.exampleQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ─── AI Assistant Launcher ─── */
function AIAssistantLauncher({ activeStage, autoQuery }: { activeStage: JourneyStage; autoQuery?: string }) {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const lastAutoRef = useRef<string | undefined>(undefined);
  const prompts = SUGGESTED_PROMPTS[activeStage];

  useEffect(() => {
    if (autoQuery && autoQuery !== lastAutoRef.current) {
      lastAutoRef.current = autoQuery;
      setQuery(autoQuery);
      setSubmitted(true);
      const timer = setTimeout(() => setSubmitted(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [autoQuery]);

  const handleSubmit = useCallback(() => {
    if (!query.trim()) return;
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 6000);
  }, [query]);

  return (
    <section className={styles.section} aria-label="Ask the AI">
      <div className={styles.aiLauncher}>
        <div className={styles.aiLauncherLabel}>
          <Sparkles size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
          AI Search Assistant
        </div>
        <div className={styles.aiInputWrap}>
          <Search size={18} color="#999" />
          <input
            className={styles.aiInput}
            data-ai-input="true"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Ask anything about Massachusetts assisted living..."
            aria-label="Ask the AI a question about assisted living"
          />
          <button
            className={styles.aiSendBtn}
            onClick={handleSubmit}
            disabled={!query.trim()}
            aria-label="Send question"
          >
            <Send size={18} />
          </button>
        </div>
        <div className={styles.promptChips} role="list" aria-label="Suggested questions">
          {prompts.map((p) => (
            <button
              key={p}
              className={styles.promptChip}
              onClick={() => {
                setQuery(p);
                setSubmitted(true);
                setTimeout(() => setSubmitted(false), 6000);
              }}
              role="listitem"
            >
              {p}
            </button>
          ))}
        </div>
        {submitted && (
          <div className={styles.sampleResponse} role="status" aria-live="polite">
            <div className={styles.sampleResponseLabel}>AI Response preview</div>
            {query.toLowerCase().includes('cost') ? (
              <>
                <p className={styles.sampleResponseText}>
                  In Massachusetts, assisted living costs typically range from{' '}
                  <strong>$4,500–$8,500 per month</strong> depending on location and care level.
                </p>
                <p className={styles.sampleResponseText}>
                  Communities closer to Boston tend to be higher, while western Massachusetts and
                  smaller towns may be more affordable.
                </p>
                <p className={styles.sampleResponseText}>
                  I can also compare specific communities, show you what is included, and help you
                  prepare questions for a tour.
                </p>
              </>
            ) : (
              <p className={styles.sampleResponseText}>
                Great question. In Massachusetts, assisted living costs typically range from{' '}
                <strong>$4,500–$8,500 per month</strong> depending on location and care level.
                Communities closer to Boston tend to be higher, while western Massachusetts and
                smaller towns may be more affordable. I can also compare specific communities, show
                you what is included, and help you prepare questions for a tour.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ─── Key Questions ─── */
function KeyQuestions({ activeStage }: { activeStage: JourneyStage }) {
  const filtered = KEY_QUESTIONS.filter((q) => q.stage === activeStage);
  return (
    <section className={styles.section} aria-label="Key questions">
      <h2 className={styles.sectionTitle}>Common questions for this stage</h2>
      <p className={styles.sectionSubtitle}>
        Quick, clear answers to move your search forward.
      </p>
      <div className={styles.questionsGrid}>
        {filtered.map((q, i) => (
          <div className={styles.questionCard} key={i} tabIndex={0} role="article">
            <div className={styles.questionCardQ}>{q.question}</div>
            <div className={styles.questionCardA}>{q.answerPreview}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─── Facility Comparison (Live NocoDB data) ─── */
interface LiveFacility {
  Id: number;
  Facility_name: string;
  City: string;
  State: string;
  Care_type: string;
  Rating: number | null;
  Monthly_cost_min: number | null;
  Monthly_cost_max: number | null;
  Zip: string;
}

function FacilityComparison({
  filterZip,
  selectedQuestion,
  onCityFound,
}: {
  filterZip?: string;
  selectedQuestion: string;
  onCityFound?: (city: string) => void;
}) {
  const [facilities, setFacilities] = useState<LiveFacility[]>([]);
  const [chartData, setChartData] = useState<{ city: string; avgMin: number; avgMax: number }[]>([]);
  const [activeChart, setActiveChart] = useState<'cost' | 'careType' | 'rating'>('cost');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const careTypeData = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const f of facilities) {
      const key = f.Care_type || 'Unknown';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [facilities]);

  const ratingData = React.useMemo(() => {
    const buckets = [
      { label: '4.5–5 stars', min: 4.5, max: 5.1 },
      { label: '4.0–4.5', min: 4.0, max: 4.5 },
      { label: '3.5–4.0', min: 3.5, max: 4.0 },
      { label: '3.0–3.5', min: 3.0, max: 3.5 },
      { label: '< 3.0', min: 0, max: 3.0 },
    ];
    return buckets
      .map((b) => ({
        label: b.label,
        count: facilities.filter((f) => f.Rating && f.Rating >= b.min && f.Rating < b.max).length,
      }))
      .filter((b) => b.count > 0);
  }, [facilities]);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/answers-facilities');
        if (!res.ok) throw new Error('Failed to load facility data');
        const data = await res.json();
        if (!cancelled) {
          let rows = data.list || [];
          if (filterZip) {
            rows = rows.filter((f: any) => f.Zip?.startsWith(filterZip.slice(0, 3)));
          }
          setFacilities(rows);
          setChartData(data.byCity || []);
          if (onCityFound && rows.length > 0) {
            onCityFound(rows[0].City);
          }
        }
      } catch (e: any) {
        if (!cancelled) setError('Unable to load community data. Please try refreshing.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filterZip, onCityFound]);

  const chartTitle =
    activeChart === 'cost'
      ? 'Average assisted living cost by city'
      : activeChart === 'careType'
      ? 'Communities by care type'
      : 'Communities by rating';

  return (
    <section className={styles.section} aria-label="Featured facilities">
      <h2 className={styles.sectionTitle}>Compare Massachusetts communities</h2>
      <p className={styles.sectionSubtitle}>
        See facilities with most experienced staff, safety, activities, and dining and more.
      </p>

      {!loading && !error && (
        <div className={styles.chartWrap}>
          <div className={styles.chartTitle}>{chartTitle}</div>
          <div className={styles.chartSub}>Based on our proprietary data and public information</div>

          <ResponsiveContainer width="100%" height={260}>
            {activeChart === 'cost' ? (
              <BarChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0eeeb" />
                <XAxis dataKey="city" tick={{ fontSize: 12, fill: '#777' }} interval={0} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 12, fill: '#777' }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: number, name: string) => [currency(value), name === 'avgMin' ? 'Avg Minimum' : 'Avg Maximum']} contentStyle={{ borderRadius: 10, border: '1px solid #e0e6e5', fontSize: 13 }} />
                <Bar dataKey="avgMin" fill="#4a7c7e" radius={[4, 4, 0, 0]} name="Avg Minimum" />
                <Bar dataKey="avgMax" fill="#c4956a" radius={[4, 4, 0, 0]} name="Avg Maximum" />
              </BarChart>
            ) : activeChart === 'careType' ? (
              <BarChart data={careTypeData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0eeeb" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#777' }} interval={0} angle={-20} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 12, fill: '#777' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e0e6e5', fontSize: 13 }} />
                <Bar dataKey="count" fill="#6d1247" radius={[4, 4, 0, 0]} name="Count" />
              </BarChart>
            ) : (
              <BarChart data={ratingData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0eeeb" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#777' }} interval={0} />
                <YAxis tick={{ fontSize: 12, fill: '#777' }} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e0e6e5', fontSize: 13 }} />
                <Bar dataKey="count" fill="#c4956a" radius={[4, 4, 0, 0]} name="Communities" />
              </BarChart>
            )}
          </ResponsiveContainer>

          <div className={styles.chartThumbs} role="tablist" aria-label="Chart options">
            {[
              { key: 'cost' as const, label: 'Cost by City', icon: '💰' },
              { key: 'careType' as const, label: 'Care Types', icon: '🏥' },
              { key: 'rating' as const, label: 'Ratings', icon: '⭐' },
            ].map((t) => (
              <button
                key={t.key}
                className={`${styles.chartThumb} ${activeChart === t.key ? styles.chartThumbActive : ''}`}
                onClick={() => setActiveChart(t.key)}
                role="tab"
                aria-selected={activeChart === t.key}
              >
                <span className={styles.chartThumbIcon} aria-hidden="true">{t.icon}</span>
                <span className={styles.chartThumbLabel}>{t.label}</span>
              </button>
            ))}
          </div>

          <div className={styles.chartScrollWrap}>
            <div className={styles.chartScrollTrack}>
              {[
                { key: 'cost' as const, title: 'Average Cost by City', desc: 'Monthly cost ranges across MA cities', icon: '💰', bars: [{ h: 60, c: '#4a7c7e' }, { h: 80, c: '#c4956a' }, { h: 45, c: '#4a7c7e' }, { h: 70, c: '#c4956a' }] },
                { key: 'careType' as const, title: 'Communities by Care Type', desc: 'How facilities specialize', icon: '🏥', bars: [{ h: 75, c: '#6d1247' }, { h: 50, c: '#6d1247' }, { h: 90, c: '#6d1247' }] },
                { key: 'rating' as const, title: 'Communities by Rating', desc: 'Star distribution overview', icon: '⭐', bars: [{ h: 85, c: '#c4956a' }, { h: 60, c: '#c4956a' }, { h: 35, c: '#c4956a' }, { h: 20, c: '#c4956a' }] },
                { key: 'cost' as const, title: 'Cost by Zip Code', desc: 'Neighborhood-level pricing', icon: '📍', bars: [{ h: 55, c: '#4a7c7e' }, { h: 65, c: '#c4956a' }, { h: 40, c: '#4a7c7e' }, { h: 78, c: '#c4956a' }, { h: 50, c: '#4a7c7e' }] },
                { key: 'careType' as const, title: 'Memory Care Availability', desc: 'Dementia care beds per city', icon: '🧠', bars: [{ h: 40, c: '#6d1247' }, { h: 70, c: '#6d1247' }, { h: 55, c: '#6d1247' }, { h: 30, c: '#6d1247' }] },
              ].map((card) => (
                <button
                  key={card.title}
                  className={`${styles.chartScrollCard} ${activeChart === card.key ? styles.chartScrollCardActive : ''}`}
                  onClick={() => setActiveChart(card.key)}
                  aria-label={`Show ${card.title}`}
                >
                  <div className={styles.chartScrollPreview} aria-hidden="true">
                    {card.bars.map((b, i) => (
                      <div key={i} className={styles.chartScrollBar} style={{ height: `${b.h}%`, background: b.c }} />
                    ))}
                  </div>
                  <div className={styles.chartScrollMeta}>
                    <span className={styles.chartScrollIcon}>{card.icon}</span>
                    <span className={styles.chartScrollTitle}>{card.title}</span>
                    <span className={styles.chartScrollDesc}>{card.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {loading && <p style={{ textAlign: 'center', color: '#888' }}>Loading communities…</p>}
      {error && <p style={{ textAlign: 'center', color: '#a94442' }}>{error}</p>}

      {!loading && !error && (
        <div className={styles.facilityCards} role="list">
          {facilities.slice(0, 8).map((f) => (
            <article className={styles.facilityCard} key={f.Id} role="listitem">
              <div className={styles.facilityCardHeader}>
                <div>
                  <div className={styles.facilityName}>{f.Facility_name}</div>
                  <div className={styles.facilityCity}>
                    <MapPin size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                    {f.City}, {f.State}
                  </div>
                </div>
                <div className={styles.facilityRating}>
                  <Star size={13} fill="currentColor" />
                  {f.Rating ?? '—'}
                </div>
              </div>
              <div className={styles.facilityRow}>
                <span className={styles.facilityRowLabel}>Monthly cost</span>
                <span className={styles.facilityRowValue}>
                  {f.Monthly_cost_min && f.Monthly_cost_max
                    ? `${currency(f.Monthly_cost_min)} – ${currency(f.Monthly_cost_max)}`
                    : 'Contact for pricing'}
                </span>
              </div>
              <div className={styles.facilityRow}>
                <span className={styles.facilityRowLabel}>Care type</span>
                <span className={styles.facilityRowValue}>{f.Care_type}</span>
              </div>
              <div className={styles.facilityRow}>
                <span className={styles.facilityRowLabel}>Zip</span>
                <span className={styles.facilityRowValue}>{f.Zip}</span>
              </div>
              <button className={styles.facilityCompareBtn} aria-label={`Compare ${f.Facility_name}`}>
                Compare
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* ─── Trust Section ─── */
function TrustSection() {
  const items = [
    {
      icon: <Database size={28} />,
      title: 'Public business data',
      body: 'We aggregate verified public records, licenses, and regulatory filings.',
    },
    {
      icon: <MessageSquare size={28} />,
      title: 'Reviews & ratings',
      body: 'Real family reviews from across the web, summarized in plain English.',
    },
    {
      icon: <Building2 size={28} />,
      title: 'Community details',
      body: 'Amenities, floor plans, care types, and staff qualifications at a glance.',
    },
    {
      icon: <Clock size={28} />,
      title: 'Updated regularly',
      body: 'Information is refreshed so you are not relying on outdated listings.',
    },
  ];
  return (
    <section className={styles.section} aria-label="How we build trust">
      <h2 className={styles.sectionTitle}>Where our answers come from</h2>
      <p className={styles.sectionSubtitle}>
        We believe you deserve transparency. Here is what powers the AI responses.
      </p>
      <div className={styles.trustGrid} role="list">
        {items.map((it, i) => (
          <div className={styles.trustCard} key={i} role="listitem">
            <div className={styles.trustIcon}>{it.icon}</div>
            <div className={styles.trustCardTitle}>{it.title}</div>
            <div className={styles.trustCardBody}>{it.body}</div>
          </div>
        ))}
      </div>
      <p
        style={{
          textAlign: 'center',
          fontSize: 13,
          color: '#888',
          marginTop: 24,
          maxWidth: 640,
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.6,
        }}
      >
        <ShieldCheck size={14} style={{ verticalAlign: 'middle', marginRight: 6, color: '#4a7c7e' }} />
        Always verify pricing and care details directly with the community before making a decision.
      </p>
    </section>
  );
}

/* ─── FAQ ─── */
function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <section className={styles.section} aria-label="Frequently asked questions">
      <h2 className={styles.sectionTitle}>Frequently asked questions</h2>
      <p className={styles.sectionSubtitle}>
        Straightforward answers to help you feel confident in your search.
      </p>
      <div role="list">
        {FAQS.map((f, i) => {
          const open = openIndex === i;
          return (
            <div className={styles.faqItem} key={i} role="listitem">
              <button
                className={`${styles.faqQuestion} ${open ? styles.faqQuestionActive : ''}`}
                onClick={() => setOpenIndex(open ? null : i)}
                aria-expanded={open}
              >
                <span>{f.question}</span>
                <ChevronDown
                  size={20}
                  className={`${styles.faqChevron} ${open ? styles.faqChevronOpen : ''}`}
                />
              </button>
              {open && <div className={styles.faqAnswer}>{f.answer}</div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Hero ─── */
function Hero({
  question,
  onQuestionChange,
  onQuestionSubmit,
}: {
  question: string;
  onQuestionChange: (q: string) => void;
  onQuestionSubmit: (q: string) => void;
}) {
  return (
    <section className={styles.hero} aria-label="Hero">
      <div className={styles.heroTag}>
        <HeartHandshake size={13} style={{ verticalAlign: 'middle', marginRight: 6 }} />
        For people caring for a parent or in-law
      </div>
      <h1 className={styles.heroTitle}>
        Find the right assisted living in{' '}
        <span className={styles.heroTitleAccent}>Massachusetts</span>
      </h1>
      <p className={styles.heroSubtitle}>
        Get clear answers about cost, care types, ratings, staff quality, and what to do next —
        all in plain English, without the overwhelm.
      </p>
      <SmartQuestionPicker value={question} onChange={onQuestionChange} onSubmit={onQuestionSubmit} />
      <div className={styles.heroCtas}>
        <button className={styles.btnSecondary}>
          <Building2 size={18} />
          Browse facilities
        </button>
      </div>
      <div className={styles.trustLine}>
        <CheckCircle size={14} />
        Get clear answers in plain English
      </div>
    </section>
  );
}

/* ─── Main Page Component ─── */
function getZipFromCookie(): string | undefined {
  try {
    const match = document.cookie.match(/(?:^|; )user_zip=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : undefined;
  } catch {
    return undefined;
  }
}

export default function AISearchPage() {
  const [stage, setStage] = useState<JourneyStage>('starting');
  const [selectedQuestion, setSelectedQuestion] = useState(SCROLL_QUESTIONS[0]);
  const [userZip, setUserZip] = useState<string | undefined>(getZipFromCookie);

  useEffect(() => {
    if (!userZip && 'geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        () => {}, () => {}, { timeout: 5000 }
      );
    }
  }, [userZip]);

  const handleQuestionSubmit = useCallback((q: string) => {
    setSelectedQuestion(q);
    const el = document.getElementById('ai-launcher');
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  const handleCityFound = useCallback((city: string) => {
    setSelectedQuestion((prev) => {
      if (prev.includes('near you')) {
        return `How much does assisted living cost in ${city}?`;
      }
      return prev;
    });
  }, []);

  return (
    <main className={styles.page}>
      <Hero
        question={selectedQuestion}
        onQuestionChange={setSelectedQuestion}
        onQuestionSubmit={handleQuestionSubmit}
      />
      <FacilityComparison
        filterZip={userZip}
        selectedQuestion={selectedQuestion}
        onCityFound={handleCityFound}
      />
      <JourneySelector active={stage} onSelect={setStage} />
      <div id="ai-launcher">
        <AIAssistantLauncher activeStage={stage} autoQuery={selectedQuestion} />
      </div>
      <KeyQuestions activeStage={stage} />
      <TrustSection />
      <FAQ />
      <p className={styles.footerNote}>
        Assistedly helps families in Massachusetts find and compare assisted living communities.
        We do not provide medical advice. Always verify details directly with facilities.
      </p>
    </main>
  );
}
