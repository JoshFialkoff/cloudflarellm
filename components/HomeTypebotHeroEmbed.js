import React, { useEffect, useState } from "react";
import styles from "../styles/Home.module.css";
import { TYPEBOT_API_HOST, TYPEBOT_PUBLIC_ID } from "../lib/homeTypebotBootstrap";

class TypebotEmbedErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch() {
        // Keep UI stable if third-party embed fails (network/CORS/runtime).
    }

    render() {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}

export default function HomeTypebotHeroEmbed({
    typebotSectionRef,
    TypebotStandard,
    typebotImportError,
    onRetryTypebotImport,
    prefilledVariables = {},
    onInit,
    onNewInputBlock,
    onAnswer,
    onEnd,
}) {
    const [hostStatus, setHostStatus] = useState(
        TYPEBOT_PUBLIC_ID ? "checking" : "missing-config",
    );

    useEffect(() => {
        if (!TYPEBOT_PUBLIC_ID) {
            return undefined;
        }

        const ac = new AbortController();
        const timeoutId = window.setTimeout(() => ac.abort(), 2500);

        fetch(`${TYPEBOT_API_HOST}/`, {
            method: "GET",
            mode: "no-cors",
            credentials: "omit",
            signal: ac.signal,
        })
            .then(() => setHostStatus("reachable"))
            .catch(() => setHostStatus("unreachable"))
            .finally(() => window.clearTimeout(timeoutId));

        return () => {
            window.clearTimeout(timeoutId);
            ac.abort();
        };
    }, []);

    return (
        <div className={styles.heroVideoSlot}>
            <section
                ref={typebotSectionRef}
                className={`${styles.typebotEmbed} ${styles.heroTypebotAside}`}
                id="assistant"
                aria-label="AI assistant chat"
            >
                <div className={styles.heroTypebotFrame}>
                    {!TYPEBOT_PUBLIC_ID ? (
                        <div
                            className={styles.typebotLoadingRoot}
                            role="status"
                            aria-live="polite"
                            aria-label="AI assistant is not configured"
                        >
                            Assistant unavailable: set
                            {" "}
                            <code>NEXT_PUBLIC_TYPEBOT_ID</code>
                            {" "}
                            in your environment.
                        </div>
                    ) : hostStatus === "checking" ? (
                        <div
                            className={styles.typebotLoadingRoot}
                            role="status"
                            aria-live="polite"
                            aria-label="Checking assistant availability"
                        >
                            Checking assistant availability…
                        </div>
                    ) : hostStatus === "unreachable" ? (
                        <div
                            className={styles.typebotLoadingRoot}
                            role="status"
                            aria-live="polite"
                            aria-label="AI assistant unavailable"
                        >
                            Assistant unavailable right now. Please refresh the
                            page or try again shortly.
                        </div>
                    ) : TypebotStandard ? (
                        <div
                            style={{
                                position: "absolute",
                                inset: 0,
                            }}
                        >
                            <TypebotEmbedErrorBoundary
                                fallback={
                                    <div
                                        className={styles.typebotLoadingRoot}
                                        role="status"
                                        aria-live="polite"
                                        aria-label="AI assistant temporarily unavailable"
                                    >
                                        Assistant temporarily unavailable. Please refresh the
                                        page or try again shortly.
                                    </div>
                                }
                            >
                                <TypebotStandard
                                    typebot={TYPEBOT_PUBLIC_ID}
                                    apiHost={TYPEBOT_API_HOST}
                                    prefilledVariables={prefilledVariables}
                                    style={{
                                        display: "block",
                                        width: "100%",
                                        height: "100%",
                                        border: 0,
                                    }}
                                    onInit={onInit}
                                    onNewInputBlock={onNewInputBlock}
                                    onAnswer={onAnswer}
                                    onEnd={onEnd}
                                />
                            </TypebotEmbedErrorBoundary>
                        </div>
                    ) : typebotImportError ? (
                        <div
                            className={styles.typebotLoadingRoot}
                            role="alert"
                            aria-live="assertive"
                        >
                            <p>
                                Oh no! Our AI assistant needs human help! I&apos;m going to alert my team to help you!
                            </p>
                            {typeof onRetryTypebotImport === "function" ? (
                                <button
                                    type="button"
                                    className={styles.ctaBtn}
                                    onClick={onRetryTypebotImport}
                                >
                                    Try again
                                </button>
                            ) : null}
                        </div>
                    ) : typebotImportError ? (
                        <div
                            className={styles.typebotLoadingRoot}
                            role="alert"
                            aria-live="assertive"
                        >
                            <p>
                                Oh no! Our AI assistant needs human help! I&apos;m going to alert my team to help you!
                            </p>
                            {typeof onRetryTypebotImport === "function" ? (
                                <button
                                    type="button"
                                    className={styles.ctaBtn}
                                    onClick={onRetryTypebotImport}
                                >
                                    Try again
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <div
                            className={styles.typebotLoadingRoot}
                            role="status"
                            aria-live="polite"
                            aria-label="AI assistant is checking all of our proprietary data..."
                        >
                            <span
                                className={styles.typebotLoadingSpinner}
                                aria-hidden
                            />
                            Loading assistant…
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
