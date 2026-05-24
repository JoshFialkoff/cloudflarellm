import { useState } from "react";

export default function AuthCapture({
  reason = "Enter your email to continue.",
  onSuccess,
  submitLabel = "Send magic link",
  successMessage = "Check your email for the sign-in link.",
  fallbackMessage = "Test mode: use the sign-in link below.",
  onSubmitStart,
  onSubmitResult,
}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [magicLink, setMagicLink] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    onSubmitStart?.(email);
    setStatus("Sending sign-in link...");
    setMagicLink("");
    const res = await fetch("/api/auth/request-magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data.error || "Could not send link.");
      onSubmitResult?.({
        ok: false,
        email,
        sent: false,
        error: data.error || "Could not send link.",
      });
      return;
    }
    window.localStorage.setItem("assistedly_email", email);
    onSuccess?.(email);
    setStatus(data.sent ? successMessage : fallbackMessage);
    if (data.magicLink) setMagicLink(data.magicLink);
    onSubmitResult?.({
      ok: true,
      email,
      sent: Boolean(data.sent),
      usedFallbackLink: Boolean(data.magicLink),
    });
  };

  return (
    <form onSubmit={submit}>
      <p>{reason}</p>
      <label>
        Email address
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </label>
      <button type="submit">{submitLabel}</button>
      {status ? <small>{status}</small> : null}
      {magicLink ? <a href={magicLink}>Open sign-in link</a> : null}
    </form>
  );
}
