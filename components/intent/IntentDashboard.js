import { useEffect, useState } from "react";
import styles from "./IntentDashboard.module.css";

async function fetchAllData() {
  try {
    const [accRes, conRes, audRes, statsRes] = await Promise.all([
      fetch("/api/intent/accounts"),
      fetch("/api/intent/contacts"),
      fetch("/api/intent/audiences"),
      fetch("/api/intent/graph?stats=true"),
    ]);
    const [accJson, conJson, audJson, statsJson] = await Promise.all([
      accRes.json(), conRes.json(), audRes.json(), statsRes.json(),
    ]);
    return {
      accounts: accJson.data || [],
      contacts: conJson.data || [],
      audiences: audJson.data || [],
      graphStats: statsJson.data || null,
    };
  } catch (err) {
    console.error("AIDP fetch error:", err);
    return { accounts: [], contacts: [], audiences: [], graphStats: null };
  }
}

export default function IntentDashboard() {
  const [accounts, setAccounts] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [audiences, setAudiences] = useState([]);
  const [graphStats, setGraphStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeded, setSeeded] = useState(false);
  const [domainScore, setDomainScore] = useState(null);
  const [scoreDomain, setScoreDomain] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchAllData().then((data) => {
      if (cancelled) return;
      setAccounts(data.accounts);
      setContacts(data.contacts);
      setAudiences(data.audiences);
      setGraphStats(data.graphStats);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  async function handleSeed() {
    setLoading(true);
    try {
      await fetch("/api/intent/seed", { method: "POST" });
      setSeeded(true);
      await fetchAll();
    } catch (err) {
      console.error("Seed error:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handleScore() {
    if (!scoreDomain.trim()) return;
    try {
      const res = await fetch(`/api/intent/intent-score?domain=${encodeURIComponent(scoreDomain.trim())}`);
      const json = await res.json();
      setDomainScore(json.data || null);
    } catch (err) {
      console.error("Score error:", err);
    }
  }

  async function handleExport(audienceId, format = "json") {
    window.open(`/api/intent/audiences/${audienceId}/export?format=${format}`, "_blank");
  }

  if (loading) {
    return <div className={styles.loading}>Loading Intent Data Platform…</div>;
  }

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1>Intent Data Platform</h1>
        <button className={styles.button} onClick={handleSeed}>
          {seeded ? "Re-seed Demo Data" : "Seed Demo Data"}
        </button>
      </header>

      {graphStats && (
        <section className={styles.stats}>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{graphStats.totalAccounts}</div>
            <div className={styles.statLabel}>Accounts</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{graphStats.totalContacts}</div>
            <div className={styles.statLabel}>Contacts</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{graphStats.totalAudiences}</div>
            <div className={styles.statLabel}>Audiences</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statNumber}>{graphStats.avgContactsPerAccount}</div>
            <div className={styles.statLabel}>Avg Contacts / Account</div>
          </div>
        </section>
      )}

      <section className={styles.section}>
        <h2>Intent Scoring</h2>
        <div className={styles.scoreRow}>
          <input
            className={styles.input}
            placeholder="Enter domain (e.g. brightspringhealth.com)"
            value={scoreDomain}
            onChange={(e) => setScoreDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleScore()}
          />
          <button className={styles.button} onClick={handleScore}>Score</button>
        </div>
        {domainScore && (
          <div className={styles.scoreResult}>
            <span className={`${styles.tierBadge} ${styles[`tier${domainScore.tier}`]}`}>
              {domainScore.tier}
            </span>
            <span className={styles.scoreValue}>{domainScore.score} / 100</span>
            <span className={styles.scoreMeta}>{domainScore.contacts} contacts</span>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>Accounts</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Domain</th>
              <th>Industry</th>
              <th>Size</th>
              <th>Signals</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.domain}</td>
                <td>{a.industry}</td>
                <td>{a.size}</td>
                <td>
                  {(a.signals || []).map((s) => (
                    <span key={s} className={styles.tag}>{s}</span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h2>Contacts</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Title</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c) => (
              <tr key={c.id}>
                <td>{c.firstName} {c.lastName}</td>
                <td>{c.email}</td>
                <td>{c.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <h2>Audiences</h2>
        {audiences.map((aud) => (
          <div key={aud.id} className={styles.audienceCard}>
            <div className={styles.audienceHeader}>
              <strong>{aud.name}</strong>
              <span className={styles.meta}>{aud.accountIds?.length || 0} accounts · {aud.contactIds?.length || 0} contacts</span>
            </div>
            <p className={styles.description}>{aud.description}</p>
            <div className={styles.actions}>
              <button className={styles.buttonSmall} onClick={() => handleExport(aud.id, "json")}>Export JSON</button>
              <button className={styles.buttonSmall} onClick={() => handleExport(aud.id, "csv")}>Export CSV</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
