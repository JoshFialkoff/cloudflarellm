import { useState, useEffect } from 'react';
import Head from 'next/head';

const PASSWORD = 'assistedly2026';
const STAGES = [
  { id: 1, label: 'Finalize Top 3 Facilities', complete: true },
  { id: 2, label: 'Share with Relatives', complete: false, active: true },
  { id: 3, label: 'Schedule Facility Tours', complete: false },
  { id: 4, label: 'Get Family Approval', complete: false },
  { id: 5, label: 'Review & Sign Contracts', complete: false },
  { id: 6, label: 'Submit Medical Records & POA', complete: false },
  { id: 7, label: 'Complete Move-In', complete: false },
];

const FACILITIES = [
  { name: 'Sunrise of Burlington', cost: '$6,200/mo', rating: 4.0, votes: { up: 3, down: 0 } },
  { name: 'Brookdale Lexington', cost: '$5,800/mo', rating: 4.5, votes: { up: 2, down: 1 } },
  { name: 'Benchmark at Waltham', cost: '$7,100/mo', rating: 4.2, votes: { up: 2, down: 0 } },
];

const FAMILY = [
  { name: 'Emily Chen', role: 'Daughter · Admin', status: 'Approved' },
  { name: 'Mark Thompson', role: 'Son · Viewer', status: 'Reviewed' },
  { name: 'Susan Miller', role: 'Sister · Reviewer', status: 'Needs Follow-up' },
];

const DOCUMENTS = [
  { name: 'Financial Records', status: 'Uploaded', by: 'Emily C.' },
  { name: 'Medical History', status: 'Pending', by: '—' },
  { name: 'Insurance Cards', status: 'Uploaded', by: 'Mark T.' },
  { name: 'Power of Attorney (POA)', status: 'Not Started', by: '—' },
  { name: 'Facility Contract', status: 'Not Started', by: '—' },
  { name: 'Move-In Checklist', status: 'Not Started', by: '—' },
];

export default function FamilyDashboardPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('progress');
  const [stages, setStages] = useState(STAGES);
  const [facilities, setFacilities] = useState(FACILITIES);
  const [docs, setDocs] = useState(DOCUMENTS);
  const [showFacilityComments, setShowFacilityComments] = useState(null);

  useEffect(() => {
    fetch('/api/family-dashboard-auth')
      .then(r => { if (r.ok) setAuthenticated(true); })
      .finally(() => setLoading(false));
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    const res = await fetch('/api/family-dashboard-auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) setAuthenticated(true);
    else { setError('Incorrect password'); setPassword(''); }
  };

  const toggleStage = (id) => {
    setStages(prev => prev.map(s => s.id === id ? { ...s, complete: !s.complete } : s));
  };

  const voteFacility = (name, dir) => {
    setFacilities(prev => prev.map(f => {
      if (f.name !== name) return f;
      const v = { ...f.votes };
      if (dir === 'up') v.up++; else v.down++;
      return { ...f, votes: v };
    }));
  };

  const toggleDocStatus = (name) => {
    setDocs(prev => prev.map(d => {
      if (d.name !== name) return d;
      const cycle = { 'Not Started': 'Pending', 'Pending': 'Uploaded', 'Uploaded': 'Not Started' };
      return { ...d, status: cycle[d.status] };
    }));
  };

  const completed = stages.filter(s => s.complete).length;
  const pct = Math.round((completed / stages.length) * 100);

  if (loading) return <div style={styles.center}><p>Loading...</p></div>;

  if (!authenticated) {
    return (
      <div style={styles.authWrap}>
        <div style={styles.authCard}>
          <h1 style={styles.authTitle}>Assistedly</h1>
          <h2 style={styles.authSub}>Family Dashboard Preview</h2>
          <p style={styles.authText}>Enter the preview password to continue.</p>
          <form onSubmit={handleLogin}>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="Password" style={styles.authInput} autoFocus />
            {error && <p style={styles.authError}>{error}</p>}
            <button type="submit" style={styles.authBtn}>Unlock Dashboard</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Family Dashboard — Assistedly</title>
        <meta name="robots" content="noindex" />
      </Head>
      <div style={styles.app}>
        {/* Sidebar */}
        <div style={styles.sidebar}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={styles.avatar}>MT</div>
            <p style={{ fontWeight: 'bold', margin: '8px 0 4px', color: '#333' }}>Margaret Thompson</p>
            <p style={{ fontSize: 12, color: '#999', margin: 0 }}>Onboarding Journey</p>
          </div>

          <button style={{ ...styles.navBtn, ...(activeTab === 'progress' ? styles.navActive : {}) }}
            onClick={() => setActiveTab('progress')}>🛤️ Journey Progress</button>
          <button style={{ ...styles.navBtn, ...(activeTab === 'facilities' ? styles.navActive : {}) }}
            onClick={() => setActiveTab('facilities')}>🏠 Facility Shortlist</button>
          <button style={{ ...styles.navBtn, ...(activeTab === 'family' ? styles.navActive : {}) }}
            onClick={() => setActiveTab('family')}>👨‍👩‍👧 Family Circle</button>
          <button style={{ ...styles.navBtn, ...(activeTab === 'docs' ? styles.navActive : {}) }}
            onClick={() => setActiveTab('docs')}>📄 Documents</button>

          <div style={{ marginTop: 'auto', padding: '16px 0', borderTop: '1px solid #ddd', fontSize: 11, color: '#aaa' }}>
            Assistedly · Preview
          </div>
        </div>

        {/* Main Content */}
        <div style={styles.main}>
          {/* Progress Bar */}
          <div style={styles.progressWrap}>
            <span style={{ fontWeight: 'bold', fontSize: 14 }}>{pct}% Complete</span>
            <div style={styles.progressBar}>
              <div style={{ ...styles.progressFill, width: `${pct}%` }} />
            </div>
          </div>

          {activeTab === 'progress' && (
            <div>
              <h2 style={styles.sectionTitle}>Onboarding Journey</h2>
              <p style={{ color: '#666', marginBottom: 20 }}>
                Follow these steps to get Margaret settled into the right facility.
              </p>
              {stages.map(s => (
                <div key={s.id}
                  style={{ ...styles.step, borderLeftColor: s.complete ? '#4caf50' : s.active ? '#1976d2' : '#ddd' }}
                  onClick={() => toggleStage(s.id)}>
                  <input type="checkbox" checked={s.complete} readOnly style={{ marginRight: 10, transform: 'scale(1.2)' }} />
                  <span style={{ textDecoration: s.complete ? 'line-through' : 'none', color: s.complete ? '#999' : '#333', fontWeight: s.active ? 'bold' : 'normal' }}>
                    {s.label}
                  </span>
                  {s.active && !s.complete && <span style={{ marginLeft: 8, fontSize: 12, color: '#1976d2' }}>← Current</span>}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'facilities' && (
            <div>
              <h2 style={styles.sectionTitle}>Facility Shortlist</h2>
              <p style={{ color: '#666', marginBottom: 20 }}>Top 3 facilities selected for Margaret.</p>
              {facilities.map(f => (
                <div key={f.name} style={styles.card}>
                  <h3 style={{ color: '#1976d2', margin: '0 0 8px', fontSize: 18 }}>{f.name}</h3>
                  <p style={{ color: '#666', margin: '4px 0', fontSize: 14 }}>
                    {f.cost} · {'⭐'.repeat(Math.floor(f.rating))}{'½'.repeat(f.rating % 1 >= 0.5 ? 1 : 0)}
                  </p>
                  <div style={{ margin: '12px 0' }}>
                    <span style={{ marginRight: 12, cursor: 'pointer', fontSize: 14 }} onClick={() => voteFacility(f.name, 'up')}>
                      👍 {f.votes.up}
                    </span>
                    <span style={{ cursor: 'pointer', fontSize: 14 }} onClick={() => voteFacility(f.name, 'down')}>
                      👎 {f.votes.down}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={styles.btn}>📤 Share with Family</button>
                    <button style={styles.btnOutline}>📅 Request Tour</button>
                    <button style={styles.btnSmall} onClick={() => setShowFacilityComments(showFacilityComments === f.name ? null : f.name)}>
                      💬 Discuss
                    </button>
                  </div>
                  {showFacilityComments === f.name && (
                    <div style={{ marginTop: 16, padding: 16, background: '#f9f9f9', borderRadius: 8 }}>
                      <p style={{ fontWeight: 'bold', fontSize: 14, margin: '0 0 8px' }}>Family Discussion</p>
                      <div style={{ fontSize: 13, color: '#666' }}>
                        <p style={{ margin: '4px 0' }}><b>Emily:</b> I really liked the courtyard at this one.</p>
                        <p style={{ margin: '4px 0' }}><b>Mark:</b> Can we ask about meal plans?</p>
                      </div>
                      <input placeholder="Add a comment..." style={{ width: '100%', marginTop: 8, padding: '8px', border: '1px solid #ddd', borderRadius: 4, boxSizing: 'border-box' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {activeTab === 'family' && (
            <div>
              <h2 style={styles.sectionTitle}>Family Circle</h2>
              <p style={{ color: '#666', marginBottom: 20 }}>People helping with Margaret&apos;s care decisions.</p>
              {FAMILY.map(m => (
                <div key={m.name} style={styles.member}>
                  <div>
                    <strong>{m.name}</strong>
                    <span style={{ marginLeft: 8, color: '#888', fontSize: 13 }}>{m.role}</span>
                  </div>
                  <span style={{
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: m.status === 'Approved' ? '#e8f5e9' : m.status === 'Reviewed' ? '#e3f2fd' : '#fff3e0',
                    color: m.status === 'Approved' ? '#2e7d32' : m.status === 'Reviewed' ? '#1565c0' : '#e65100',
                  }}>
                    {m.status}
                  </span>
                </div>
              ))}

              <div style={{ ...styles.card, marginTop: 24, background: '#f5f5f5' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 16 }}>Facility Voting Tally</h4>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #ddd' }}>
                      <th style={{ textAlign: 'left', padding: '6px 0' }}>Facility</th>
                      <th>Emily</th>
                      <th>Mark</th>
                      <th>Susan</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px 0' }}>Sunrise</td>
                      <td style={{ textAlign: 'center' }}>✅</td>
                      <td style={{ textAlign: 'center' }}>✅</td>
                      <td style={{ textAlign: 'center' }}>✅</td>
                      <td style={{ textAlign: 'center', color: '#2e7d32', fontWeight: 'bold' }}>3/3</td>
                    </tr>
                    <tr style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '6px 0' }}>Brookdale</td>
                      <td style={{ textAlign: 'center' }}>✅</td>
                      <td style={{ textAlign: 'center' }}>—</td>
                      <td style={{ textAlign: 'center' }}>✅</td>
                      <td style={{ textAlign: 'center', color: '#f57c00' }}>2/3</td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 0' }}>Benchmark</td>
                      <td style={{ textAlign: 'center' }}>✅</td>
                      <td style={{ textAlign: 'center' }}>✅</td>
                      <td style={{ textAlign: 'center' }}>—</td>
                      <td style={{ textAlign: 'center', color: '#f57c00' }}>2/3</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'docs' && (
            <div>
              <h2 style={styles.sectionTitle}>Document Repository</h2>
              <p style={{ color: '#666', marginBottom: 20 }}>
                Required documents for facility onboarding.
              </p>
              {docs.map(d => (
                <div key={d.name} style={styles.docItem} onClick={() => toggleDocStatus(d.name)}>
                  <input type="checkbox" checked={d.status === 'Uploaded'} readOnly style={{ marginRight: 10, transform: 'scale(1.2)', cursor: 'pointer' }} />
                  <div style={{ flex: 1 }}>
                    <strong>{d.name}</strong>
                    <span style={{ marginLeft: 8, fontSize: 12, color: '#999' }}>by {d.by}</span>
                  </div>
                  <span style={{
                    fontSize: 12,
                    padding: '2px 8px',
                    borderRadius: 12,
                    background: d.status === 'Uploaded' ? '#e8f5e9' : d.status === 'Pending' ? '#fff3e0' : '#f5f5f5',
                    color: d.status === 'Uploaded' ? '#2e7d32' : d.status === 'Pending' ? '#e65100' : '#999',
                  }}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

const styles = {
  app: { display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh', fontFamily: 'Arial, Helvetica, sans-serif', fontSize: 16 },
  sidebar: { background: '#fafafa', borderRight: '2px solid #e0e0e0', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 4 },
  main: { padding: '32px', background: '#fff', overflowY: 'auto' },
  avatar: { width: 72, height: 72, borderRadius: '50%', background: '#1976d2', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, margin: '0 auto', fontWeight: 'bold' },
  navBtn: { display: 'block', width: '100%', padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: 14, borderRadius: 6, borderLeft: '3px solid transparent', transition: 'all .15s', marginBottom: 4 },
  navActive: { background: '#e3f2fd', borderLeftColor: '#1976d2', fontWeight: 'bold' },
  sectionTitle: { fontSize: 24, color: '#333', margin: '0 0 4px' },
  progressWrap: { display: 'flex', alignItems: 'center', marginBottom: 24, gap: 12 },
  progressBar: { flex: 1, height: 14, background: '#eee', borderRadius: 24, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #4caf50, #66bb6a)', borderRadius: 24, transition: 'width .4s ease' },
  step: { padding: '16px', marginBottom: 8, background: '#f9f9f9', borderLeft: '4px solid #ddd', borderRadius: '0 8px 8px 0', cursor: 'pointer', display: 'flex', alignItems: 'center', fontSize: 15 },
  card: { padding: 20, marginBottom: 16, background: '#e3f2fd', borderRadius: 16, border: '1px solid #bbdefb' },
  btn: { padding: '10px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnOutline: { padding: '10px 16px', background: 'transparent', color: '#1976d2', border: '2px solid #1976d2', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnSmall: { padding: '10px 16px', background: '#f5f5f5', color: '#555', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  member: { padding: '14px', marginBottom: 8, background: '#e8f5e9', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 },
  docItem: { padding: '16px', marginBottom: 8, background: '#f9f9f9', borderRadius: 8, display: 'flex', alignItems: 'center', cursor: 'pointer' },
  authWrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #e3f2fd 0%, #e8f5e9 100%)', fontFamily: 'Arial, Helvetica, sans-serif' },
  authCard: { background: '#fff', padding: '48px', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: 420, width: '90%' },
  authTitle: { color: '#1976d2', marginBottom: 4, fontSize: 32 },
  authSub: { color: '#555', marginBottom: 24, fontSize: 20, fontWeight: 400 },
  authText: { color: '#666', marginBottom: 24, fontSize: 16 },
  authInput: { width: '100%', padding: '14px', fontSize: 16, border: '2px solid #ddd', borderRadius: 8, marginBottom: 12, boxSizing: 'border-box' },
  authError: { color: '#d32f2f', marginBottom: 12, fontSize: 14 },
  authBtn: { width: '100%', padding: '14px', fontSize: 16, background: '#1976d2', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 'bold' },
  center: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial' },
};
