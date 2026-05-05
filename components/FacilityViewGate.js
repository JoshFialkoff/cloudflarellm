import { useEffect, useState } from "react";
import AuthCapture from "./AuthCapture";
import styles from "../styles/GrowthMvp.module.css";

const VIEW_KEY = "assistedly_facility_views";
const FREE_LIMIT = 3;

export default function FacilityViewGate({ facilitySlug, children }) {
  const [ready, setReady] = useState(false);
  const [locked, setLocked] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const session = await fetch("/api/auth/me").then((res) => res.json()).catch(() => ({}));
      if (session.authenticated) {
        if (!cancelled) {
          setReady(true);
          setLocked(false);
          setEmail(session.email || "");
        }
        return;
      }

      const viewed = JSON.parse(window.localStorage.getItem(VIEW_KEY) || "[]");
      const next = Array.from(new Set([...viewed, facilitySlug]));
      window.localStorage.setItem(VIEW_KEY, JSON.stringify(next));
      if (!cancelled) {
        setLocked(next.length > FREE_LIMIT);
        setReady(true);
      }
    }
    check();
    return () => {
      cancelled = true;
    };
  }, [facilitySlug]);

  if (!ready) return null;

  if (!locked || email) return children;

  return (
    <div className={styles.gateCard}>
      <h2>You have used your 3 free facility views.</h2>
      <AuthCapture
        reason="Create a free account with email magic link to keep comparing Massachusetts assisted living safety data."
      />
    </div>
  );
}
