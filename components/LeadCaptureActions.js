import { useState } from "react";
import styles from "../styles/GrowthMvp.module.css";
import { trackActionGoal } from "../lib/actionGoalTracking";

const EMAIL_STORAGE_KEY = "assistedly_email";

function trackedUrl(source, city) {
  const url = new URL("https://assistedly.ai/find-safest");
  url.searchParams.set("utm_source", source);
  url.searchParams.set("utm_medium", "share");
  url.searchParams.set("utm_campaign", "shortlist");
  if (city) url.searchParams.set("city", city);
  return url.toString();
}

function pdfEscape(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function createShortlistPdf({ facilities, city, sourceUrl }) {
  const lines = [
    "assistedly.AI",
    `Assisted living shortlist for ${city || "Massachusetts"}`,
    "Massachusetts senior care guidance",
    "",
    `Website: ${sourceUrl}`,
    "",
    ...facilities.flatMap((facility, index) => [
      `${index + 1}. ${facility.name}`,
      facility.address,
      `Care types: ${facility.careTypes.join(", ")}`,
      `Cost range: $${facility.monthlyMin.toLocaleString()} - $${facility.monthlyMax.toLocaleString()}/mo`,
      "",
    ]),
  ];

  const content = [
    "BT",
    "/F1 20 Tf",
    "72 760 Td",
    `(${pdfEscape(lines[0])}) Tj`,
    "/F1 11 Tf",
    ...lines.slice(1).map((line) => `0 -18 Td (${pdfEscape(line)}) Tj`),
    "ET",
  ].join("\n");

  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj\n",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
    `5 0 obj << /Length ${content.length} >> stream\n${content}\nendstream endobj\n`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object) => {
    offsets.push(pdf.length);
    pdf += object;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new Blob([pdf], { type: "application/pdf" });
}

export function ShortlistDownload({ facilities, city }) {
  const [email, setEmail] = useState(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(EMAIL_STORAGE_KEY) || "";
  });
  const [status, setStatus] = useState("");
  const sourceUrl = trackedUrl("pdf_shortlist", city);
  const shareUrl = trackedUrl("shared_shortlist", city);

  const submit = async (event) => {
    event.preventDefault();
    window.localStorage.setItem(EMAIL_STORAGE_KEY, email);
    const names = facilities.map((facility) => facility.name);
    await fetch("/api/leads/consumer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, city, facilities: names, intent: "download_shortlist" }),
    });
    const blob = createShortlistPdf({ facilities, city, sourceUrl });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "assistedly-shortlist.pdf";
    a.click();
    URL.revokeObjectURL(url);
    setStatus("PDF shortlist downloaded.");
  };

  const shareWithFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  const shareWithGmail = () => {
    const subject = `Assistedly shortlist for ${city || "Massachusetts"}`;
    const body = [
      "Here is the assisted living shortlist I found on assistedly.AI:",
      "",
      shareUrl,
      "",
      ...facilities.map((facility, index) => `${index + 1}. ${facility.name} - ${facility.address}`),
    ].join("\n");
    window.open(
      `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };

  return (
    <form className={styles.captureCard} onSubmit={submit}>
      <h3>Download your shortlist</h3>
      <p>Get a branded PDF with a tracked assistedly.ai link you can share with family.</p>
      <label>
        Email address
        <input
          id="shortlist-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          enterKeyHint="done"
          value={email}
          onFocus={() => {
            if (!email) setEmail(window.localStorage.getItem(EMAIL_STORAGE_KEY) || "");
          }}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email address"
          required
        />
      </label>
      <button
        type="submit"
        onClick={() =>
          trackActionGoal("download_shortlist_clicked", {
            city: city || undefined,
          })
        }
      >
        Download PDF shortlist
      </button>
      <div className={styles.shareActions} aria-label="Share shortlist">
        <button type="button" onClick={shareWithFacebook}>Share on Facebook</button>
        <button type="button" onClick={shareWithGmail}>Share with Gmail</button>
      </div>
      {status ? <small>{status}</small> : null}
    </form>
  );
}

export function HumanAdvisorLead({ city, facilities = [] }) {
  const [form, setForm] = useState(() => ({
    name: "",
    email: typeof window === "undefined" ? "" : window.localStorage.getItem(EMAIL_STORAGE_KEY) || "",
    notes: "",
  }));
  const [status, setStatus] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setStatus("Sending...");
    window.localStorage.setItem(EMAIL_STORAGE_KEY, form.email);
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
      <label>
        Name
        <input
          id="advisor-name"
          name="name"
          autoComplete="name"
          value={form.name}
          onChange={(event) => setForm((v) => ({ ...v, name: event.target.value }))}
          placeholder="Name"
        />
      </label>
      <label>
        Email address
        <input
          id="advisor-email"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          enterKeyHint="done"
          value={form.email}
          onFocus={() => {
            if (!form.email) {
              setForm((v) => ({ ...v, email: window.localStorage.getItem(EMAIL_STORAGE_KEY) || "" }));
            }
          }}
          onChange={(event) => setForm((v) => ({ ...v, email: event.target.value }))}
          placeholder="Email address"
          required
        />
      </label>
      <textarea name="notes" value={form.notes} onChange={(event) => setForm((v) => ({ ...v, notes: event.target.value }))} placeholder="What city, timeline, or care need should we know?" />
      <button
        type="submit"
        onClick={() =>
          trackActionGoal("ask_advisor_clicked", {
            city: city || undefined,
          })
        }
      >
        Ask an advisor
      </button>
      {status ? <small>{status}</small> : null}
    </form>
  );
}
