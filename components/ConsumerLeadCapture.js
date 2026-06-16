'use client'

import { useState } from "react";
import styles from "../styles/GrowthMvp.module.css";
import { captureWithExperiment } from "../lib/posthogClient";
import { pushConversionDataLayer } from "../lib/conversionDataLayer";

export default function ConsumerLeadCapture({
  title = "Get the Massachusetts assisted living guide",
  description = "Get transparency-first planning help, a tour checklist, and comparison prompts by email.",
  intent = "consumer_mvp",
  leadMagnet = "massachusetts-guide",
  defaultTown = "",
  defaultCareNeed = "",
  facilities = [],
  page = "",
}) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    town: defaultTown,
    careNeed: defaultCareNeed,
  });
  const [status, setStatus] = useState("");

  async function submit(event) {
    event.preventDefault();
    setStatus("Saving your request...");

    const response = await fetch("/api/leads/consumer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        city: form.town,
        town: form.town,
        careNeed: form.careNeed,
        intent,
        leadMagnet,
        page,
        facilities,
      }),
    });

    if (!response.ok) {
      setStatus("We could not save your request. Please try again.");
      return;
    }

    captureWithExperiment("email_capture_submitted", {
      lead_magnet: leadMagnet,
      page: page || undefined,
      town: form.town || undefined,
      care_need: form.careNeed || undefined,
    });
    pushConversionDataLayer({
      event: "email_capture_submitted",
      lead_magnet: leadMagnet,
      page_path: page || undefined,
    });
    setStatus("Thanks. We saved your request and guide preferences.");
    setForm((current) => ({ ...current, name: "", email: "" }));
  }

  return (
    <form className={styles.captureCard} onSubmit={submit}>
      <h3>{title}</h3>
      <p>{description}</p>
      <label>
        Name
        <input
          type="text"
          autoComplete="name"
          value={form.name}
          onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
          placeholder="Your name"
        />
      </label>
      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          placeholder="you@example.com"
        />
      </label>
      <label>
        Town
        <input
          type="text"
          value={form.town}
          onChange={(event) => setForm((current) => ({ ...current, town: event.target.value }))}
          placeholder="Lexington"
        />
      </label>
      <label>
        Care need
        <input
          type="text"
          value={form.careNeed}
          onChange={(event) =>
            setForm((current) => ({ ...current, careNeed: event.target.value }))
          }
          placeholder="Assisted living, memory care, respite, etc."
        />
      </label>
      <button type="submit">Email me the guide</button>
      {status ? <small>{status}</small> : null}
    </form>
  );
}
