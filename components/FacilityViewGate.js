import { useEffect, useState } from "react";
import AuthCapture from "./AuthCapture";
import styles from "../styles/GrowthMvp.module.css";

const VIEW_KEY = "assistedly_facility_views";
const FREE_LIMIT = 3;

export default function FacilityViewGate({ facilitySlug, redirectTo, children }) {
  const [locked, setLocked] = useState(false);
  const [sessionEmail, setSessionEmail] = useState("");
  const [sessionRole, setSessionRole] = useState("visitor");

  useEffect(() => {
    let cancelled = false;
    async function check() {
      const session = await fetch("/api/auth/me")
        .then((res) => res.json())
        .catch(() => ({}));

      if (cancelled) return;

      const email = session?.email || "";
      const role = session?.role || "visitor";
      setSessionEmail(email);
      setSessionRole(role);

      if (session?.authenticated || role === "premium_user" || role === "admin") {
        setLocked(false);
        return;
      }

      let viewed = [];
      try {
        viewed = JSON.parse(window.localStorage.getItem(VIEW_KEY) || "[]");
        if (!Array.isArray(viewed)) viewed = [];
      } catch {
        viewed = [];
      }

      const alreadyViewed = viewed.includes(facilitySlug);
      const next = alreadyViewed ? viewed : Array.from(new Set([...viewed, facilitySlug]));
      if (!alreadyViewed) {
        window.localStorage.setItem(VIEW_KEY, JSON.stringify(next));
      }

      setLocked(next.length > FREE_LIMIT);
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [facilitySlug]);

  if (locked && !sessionEmail && sessionRole !== "premium_user" && sessionRole !== "admin") {
    return (
      <div className={styles.gateCard}>
        <h2>You have used your 3 free facility views.</h2>
        <AuthCapture
          authSurface="facility_view_gate"
          formId="facility_view_gate_magic_link"
          redirectTo={redirectTo}
          reason="Create a free account with email magic link to keep comparing Massachusetts assisted living safety data."
        />
      </div>
    );
  }

  return children;
}
