import { useEffect, useState } from "react";
import IntentDashboard from "../components/intent/IntentDashboard";

export default function IntentPage() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setSession(data.session || null);
        setLoading(false);
      })
      .catch(() => {
        setSession(null);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div style={{ padding: "3rem", textAlign: "center" }}>Loading…</div>;
  }

  if (!session) {
    return (
      <div style={{ maxWidth: 480, margin: "3rem auto", textAlign: "center" }}>
        <h1>Intent Data Platform</h1>
        <p>Please sign in to view the dashboard.</p>
      </div>
    );
  }

  return (
    <main>
      <IntentDashboard />
    </main>
  );
}
