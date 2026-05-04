import { useState } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { normalizePartnerTrack, PARTNER_TRACK_IDS, PARTNER_TRACKS } from "../lib/leadPartnerRouting";
import { captureWithExperiment } from "../lib/posthogClient";
import searchStyles from "../styles/Search.module.css";
import growthStyles from "../styles/GrowthMvp.module.css";

const EMAIL_STORAGE_KEY = "assistedly_email";

export default function GetMatchedPage() {
  const router = useRouter();
  const qpCity = router.isReady && typeof router.query.city === "string" ? router.query.city : "";
  const qpTrack = router.isReady ? normalizePartnerTrack(String(router.query.track || "")) : "";

  const [trackPick, setTrackPick] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(EMAIL_STORAGE_KEY) || "";
  });
  const [cityInput, setCityInput] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");

  const partnerTrack = trackPick || qpTrack;
  const city = cityInput.trim() || qpCity;

  const submit = async (event) => {
    event.preventDefault();
    if (!partnerTrack) {
      setStatus("Choose one option above so we route you correctly.");
      return;
    }
    setStatus("Sending…");
    window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
    const utm =
      typeof router.query.utm_source === "string" ? router.query.utm_source : "direct";
    const res = await fetch("/api/leads/consumer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        flow: "get_matched",
        partnerTrack,
        intent: `get_matched_${partnerTrack}`,
        name,
        email,
        city,
        phone,
        notes: [
          notes.trim(),
          utm && utm !== "direct" ? `utm_source=${utm}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      }),
    });

    if (res.ok) {
      captureWithExperiment("get_matched_submitted", {
        partner_track: partnerTrack,
        city: city || null,
        utm_source: utm,
      });
      setStatus("Thanks — we received your request. Someone will follow up by email.");
    } else {
      const body = await res.json().catch(() => ({}));
      setStatus(body.error || "Could not send. Please try again.");
    }
  };

  return (
    <>
      <Head>
        <title>Get matched with care options | assistedly.AI</title>
        <meta
          name="description"
          content="Request an introduction to placement agencies, care advisors, or Medicaid planners in Massachusetts. No obligation."
        />
      </Head>

      <div className={searchStyles.searchPage}>
        <section className={searchStyles.searchHeader}>
          <div className="container">
            <p className={growthStyles.phase2Eyebrow}>Personalized introductions</p>
            <h1 className={growthStyles.phase2Title}>Get matched with options</h1>
            <p className={growthStyles.phase2Intro}>
              Tell us what kind of help you need. We&apos;ll introduce you to independent placement agencies, care
              advisors, or Medicaid planners who serve Massachusetts families. There is no charge from assistedly.AI for
              this introduction; partners have their own services and fees, and you decide whether to engage.
            </p>
            <p className={growthStyles.phase2Trust}>
              We only use your details to coordinate this request. You can ask us to stop follow-ups at any time.
            </p>
            <Link href="/find-safest" className={growthStyles.phase2BackLink}>
              ← Back to safest search
            </Link>
          </div>
        </section>

        <div className={growthStyles.resultsFirstShell}>
          <section className={growthStyles.phase2TrackSection} aria-label="Choose type of help">
            <h2 className={growthStyles.phase2SectionTitle}>1. What kind of help do you want first?</h2>
            <div className={growthStyles.matchTrackGrid}>
              {PARTNER_TRACK_IDS.map((id) => {
                const t = PARTNER_TRACKS[id];
                const selected = partnerTrack === id;
                return (
                  <button
                    key={id}
                    type="button"
                    className={`${growthStyles.matchTrackCard} ${selected ? growthStyles.matchTrackCardActive : ""}`}
                    onClick={() => setTrackPick(id)}
                    aria-pressed={selected}
                  >
                    <strong>{t.title}</strong>
                    <p>{t.blurb}</p>
                  </button>
                );
              })}
            </div>
          </section>

          <form className={`${growthStyles.captureCard} ${growthStyles.phase2Form}`} onSubmit={submit}>
            <h2 className={growthStyles.phase2SectionTitle}>2. How should we reach you?</h2>
            <label>
              Name
              <input
                name="name"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
              />
            </label>
            <label>
              Email address *
              <input
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                enterKeyHint="done"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
              />
            </label>
            <label>
              City or town (Massachusetts)
              <input
                name="city"
                autoComplete="address-level2"
                value={cityInput}
                onChange={(e) => setCityInput(e.target.value)}
                placeholder={qpCity ? `e.g. ${qpCity}` : "e.g. Worcester, Newton"}
              />
            </label>
            <label>
              Phone (optional)
              <input
                type="tel"
                name="phone"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="For a quicker callback if you want one"
              />
            </label>
            <label className={growthStyles.phase2NotesLabel}>
              Timeline or other context (optional)
              <textarea
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Need memory care within 60 days, spouse still at home, exploring MassHealth…"
              />
            </label>
            <button type="submit" className={growthStyles.phase2Submit}>
              Request introduction
            </button>
            {status ? (
              <p className={growthStyles.phase2Status} role="status">
                {status}
              </p>
            ) : null}
          </form>
        </div>
      </div>
    </>
  );
}
