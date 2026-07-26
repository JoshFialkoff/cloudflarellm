import Link from "next/link";
import { useRef } from "react";
import styles from "../styles/Home.module.css";
import {
    emailLengthBucket,
    trackEmailSignupFocused,
    trackEmailSignupTypingStarted,
} from "../lib/authAnalytics";
/**
 * Shared stack: How it works → Trust → Stats → CTA → Footer.
 * @param {{
 *   email: string,
 *   onEmailChange: (e: import("react").ChangeEvent<HTMLInputElement>) => void,
 *   onCtaSubmit: (e: import("react").FormEvent<HTMLFormElement>) => void,
 *   ctaSubmitting?: boolean,
 *   ctaError?: string,
 * }} props
 */
export default function HomeBelowHero({
    email,
    onEmailChange,
    onCtaSubmit,
    ctaSubmitting = false,
    ctaError = "",
}) {
    const signupFocusedRef = useRef(false);
    const signupTypingRef = useRef(false);

    const handleEmailFocus = () => {
        if (signupFocusedRef.current) return;
        signupFocusedRef.current = true;
        trackEmailSignupFocused({ auth_surface: "homepage_email_signup" });
    };

    const handleEmailChange = (event) => {
        onEmailChange(event);
        const value = event.target.value;
        if (!signupTypingRef.current && value.trim().length > 0) {
            signupTypingRef.current = true;
            trackEmailSignupTypingStarted({
                auth_surface: "homepage_email_signup",
                email_length_bucket: emailLengthBucket(value.trim().length),
            });
        }
    };

    return (
        <>
            {/* How It Works */}
            <section className={styles.howItWorks} id="how-it-works">
                <div className="container">
                    <h2 className={styles.sectionTitle}>How Assistedly.ai Works</h2>
                    <p className={styles.sectionSubtitle}>
                        A Massachusetts startup using our own data to help families find assisted living facilities
                    </p>
                    <div className={styles.stepsGrid}>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIcon}>📋</div>
                            <h3 className={styles.stepTitle}>
                                Customized for You
                            </h3>
                            <p className={styles.stepDesc}>
                                Share your loved one&apos;s care requirements,
                                budget, and location preferences. Our own private
                                AI guides you through every important decision you
                                need to make.
                            </p>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIcon}>🤖</div>
                            <h3 className={styles.stepTitle}>
                                Data &gt; Pretty Pictures
                            </h3>
                            <p className={styles.stepDesc}>
                                You don&apos;t have to rely on which facilities has the
                                best stock photography. Instead, Assistedly.ai
                                analyzes hundreds of data points — compliance records,
                                amenities, staffing ratios, and resident reviews — to
                                find your best matches.
                            </p>
                        </div>
                        <div className={styles.stepCard}>
                            <div className={styles.stepIcon}>✅</div>
                            <h3 className={styles.stepTitle}>
                                Make an Informed Choice
                            </h3>
                            <p className={styles.stepDesc}>
                                Compare facilities side-by-side with full
                                compliance history, pricing transparency, and
                                real family reviews to make the best decision.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
            {/* Trust Section */}
            <section className={styles.trustSection} id="for-families">
                <div className="container">
                    <h2 className={styles.sectionTitle}>
                        Assistedly.ai&apos;s Differences
                    </h2>
                    <p className={styles.sectionSubtitle}>
                        Unlike other companies, we don&apos;t sell your personal data to assisted
                        living facilities. Instead, Assistedly.ai&apos;s business model is to sell
                        anonymous data to businesses (including assisted living facilities!),
                        governments and NGOs to improve assisted living for all
                    </p>
                    <div className={styles.trustGrid}>
                        <div className={styles.trustCard}>
                            <div className={styles.trustCardIcon}>🔒</div>
                            <h3 className={styles.trustCardTitle}>
                                Your Privacy Protected
                            </h3>
                            <p className={styles.trustCardDesc}>
                                We never sell your <strong>personal</strong> information
                                to assisted living facilities. No hard-sell salespeople
                                will contact you after using our service.
                            </p>
                        </div>
                        <div className={styles.trustCard}>
                            <div className={styles.trustCardIcon}>📊</div>
                            <h3 className={styles.trustCardTitle}>
                                Transparent Business Model
                            </h3>
                            <p className={styles.trustCardDesc}>
                                We make money by collecting anonymized data to help 
                                companies, governments and non-profits improve 
                                assisted living facilities.
                            </p>
                        </div>
                        <div className={styles.trustCard}>
                            <div className={styles.trustCardIcon}>💝</div>
                            <h3 className={styles.trustCardTitle}>
                                Helping Families in Need
                            </h3>
                            <p className={styles.trustCardDesc}>
                                We&apos;re working on ways for families to help seniors 
                                in need get better places to live and better care 
                                through our platform.
                            </p>
                        </div>
                        <div className={styles.trustCard}>
                            <div className={styles.trustCardIcon}>🔍</div>
                            <h3 className={styles.trustCardTitle}>
                                Unbiased Information
                            </h3>
                            <p className={styles.trustCardDesc}>
                                Since facilities don&apos;t pay us for placement, we can 
                                provide truly unbiased recommendations based on what&apos;s 
                                best for your family.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
            {/* Stats Bar */}
            <div className={styles.statsBar}>
                <div className={styles.statItem}>
                    <div className={styles.statNumber}>500+</div>
                    <div className={styles.statLabel}>Facilities Listed</div>
                </div>
                <div className={styles.statItem}>
                    <div className={styles.statNumber}>MA</div>
                    <div className={styles.statLabel}>
                        Massachusetts-Focused
                    </div>
                </div>
                <div className={styles.statItem}>
                    <div className={styles.statNumber}>100%</div>
                    <div className={styles.statLabel}>Privacy Protected</div>
                </div>
                <div className={styles.statItem}>
                    <div className={styles.statNumber}>$0</div>
                    <div className={styles.statLabel}>Always Free</div>
                </div>
            </div>
            {/* CTA Section */}
            <section className={styles.ctaSection} id="contact">
                <h2 className={styles.ctaTitle}>Start Your Search Today</h2>
                <p className={styles.ctaSubtitle}>
                    Find the right assisted living facility for your loved one
                    with Assistedly.
                </p>
                <form className={styles.ctaForm} onSubmit={onCtaSubmit}>
                    <input
                        type="email"
                        className={styles.ctaInput}
                        placeholder="Enter your email address"
                        value={email}
                        onFocus={handleEmailFocus}
                        onChange={handleEmailChange}
                        required
                        autoComplete="email"
                        disabled={ctaSubmitting}
                        aria-invalid={ctaError ? "true" : "false"}
                        aria-describedby={
                            ctaError ? "cta-signup-error" : undefined
                        }
                    />
                    <button
                        type="submit"
                        className={styles.ctaBtn}
                        disabled={ctaSubmitting}
                    >
                        {ctaSubmitting ? "Sending…" : "Get Started Free"}
                    </button>
                </form>
                {ctaError ? (
                    <p id="cta-signup-error" className={styles.ctaError}>
                        {ctaError}
                    </p>
                ) : null}
            </section>

        </>
    );
}
