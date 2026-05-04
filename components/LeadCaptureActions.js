import { useState } from "react";
import styles from "../styles/GrowthMvp.module.css";

export function ShortlistDownload({ facilities, city }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const names = facilities.map((facility) => facility.name);
    await fetch("/api/leads/consumer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, city, facilities: names, intent: "download_shortlist" }),
    });
    const text = facilities
      .map((facility, index) => `${index + 1}. ${facility.name}\n${facility.address}\n${facility.careTypes.join(", ")}\n`)
      .join("\n");
    const blob = new Blob([`Assistedly shortlist for ${city || "Massachusetts"}\n\n${text}`], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "assistedly-shortlist.txt";
    a.click();
    URL.revokeObjectURL(url);
    setStatus("Shortlist downloaded.");
  };

  return (
    <form className={styles.captureCard} onSubmit={submit}>
      <h3>Download your shortlist</h3>
      <p>Get the top facilities as a simple file you can share with family.</p>
      <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email address" required />
      <button type="submit">Download shortlist</button>
      {status ? <small>{status}</small> : null}
    </form>
  );
}

export function HumanAdvisorLead({ city, facilities = [] }) {
  const [form, setForm] = useState({ name: "", email: "", notes: "" });
  const [status, setStatus] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setStatus("Sending...");
    const res = await fetch("/api/leads/consumer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        city,
        facilities: facilities.map((facility) => facility.name),
        intent: "human_advisor",
      }),
    });
    setStatus(res.ok ? "Thanks. A human advisor request was sent." : "Could not send request.");
  };

  return (
    <form className={styles.captureCard} onSubmit={submit}>
      <h3>Get help from a human advisor</h3>
      <p>Want someone to help compare safety questions, availability, and next calls?</p>
      <input value={form.name} onChange={(event) => setForm((v) => ({ ...v, name: event.target.value }))} placeholder="Name" />
      <input type="email" value={form.email} onChange={(event) => setForm((v) => ({ ...v, email: event.target.value }))} placeholder="Email address" required />
      <textarea value={form.notes} onChange={(event) => setForm((v) => ({ ...v, notes: event.target.value }))} placeholder="What city, timeline, or care need should we know?" />
      <button type="submit">Ask an advisor</button>
      {status ? <small>{status}</small> : null}
    </form>
  );
}
