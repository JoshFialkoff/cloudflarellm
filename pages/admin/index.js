import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import {
  Activity, ArrowRight, Bot, CheckCircle2, CircleDollarSign, ExternalLink,
  Filter, GitCommit, HeartHandshake, Home, LayoutDashboard, Radio, Shield,
  Sparkles, Users, Watch,
} from "lucide-react";
import styles from "../../styles/admin/Dashboard.module.css";

const FIRECRAWL_JOB_ID = "019f460b-7783-7797-9087-a4bccaea1c5a";
const GITHUB_REPO = "https://github.com/JoshFialkoff/Assistedly.ai";

const FLYWHEEL = [
  { title: "Discover", text: "Understand the person, home, risks and cultural preferences.", icon: Users },
  { title: "Connect", text: "Recommend trusted AgeTech devices, wearables, and local service partners for long-term stickiness.", icon: Watch },
  { title: "Stay home", text: "Leverage device data, alerts, and routines to delay avoidable assisted-living moves.", icon: Home },
  { title: "Learn", text: "Turn longitudinal signals into better guidance and higher-confidence referrals.", icon: Activity },
  { title: "Retain & grow", text: "Earn recurring partner revenue while families return as needs evolve.", icon: CircleDollarSign },
];

const BUILD_LOG = [
  { date: "Jul 11", sha: "7604f4c", title: "Family Dashboard MVP", proof: "A shared onboarding workspace extends the relationship after search.", href: "/family-dashboard-shared" },
  { date: "Jul 8", sha: "9cc47d3", title: "Cultural affinity + safety filters", proof: "Families can narrow 530 Massachusetts facilities by affinity and crime rating.", href: "/search" },
  { date: "Jul 8", sha: "20db586", title: "Save and continue later", proof: "Families can pause a complex decision and return instead of starting over.", href: "/" },
  { date: "Jul 8", sha: "f2a034d", title: "Stay-at-home savings companion", proof: "Veteran benefits and lower-cost support paths help families delay placement.", href: "/tools/costs" },
  { date: "Jul 3", sha: "f9d8d93", title: "Shareable comparisons", proof: "A family can compare, save and share options across the decision group.", href: "/compare" },
  { date: "Jul 3", sha: "7b12b88", title: "Closed-loop user feedback", proof: "Results satisfaction now routes feedback to the founder and review loop.", href: "/results" },
];

const AFFINITY_EXAMPLE = {
  need: "A Massachusetts family wants a community aligned with language, faith or identity—and a safer neighborhood.",
  built: "Multi-select cultural-affinity filters, facility/community crime ratings and visible affinity tags on each result.",
  user: "A real search visitor can try this now on the live search page. Named testimonial or session evidence has not yet been attached, so this dashboard does not invent one.",
};

function fmt(value, suffix = "") {
  return value === null || value === undefined ? "Not measured" : `${value}${suffix}`;
}

export default function AdminDashboardPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (password === "$$enior$$5") { setAuthenticated(true); setError(""); }
    else setError("Incorrect password");
  };

  useEffect(() => {
    if (!authenticated) return;
    setLoading(true);
    Promise.all([
      fetch("/api/admin/firecrawl-data").then((response) => response.ok ? response.json() : Promise.reject(new Error("Competitive data unavailable"))),
      fetch("/api/admin/bot-health").then((response) => response.ok ? response.json() : Promise.reject(new Error("Health data unavailable"))),
    ])
      .then(([competitiveData, healthData]) => { setData(competitiveData); setHealth(healthData); })
      .catch((loadError) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, [authenticated]);

  const knownFunding = useMemo(() => {
    if (!data?.competitors) return 0;
    return data.competitors.reduce((sum, competitor) => {
      const match = (competitor.funding || "").match(/\$([\d.]+)M/i);
      return sum + (match ? Number(match[1]) : 0);
    }, 0);
  }, [data]);

  if (!authenticated) {
    return <>
      <Head><title>Continuum Growth Dashboard | Assistedly.ai</title><meta name="robots" content="noindex,nofollow" /></Head>
      <main className={styles.dashboard}>
        <header className={styles.header}><div className={styles.headerInner}><p className={styles.eyebrow}>Assistedly.ai strategy & execution</p><h1 className={styles.headerTitle}>Continuum Growth Dashboard</h1><p className={styles.headerSubtitle}>From one-time placement search to a long-term AgeTech relationship.</p></div></header>
        <section className={styles.authCard}><LayoutDashboard size={40} className={styles.brandIcon} /><h2>Access required</h2><p>Enter the dashboard password to view operating and competitive intelligence.</p><form onSubmit={handleSubmit} className={styles.authForm}><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Dashboard password" className={styles.authInput} /><button type="submit" className={styles.authBtn}><Shield size={16} /> Unlock dashboard</button>{error && <p className={styles.authError}>{error}</p>}</form></section>
      </main>
    </>;
  }

  if (loading) return <main className={styles.dashboard}><div className={styles.loadingState}><Activity className={styles.spin} /> Loading execution evidence…</div></main>;
  if (!data) return <main className={styles.dashboard}><div className={styles.loadingState}>Unable to load dashboard. {error}</div></main>;

  const latest = health?.current || {};
  const featuredCompetitors = data.competitors.filter((competitor) => /Papa|Honor|Birdie|August|Lottie/.test(competitor.name));

  return <>
    <Head><title>Continuum Growth Dashboard | Assistedly.ai</title><meta name="robots" content="noindex,nofollow" /></Head>
    <main className={styles.dashboard}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.headerTop}><div><p className={styles.eyebrow}>Assistedly.ai · alliance operating system</p><h1 className={styles.headerTitle}>Own the aging-at-home continuum</h1><p className={styles.headerSubtitle}>Placement search earns trust once. Wearables, devices and services turn that trust into recurring value—helping people stay home longer and giving partners durable distribution.</p></div><div className={styles.thesisBadge}><HeartHandshake size={20} /><span><strong>North-star thesis</strong>Long-term stickiness before placement</span></div></div>
        </div>
      </header>

      <div className={styles.container}>
        <section className={styles.flywheel} aria-labelledby="flywheel-title">
          <div className={styles.sectionHeading}><div><p className={styles.kicker}>Continuum flywheel</p><h2 id="flywheel-title">Every interaction improves the next one</h2></div><span className={styles.pill}>Search → prevention → support → referral</span></div>
          <div className={styles.flywheelTrack}>{FLYWHEEL.map((step, index) => { const Icon = step.icon; return <div className={styles.flywheelStep} key={step.title}><div className={styles.stepNumber}>0{index + 1}</div><Icon size={22} /><h3>{step.title}</h3><p>{step.text}</p>{index < FLYWHEEL.length - 1 && <ArrowRight className={styles.stepArrow} size={18} />}</div>; })}</div>
          <div className={styles.businessModel}><strong>Alliance revenue lanes:</strong><span>device referral / affiliate</span><span>qualified introductions</span><span>employer & payer sponsorship</span><span>family subscription</span><span>eventual placement referral</span></div>
        </section>

        <section className={styles.section} aria-labelledby="health-title">
          <div className={styles.sectionHeading}><div><p className={styles.kicker}>Proof we can execute</p><h2 id="health-title">Bot reliability monitor</h2></div><span className={`${styles.statusBadge} ${health?.monitored ? styles.statusLive : styles.statusWaiting}`}><Radio size={13} /> {health?.monitored ? latest.status : "No telemetry"}</span></div>
          <div className={styles.healthGrid}>
            <div className={styles.healthHero}><div className={styles.healthRing}><Bot size={31} /><strong>{fmt(latest.score)}</strong><span>health score</span></div><div><h3>Automated scorecard is visible</h3><p>Latest record: {latest.date || "No collection date"}. Missing metrics are shown honestly rather than converted into a false reliability claim.</p><a href="https://assistedly.ai/api/health" target="_blank" rel="noreferrer">Open live health endpoint <ExternalLink size={13} /></a></div></div>
            <Metric label="Uptime" value={fmt(latest.uptime, "%")} detail="Availability telemetry" />
            <Metric label="AI response" value={fmt(latest.responseTime)} detail="Response-time score" />
            <Metric label="Successful sessions" value={fmt(latest.interactions)} detail="Recorded interactions" />
          </div>
          <div className={styles.telemetryStrip}>{health?.history?.length ? health.history.map((record, index) => <div key={`${record.date}-${index}`} className={styles.telemetryBar} title={`${record.date}: ${record.score ?? "not measured"}`}><span style={{ height: `${Math.max(5, record.score || 0)}%` }} /></div>) : <p>No history collected yet.</p>}</div>
        </section>

        <section className={styles.section} aria-labelledby="build-title">
          <div className={styles.sectionHeading}><div><p className={styles.kicker}>GitHub-verified · past two weeks</p><h2 id="build-title">What changed—and what it looks like</h2></div><a className={styles.sourceLink} href={`${GITHUB_REPO}/commits/main/`} target="_blank" rel="noreferrer"><GitCommit size={15} /> View commit history</a></div>
          <div className={styles.buildGrid}>{BUILD_LOG.map((item) => <article className={styles.buildCard} key={item.sha}><div className={styles.buildMeta}><time>{item.date}</time><a href={`${GITHUB_REPO}/commit/${item.sha}`} target="_blank" rel="noreferrer">{item.sha}</a></div><h3>{item.title}</h3><p>{item.proof}</p><a href={item.href} target="_blank" rel="noreferrer">See it live <ExternalLink size={13} /></a></article>)}</div>
        </section>

        <section className={`${styles.section} ${styles.showcase}`} aria-labelledby="affinity-title">
          <div className={styles.showcaseCopy}><p className={styles.kicker}>Feature spotlight</p><h2 id="affinity-title">Cultural affinity is part of fit—not an afterthought</h2><div className={styles.proofStack}><Proof label="The need" text={AFFINITY_EXAMPLE.need} /><Proof label="I built" text={AFFINITY_EXAMPLE.built} /><Proof label="Real-user proof" text={AFFINITY_EXAMPLE.user} /></div><a className={styles.primaryLink} href="/search" target="_blank" rel="noreferrer">Try cultural-affinity search <ArrowRight size={15} /></a></div>
          <div className={styles.productMock}><div className={styles.mockToolbar}><span /><span /><span /><strong>Assistedly Search</strong></div><div className={styles.mockContent}><div className={styles.mockFilters}><p>Culture & community</p>{["LGBTQ+ welcoming", "Jewish community", "Spanish-speaking"].map((item, index) => <label key={item}><span className={index < 2 ? styles.checked : ""}>{index < 2 ? "✓" : ""}</span>{item}</label>)}</div><div className={styles.mockResult}><span className={styles.matchLabel}>Affinity match</span><h3>Community result</h3><p>Visible cultural affinities</p><div className={styles.tags}><span>LGBTQ+ welcoming</span><span>Jewish community</span></div><p className={styles.safety}>✓ Crime rating shown for facility and community</p></div></div></div>
        </section>

        <section className={styles.section} aria-labelledby="competition-title">
          <div className={styles.sectionHeading}><div><p className={styles.kicker}>Capital efficiency</p><h2 id="competition-title">Shipping continuum features without institutional funding</h2></div><div className={styles.fundingCallout}><strong>${knownFunding.toFixed(1)}M+</strong><span>disclosed rounds in selected comparison set</span></div></div>
          <div className={styles.comparisonIntro}><div><Sparkles size={22} /><strong>Assistedly.ai</strong><span>Bootstrapped / no institutional funding disclosed</span><small>Shipped search, affinity/safety filters, save-and-return, comparisons, family dashboard and cost tools in weeks.</small></div><div><Watch size={22} /><strong>The opportunity</strong><span>Connect those surfaces to AgeTech devices and recurring services</span><small>Move from a transaction at placement to an ongoing relationship before, during and after care transitions.</small></div></div>
          <div className={styles.competitorGrid}>{featuredCompetitors.map((competitor) => <article className={styles.competitorCard} key={competitor.name}><div><h3>{competitor.name}</h3><span>{competitor.category}</span></div><strong>{competitor.funding}</strong><p>{competitor.notes}</p><a href={competitor.url} target="_blank" rel="noreferrer">Source site <ExternalLink size={12} /></a></article>)}</div>
          <div className={styles.sourceNote}><CheckCircle2 size={16} /><p><strong>Source discipline:</strong> competitor descriptions and funding labels come from the repository’s Firecrawl competitive dataset, last updated {data.lastUpdate}. Requested Firecrawl job provenance: <code>{FIRECRAWL_JOB_ID}</code>. Funding totals include only dollar amounts explicitly present in labels and are directional—not an audited valuation comparison. Product claims should be rechecked before external publication.</p></div>
        </section>

        <footer className={styles.footer}>Continuum dashboard · GitHub build evidence + Firecrawl competitive intelligence · Updated {data.lastUpdate}</footer>
      </div>
    </main>
  </>;
}

function Metric({ label, value, detail }) { return <div className={styles.metricCard}><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function Proof({ label, text }) { return <div className={styles.proofItem}><span>{label}</span><p>{text}</p></div>; }
