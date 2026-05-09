import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePostHog } from "posthog-js/react";
import styles from "../styles/Home.module.css";
import {
    TYPEBOT_API_HOST,
    TYPEBOT_PUBLIC_ID,
    TYPEBOT_TEST_PUBLIC_ID,
} from "../lib/homeTypebotBootstrap";

const TYPEBOT_VERSION_FLAG = "typebot-version-test";
const TYPEBOT_INIT_TIMEOUT_MS = 10000;

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
    onEmbedMount,
    onEmbedTimeout,
}) {
    const posthog = usePostHog();
    const flagVariant = posthog?.getFeatureFlag(TYPEBOT_VERSION_FLAG);
    const selection = useMemo(() => {
        const testConfigured = Boolean(TYPEBOT_TEST_PUBLIC_ID);
        const useTest = testConfigured && flagVariant === "test";
        return {
            flagVariant:
                typeof flagVariant === "string" ? flagVariant : "unresolved",
            testConfigured,
            typebotVariant: useTest ? "test" : "control",
            typebotId: useTest ? TYPEBOT_TEST_PUBLIC_ID : TYPEBOT_PUBLIC_ID,
        };
    }, [flagVariant]);
    const selectedTypebotId = selection.typebotId;
    const [initSeen, setInitSeen] = useState(false);

    useEffect(() => {
        onEmbedMount?.({
            flag_variant: selection.flagVariant,
            test_configured: selection.testConfigured,
            typebot_id_present: Boolean(selectedTypebotId),
            typebot_variant: selection.typebotVariant,
        });
    }, [onEmbedMount, selectedTypebotId, selection]);

    useEffect(() => {
        if (!selectedTypebotId || initSeen || typebotImportError) {
            return undefined;
        }
        const timeoutId = window.setTimeout(() => {
            onEmbedTimeout?.({
                flag_variant: selection.flagVariant,
                typebot_react_loaded: Boolean(TypebotStandard),
                typebot_variant: selection.typebotVariant,
            });
        }, TYPEBOT_INIT_TIMEOUT_MS);
        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [
        TypebotStandard,
        initSeen,
        onEmbedTimeout,
        selectedTypebotId,
        selection,
        typebotImportError,
    ]);

    const handleInit = useCallback(() => {
        setInitSeen(true);
        onInit?.();
    }, [onInit]);

    return (
        <div className={styles.heroVideoSlot}>
            <section
                ref={typebotSectionRef}
                className={`${styles.typebotEmbed} ${styles.heroTypebotAside}`}
                id="assistant"
                aria-label="AI assistant chat"
            >
                <div className={styles.heroTypebotFrame}>
                    {!selectedTypebotId ? (
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
                                    typebot={selectedTypebotId}
                                    apiHost={TYPEBOT_API_HOST}
                                    prefilledVariables={prefilledVariables}
                                    style={{
                                        display: "block",
                                        width: "100%",
                                        height: "100%",
                                        border: 0,
                                    }}
                                    onInit={handleInit}
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
