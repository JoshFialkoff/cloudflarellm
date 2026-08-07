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
}) {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState("");
    const [magicLink, setMagicLink] = useState("");
    const focusedRef = useRef(false);
    const typingStartedRef = useRef(false);

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
            <button type="submit" className="btn-primary auth-capture-button">{resolvedButtonLabel}</button>
            {status ? <small className="auth-capture-status">{status}</small> : null}
        </form>
    );
}
