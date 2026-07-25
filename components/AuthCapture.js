import { useRef, useState } from "react";
import {
    emailLengthBucket,
    trackAuthEmailFocused,
    trackAuthEmailTypingStarted,
    trackAuthFormSubmitted,
    trackAuthMagicLinkRequestFailed,
    trackAuthMagicLinkSent,
    trackAuthTestLinkClicked,
} from "../lib/authAnalytics";

export default function AuthCapture({
    buttonLabel = "Send magic link",
    submitLabel,
    authSurface = "magic_link_form",
    formId,
    reason = "Enter your email to continue.",
    redirectTo,
    resultSnapshot,
    onLinkRequested,
    onSuccess,
    onSubmitStart,
    onSubmitResult,
    successMessage,
    fallbackMessage,
    turnstileSiteKey,
}) {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState("");
    const [magicLink, setMagicLink] = useState("");
    const focusedRef = useRef(false);
    const typingStartedRef = useRef(false);
    const honeypotRef = useRef(null);

    const resolvedButtonLabel = submitLabel || buttonLabel;
    const resolvedFormId = formId || authSurface;

    const baseProps = () => ({
        auth_surface: authSurface,
        form_id: resolvedFormId,
        redirect_to: redirectTo || undefined,
        has_result_snapshot: Boolean(resultSnapshot),
    });

    const handleFocus = () => {
        if (focusedRef.current) return;
        focusedRef.current = true;
        trackAuthEmailFocused(baseProps());
    };

    const handleChange = (event) => {
        const next = event.target.value;
        setEmail(next);
        if (!typingStartedRef.current && next.trim().length > 0) {
            typingStartedRef.current = true;
            trackAuthEmailTypingStarted({
                ...baseProps(),
                email_length_bucket: emailLengthBucket(next.trim().length),
            });
        }
    };

    const submit = async (event) => {
        event.preventDefault();
        const trimmed = email.trim();
        if (!trimmed) return;

        const honeypotVal = honeypotRef.current?.value;
        if (honeypotVal) {
            setStatus("Bot detected.");
            return;
        }

        const turnstileToken = turnstileSiteKey && typeof window !== "undefined"
            ? window.turnstile?.getResponse?.()
            : undefined;

        onSubmitStart?.();
        trackAuthFormSubmitted({
            ...baseProps(),
            email_length_bucket: emailLengthBucket(trimmed.length),
        });

        setStatus("Sending sign-in link...");
        setMagicLink("");

        const res = await fetch("/api/auth/request-magic-link", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email: trimmed,
                redirectTo,
                resultSnapshot,
                authSurface,
                turnstileToken,
                company: honeypotVal,
            }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            const message = data.error || "Could not send link.";
            setStatus(message);
            trackAuthMagicLinkRequestFailed({
                ...baseProps(),
                error_message: message,
            });
            onSubmitResult?.({ ok: false, sent: false, error: message });
            return;
        }

        window.localStorage.setItem("assistedly_email", trimmed);
        onLinkRequested?.(trimmed);
        onSuccess?.(trimmed, data);

        trackAuthMagicLinkSent({
            ...baseProps(),
            email_delivery_sent: Boolean(data.sent),
            test_mode: Boolean(data.magicLink),
        });
        onSubmitResult?.({ ok: true, sent: Boolean(data.sent), data });

        setStatus(
            data.sent
                ? successMessage || "Check your email for the sign-in link."
                : fallbackMessage || "Test mode: use the sign-in link below.",
        );
        if (data.magicLink) setMagicLink(data.magicLink);
    };

    return (
        <form onSubmit={submit} id={resolvedFormId} className="auth-capture-form">
            <p className="auth-capture-reason">{reason}</p>
            {/* Honeypot: hidden field bots will fill in */}
            <label style={{ position: "absolute", left: "-9999px" }} aria-hidden="true">
                Company
                <input
                    ref={honeypotRef}
                    type="text"
                    name="company"
                    tabIndex={-1}
                    autoComplete="off"
                    defaultValue=""
                />
            </label>
            <label className="auth-capture-label">
                Email address
                <input
                    type="email"
                    value={email}
                    onFocus={handleFocus}
                    onChange={handleChange}
                    placeholder="you@example.com"
                    required
                    autoComplete="email"
                    className="auth-capture-input"
                />
            </label>
            {turnstileSiteKey ? (
                <div
                    className="cf-turnstile"
                    data-sitekey={turnstileSiteKey}
                    style={{ marginBottom: 12 }}
                />
            ) : null}
            <button type="submit" className="btn-primary auth-capture-button">{resolvedButtonLabel}</button>
            {status ? <small className="auth-capture-status">{status}</small> : null}
            {magicLink ? (
                <a
                    href={magicLink}
                    onClick={() =>
                        trackAuthTestLinkClicked({
                            ...baseProps(),
                            link_kind: "dev_magic_link",
                        })
                    }
                    className="auth-capture-magic-link"
                >
                    Open sign-in link
                </a>
            ) : null}
        </form>
    );
}
