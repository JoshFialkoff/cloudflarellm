import { useState } from "react";
import styles from "../styles/Search.module.css";

export default function SearchLimitGate({ authSurface = "search_limit_gate" }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(""); // '' | 'submitting' | 'sent' | 'error'
  const [magicLink, setMagicLink] = useState("");

  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isEmailValid || status === "submitting") return;

    setStatus("submitting");
    try {
      const res = await fetch("/api/auth/request-magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          authSurface,
          redirectTo: "/search",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setStatus("sent");
        if (data.magicLink && !data.sent) {
          setMagicLink(data.magicLink);
        }
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className={styles.searchLimitGate}>
        <div className={styles.limitGateIcon}>✉️</div>
        <h2 className={styles.limitGateTitle}>Magic link sent!</h2>
        <p className={styles.limitGateBody}>
          Check your inbox for a sign-in link. Once you click it, you will have
          unlimited access to Assistedly searches.
        </p>
        {magicLink && (
          <p className={styles.limitGateTestLink}>
            <a href={magicLink}>Click here to sign in (dev mode)</a>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={styles.searchLimitGate}>
      <div className={styles.limitGateIcon}>🔍</div>
      <h2 className={styles.limitGateTitle}>Free search limit reached</h2>
      <p className={styles.limitGateBody}>
        You have used your 3 free searches. Sign in with your email to unlock
        unlimited access to Massachusetts facility data, safety scores, and
        personalized shortlists.
      </p>
      <form className={styles.limitGateForm} onSubmit={handleSubmit}>
        <input
          type="email"
          className={styles.limitGateInput}
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          aria-label="Email address"
        />
        <button
          type="submit"
          className={styles.limitGateBtn}
          disabled={!isEmailValid || status === "submitting"}
        >
          {status === "submitting" ? "Sending…" : "Send magic link"}
        </button>
      </form>
      {status === "error" && (
        <p className={styles.limitGateError}>
          Something went wrong. Please try again.
        </p>
      )}
      <p className={styles.limitGateFinePrint}>
        No password required. We will email you a one-click sign-in link.
      </p>
    </div>
  );
}
