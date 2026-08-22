// ⚠️ CRITICAL_FEATURE: Share Results CTA — additive CTA for matched page
// NEVER remove without !!APPROVED. Soft-lead-capture only; results visible first.
import { useState, useRef } from "react";
import {
    trackShareResultsCTAShown,
    trackShareResultsCTAExpanded,
    trackShareResultsFormFocused,
    trackShareResultsFormTypingStarted,
    trackShareResultsSubmitted,
    trackShareResultsFailed,
} from "../lib/registrationCTAAnalytics";
import styles from "../styles/ShareResultsCTA.module.css";

export default function ShareResultsCTA({ facilities = [] }) {
    const [expanded, setExpanded] = useState(false);
    const [senderEmail, setSenderEmail] = useState("");
    const [recipientEmail, setRecipientEmail] = useState("");
    const [senderName, setSenderName] = useState("");
    const [deepDive, setDeepDive] = useState(true);
    const [status, setStatus] = useState("");
    const [sent, setSent] = useState(false);
    const focusedRef = useRef(false);
    const typingRef = useRef(false);

    const topSlugs = facilities.slice(0, 3).map((f) => f.slug || f.id).filter(Boolean);

    // Track shown once on mount
    useState(() => {
        trackShareResultsCTAShown({
            top_facilities_count: topSlugs.length,
            cta_variant: "share_family",
        });
    });

    const handleExpand = () => {
        setExpanded(true);
        trackShareResultsCTAExpanded({
            top_facilities_count: topSlugs.length,
        });
    };

    const handleFocus = () => {
        if (focusedRef.current) return;
        focusedRef.current = true;
        trackShareResultsFormFocused({
            top_facilities_count: topSlugs.length,
        });
    };

    const handleTyping = (value, setter) => {
        setter(value);
        if (!typingRef.current && value.trim().length > 0) {
            typingRef.current = true;
            trackShareResultsFormTypingStarted({
                top_facilities_count: topSlugs.length,
            });
        }
    };

    const submit = async (e) => {
        e.preventDefault();
        const from = senderEmail.trim();
        const to = recipientEmail.trim();
        if (!from || !to) return;

        setStatus("Sending...");

        try {
            const res = await fetch("/api/comparisons/share", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    facilitySlugs: topSlugs,
                    method: "email",
                    senderName: senderName.trim() || "A family member",
                    senderEmail: from,
                    recipientEmail: to,
                    message: `I used Assistedly.ai to find assisted living matches. Here are the top options — thought you'd want to see.`,
                }),
            });
            const data = await res.json().catch(() => ({}));

            if (deepDive) {
                // Fire-and-forget deep-dive request
                fetch("/api/deep-dive-request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        email: from,
                        facilitySlugs: topSlugs,
                        source: "share_results_cta",
                        deepDive: true,
                    }),
                }).catch(() => {});
            }

            if (res.ok && data.ok) {
                setSent(true);
                setStatus("");
                trackShareResultsSubmitted({
                    top_facilities_count: topSlugs.length,
                    deep_dive_requested: deepDive,
                    has_sender_name: Boolean(senderName.trim()),
                });
            } else {
                const msg = data.error || "Could not send. Please try again.";
                setStatus(msg);
                trackShareResultsFailed({
                    error_message: msg,
                    top_facilities_count: topSlugs.length,
                });
            }
        } catch (err) {
            const msg = err?.message || "Network error. Please try again.";
            setStatus(msg);
            trackShareResultsFailed({
                error_message: msg,
                top_facilities_count: topSlugs.length,
            });
        }
    };

    if (sent) {
        return (
            <div className={styles.ctaContainer}>
                <div className={styles.successBox}>
                    <h3>✓ Sent!</h3>
                    <p>Your matched facilities have been shared.</p>
                    {deepDive && (
                        <p className={styles.successNote}>
                            A detailed AI compliance analysis is on its way to your inbox.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    if (!expanded) {
        return (
            <div className={styles.ctaContainer}>
                <button className={styles.expandButton} onClick={handleExpand}>
                    <span className={styles.icon}>📤</span>
                    <div className={styles.buttonText}>
                        <strong>Share with a family member</strong>
                        <span>Loop in siblings, spouses, or your parent</span>
                    </div>
                    <span className={styles.arrow}>→</span>
                </button>
            </div>
        );
    }

    return (
        <div className={styles.ctaContainer}>
            <div className={styles.formCard}>
                <h3>📤 Share these matches</h3>
                <p className={styles.subtitle}>
                    Send your top {topSlugs.length > 0 ? topSlugs.length : ""} matched facilities to someone who should see them.
                </p>
                <form onSubmit={submit}>
                    <input
                        type="text"
                        placeholder="Your name (optional)"
                        value={senderName}
                        onChange={(e) => handleTyping(e.target.value, setSenderName)}
                        onFocus={handleFocus}
                        className={styles.input}
                    />
                    <input
                        type="email"
                        placeholder="Your email"
                        value={senderEmail}
                        onChange={(e) => handleTyping(e.target.value, setSenderEmail)}
                        onFocus={handleFocus}
                        required
                        className={styles.input}
                    />
                    <input
                        type="email"
                        placeholder="Family member's email"
                        value={recipientEmail}
                        onChange={(e) => handleTyping(e.target.value, setRecipientEmail)}
                        onFocus={handleFocus}
                        required
                        className={styles.input}
                    />
                    <label className={styles.checkboxLabel}>
                        <input
                            type="checkbox"
                            checked={deepDive}
                            onChange={(e) => setDeepDive(e.target.checked)}
                        />
                        Also email me a detailed AI compliance analysis of these facilities
                    </label>
                    <button type="submit" className={styles.submitBtn}>
                        Send Results {deepDive ? "+ Analysis" : ""}
                    </button>
                    {status && <p className={styles.status}>{status}</p>}
                </form>
                <button
                    className={styles.cancelBtn}
                    onClick={() => setExpanded(false)}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
